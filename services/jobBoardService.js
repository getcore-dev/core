const sanitizeHtml = require('sanitize-html'); // Import the sanitization library
const url = require('url');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const { zodResponseFormat } = require('openai/helpers/zod');
const { z } = require('zod');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const EventEmitter = require('events');
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const jobQueries = require('../queries/jobQueries');
const { title } = require('process');
const rateLimit = require('axios-rate-limit');
const http = rateLimit(axios.create(), { maxRequests: 10, perMilliseconds: 1000 }); // 10 requests per second
const WebScraper = require('./webScraperService');
const { link } = require('fs');
const { set } = require('../app');
const web = new WebScraper();
const TurndownService = require('turndown');



class ObjectSet extends Set {
  add(obj) {
    for (let item of this) {
      if (JSON.stringify(item) === JSON.stringify(obj)) {
        return this; // Object already exists
      }
    }
    super.add(obj);
    return this;
  }
}


class JobProcessor extends EventEmitter {
  constructor() {
    super();
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    this.genAI = new GoogleGenerativeAI(geminiKey);
    this.openai = new OpenAI({ apiKey: openaiKey });
    this.useGemini = false;
    this.lastRequestTime = 0;
    this.GEMINI_DELAY_MS = 3000;
    this.OPENAI_DELAY_MS = 3000;
    this.MAX_RETRIES = 5;
    this.JOB_EXPIRATION_DAYS = 60;
    this.BACKOFF_FACTOR = 1.5;
    this.processedLinksFile = path.join(__dirname, 'processed_links.txt');
    this.processedLinks = new Set();
    this.DELAY_BETWEEN_REQUESTS = 1000;
    this.DELAY_BETWEEN_SEARCHES = 5000;
    this.MAX_PAGES_PER_SEARCH = 3;
    this.jobBoardPlatforms = ['greenhouse.io', 'ashbyhq.com', 'myworkday.com', 'lever.co'];
    this.LINKEDIN_SEARCH_DELAY = 60000;
    this.MAX_LINKEDIN_PAGES = 5;
    this.progress = {
      phase: 'Initializing',
      company: '',
      totalCompanies: 0,
      processedCompanies: 0,
      totalJobs: 0,
      processedJobs: 0,
      currentAction: ''
    };
    this.browser = null;
    this.maxConcurrentPages = 5;
    this.currentPages = 0;
  }


  async cleanupOldJobs() {
    console.log('Cleaning up old jobs...');
    
    try {
      const deletedJobIds = await jobQueries.getOldJobs();
      const batchSize = 5;

      this.updateProgress({
        phase: 'Cleaning up old jobs',
        totalJobs: deletedJobIds.length,
        processedJobs: 0,
        currentAction: 'Deleting old jobs'
      });

      for (let i = 0; i < deletedJobIds.length; i += batchSize) {
        const batch = deletedJobIds.slice(i, i + batchSize);
        const deletePromises = batch.map(job => jobQueries.automatedDeleteJob(job.id));

        await Promise.all(deletePromises);
        this.updateProgress({ processedJobs: i + batch.length });
      }
    
      console.log(`Removed ${deletedJobIds.length} old jobs.`);

    } catch (error) {
      console.error('Error cleaning up old jobs:', error);
    }
  }

  normalizeUrl(url) {
    try {
      const parsedUrl = new URL(url);
      let hostname = parsedUrl.hostname;
      
      // Remove 'www.' if present
      hostname = hostname.replace(/^www\./, '');
      
      // Handle the specific case of 'boards.greenhouse.io' vs 'job-boards.greenhouse.io'
      hostname = hostname.replace(/^(job-)?boards\./, 'boards.');
      
      // Reconstruct the URL with the normalized hostname
      return `${parsedUrl.protocol}//${hostname}${parsedUrl.pathname}${parsedUrl.search}`;
    } catch (error) {
      console.error(`Error normalizing URL ${url}:`, error);
      return url; // Return the original URL if parsing fails
    }
  }

  async mergeDuplicateJobGroup(jobGroup) {
    const [primaryJob, ...duplicateJobs] = jobGroup;
  
    for (const duplicateJob of duplicateJobs) {
      await jobQueries.mergeJobs(primaryJob.id, duplicateJob.id);
    }
  }

  async removeDuplicateJobs() {
    try {
      const duplicateJobGroups = await jobQueries.getDuplicateJobPostings();
      const totalJobs = duplicateJobGroups.reduce((sum, group) => sum + group.length - 1, 0);
  
      this.updateProgress({
        phase: 'Merging duplicate jobs',
        totalJobs: totalJobs,
        processedJobs: 0,
        currentAction: 'Merging duplicate jobs'
      });
  
      for (const group of duplicateJobGroups) {
        await this.mergeDuplicateJobGroup(group);
        this.updateProgress({ processedJobs: this.updateProgress.processedJobs + group.length - 1 });
      }
  
    } catch (error) {
      console.error('Error merging duplicate jobs:', error);
    }
  }

  updateProgress(update) {
    this.progress = { ...this.progress, ...update };
    this.emit('progress', this.progress);
  }

  async init() {
    await this.loadProcessedLinks();
  }


  async loadProcessedLinks() {
    try {
      const data = await fs.readFile(this.processedLinksFile, 'utf8');
      this.processedLinks = new Set(data.split('\n').filter(Boolean));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error loading processed links:', error);
      }
    }
  }

  isTechJob(title) {
    // Convert title to lowercase for case-insensitive matching
    const lowercaseTitle = title.toLowerCase();
  
    // Highly specific tech roles
    const exactMatches = [
      'software engineer', 'data scientist', 'full stack developer', 'machine learning engineer',
      'devops engineer', 'systems architect', 'systems engineer', 'network engineer', 'data analyst',
      'backend developer', 'frontend developer', 'web developer', 'mobile developer', 'cloud architect',
      'cloud engineer', 'security engineer', 'cybersecurity analyst', 'technical lead', 'tech lead',
      'database administrator', 'qa engineer', 'quality assurance engineer', 'ux designer', 'ui designer',
      'product manager', 'scrum master', 'agile coach', 'site reliability engineer', 'automation engineer',
      'blockchain developer', 'game developer', 'game designer', 'graphic designer', 'systems administrator',
      'it support', 'it specialist', 'it manager', 'technical support', 'technical writer',
      'ai engineer', 'artificial intelligence engineer', 'deep learning engineer', 'data engineer',
      'big data engineer', 'data architect', 'information security analyst', 'robotics engineer',
      'network administrator', 'embedded systems engineer', 'firmware engineer', 'test engineer',
      'software tester', 'business analyst', 'it analyst', 'solution architect', 'enterprise architect',
      'devsecops engineer', 'cloud specialist', 'systems analyst', 'applications engineer',
      'platform engineer', 'release engineer', 'build engineer', 'hardware engineer',
      'electrical engineer', 'electronics engineer', 'microcontroller engineer', 'ios developer',
      'android developer', 'webmaster', 'security analyst', 'information technology specialist',
      'technical consultant', 'pre-sales engineer', 'post-sales engineer', 'technical account manager',
      'computer vision engineer', 'natural language processing engineer', 'nlp engineer',
      'database developer', 'data warehouse engineer', 'etl developer', 'bi developer',
      'business intelligence developer', 'data visualization engineer', 'cloud consultant',
      'solutions engineer', 'integration engineer', 'salesforce developer', 'sap consultant',
      'oracle developer', 'erp consultant', 'crm consultant', 'help desk technician',
      'desktop support technician', 'it technician', '3d artist', 'vr developer', 'ar developer',
      'qa tester', 'quality assurance tester', 'network technician', 'it director', 'cto',
      'chief technology officer', 'cio', 'chief information officer', 'ciso',
      'chief information security officer'
    ];
  
    // Non-tech engineering roles to exclude
    const nonTechEngineering = [
      'civil engineer', 'mechanical engineer', 'chemical engineer', 'aeronautical engineer',
      'structural engineer', 'environmental engineer', 'biomedical engineer', 'agricultural engineer',
      'nuclear engineer', 'petroleum engineer', 'geological engineer', 'industrial engineer',
      'materials engineer', 'construction engineer', 'metallurgical engineer', 'mining engineer',
      'transportation engineer', 'textile engineer', 'automotive engineer', 'marine engineer',
      'naval engineer', 'sound engineer', 'production engineer', 'architect', 'draftsman',
      'fashion designer', 'interior designer', 'graphic artist', 'chemist', 'physicist',
      'lab technician', 'laboratory technician', 'field technician'
    ];
  
    // Function to create regex patterns for exact matches and keywords
    const createPattern = (words) => new RegExp(`\\b(${words.join('|')})\\b`, 'i');
  
    const techPattern = createPattern(exactMatches);
    const nonTechPattern = createPattern(nonTechEngineering);
  
    // If title matches a non-tech engineering role, return false
    if (nonTechPattern.test(lowercaseTitle)) {
      return false;
    }
  
    // If title matches a tech role, return true
    if (techPattern.test(lowercaseTitle)) {
      return true;
    }
  
    // List of generic tech-related keywords
    const techKeywords = [
      'developer', 'programmer', 'engineer', 'software', 'hardware', 'technology', 'technician',
      'administrator', 'analyst', 'architect', 'consultant', 'specialist', 'support', 'coder',
      'tester', 'manager', 'devops', 'cloud', 'data', 'ai', 'artificial intelligence',
      'machine learning', 'ml', 'blockchain', 'crypto', 'cybersecurity', 'security', 'database',
      'web', 'mobile', 'ios', 'android', 'ux', 'ui', 'qa', 'quality assurance', 'sre',
      'automation', 'product', 'agile', 'scrum', 'network', 'system', 'systems', 'it',
      'information technology', 'digital', 'full stack', 'front end', 'backend', 'back end',
      'saas', 'paas', 'big data', 'data science', 'devsecops', 'nlp', 'natural language processing',
      'vr', 'ar', 'virtual reality', 'augmented reality', 'robotics', 'embedded', 'firmware',
      'microcontroller', 'fpga', 'simulation', 'cloud computing', 'docker', 'kubernetes',
      'container', 'microservices', 'serverless', 'distributed systems', 'e-commerce', 'ecommerce',
      'internet', 'digital transformation', 'iot', 'internet of things', 'opensource', 'open source',
      'technical', 'computing', 'computational', 'scientist'
    ];
  
    const techKeywordsPattern = createPattern(techKeywords);
  
    // If title contains any tech keywords, return true
    if (techKeywordsPattern.test(lowercaseTitle)) {
      return true;
    }
  
    // If none of the above conditions are met, it's likely not a tech job
    return false;
  }
  

  async saveProcessedLink(link) {
    this.processedLinks.add(link);
    await fs.appendFile(this.processedLinksFile, link + '\n');
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }


  async rateLimit(isGemini) {
    const now = Date.now();
    const delayMs = isGemini ? this.GEMINI_DELAY_MS : this.OPENAI_DELAY_MS;
    const elapsed = now - this.lastRequestTime;

    if (elapsed < delayMs) {
      await this.delay(delayMs - elapsed);
    }

    this.lastRequestTime = Date.now();
  }

  async filterNonTechJobs() {
    const jobs = await jobQueries.getAllJobs();
    jobs.forEach(job => {
      if (!this.isTechJob(job.title)) {
        jobQueries.deleteJob(job.id);
      }
    });
  }

  parseRateLimitError(error) {
    const message = error.message || error.error?.message || '';
    const match = message.match(/Please try again in (\d+)(\.\d+)?m?s/);
    if (match) {
      const delay = parseFloat(match[1] + (match[2] || ''));
      return Math.ceil(delay * (match[0].includes('m') ? 1000 : 1));
    }
    return null;
  }


  async makeRequest(url) {
    try {
      if (url.includes('myworkdayjobs.com')) return await this.grabWorkDayLinks(url);
      const response = await http.get(url, {
        timeout: 10000, // 10 seconds timeout
        headers: {
          'User-Agent': 'core/1.0 (support@getcore.dev)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        validateStatus: function (status) {
          return status >= 200 && status < 300;
        },
      });
  
      return response;
    } catch (error) {
      console.error('HTTP request failed. Falling back to Puppeteer.');
      return await this.usePuppeteerFallback(url);
    }
  }

  async usePuppeteerFallback(url) {
    let browser;
    try {
      browser = await puppeteer.launch({ headless: 'new' });
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      console.log('loadde the fucking browser');
      // Navigate to the page and wait for network to be idle
      await page.goto(url, { 
        waitUntil: 'networkidle0',
        timeout: 30000 // Increase timeout to 30 seconds
      });

      console.log('okay we have the page loaded at least');
  
      const content = await page.content();
  
      return {
        data: content,
        status: 200,
      };
    } catch (error) {
      console.error('Puppeteer fallback failed:', error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async autoScroll(page) {
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
  
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
  }


  getCompanyIdentifier(jobBoardUrl) {
    const parsedUrl = new URL(jobBoardUrl);
    const pathParts = parsedUrl.pathname.split('/').filter(part => part);

    if (parsedUrl.hostname.includes('greenhouse.io')) {
      return pathParts[pathParts.length - 1];
    } else if (parsedUrl.hostname.includes('lever.co')) {
      return pathParts[0];
    } else {
      const subdomain = parsedUrl.hostname.split('.')[0];
      return subdomain !== 'www' ? subdomain : pathParts[0];
    }
  }
  
  urlMatches(url1, url2) {
    const identifier1 = this.getCompanyIdentifier(url1);
    const identifier2 = this.getCompanyIdentifier(url2);
    return identifier1 === identifier2;
  }

  async collectJobLinksFromSimplify() {
    const simplifyUrl = 'https://raw.githubusercontent.com/SimplifyJobs/Summer2025-Internships/refs/heads/dev/README.md';
    
    try {
      const response = await axios.get(simplifyUrl);
      const markdownContent = response.data;
  
      // Split the content into lines
      const lines = markdownContent.split('\n');
  
      // Find the start of the table by locating the header
      const tableStartIndex = lines.findIndex(line => line.startsWith('| Company'));
  
      if (tableStartIndex === -1) {
        console.error('Table not found in the markdown content');
        return [];
      }
  
      // The table headers are at tableStartIndex, the separator is at tableStartIndex +1
      // The table data starts at tableStartIndex + 2
      const tableDataLines = lines.slice(tableStartIndex + 2);
  
      const jobLinks = [];
      let currentCompanyName = '';
      let currentCompanyLink = null;
  
      for (const line of tableDataLines) {
        // Stop processing if the line doesn't start with '|', indicating the end of the table
        if (!line.startsWith('|')) {
          break;
        }
  
        // Split the line into columns by '|', trimming whitespace
        const columns = line.split('|').map(col => col.trim());
  
        // Ensure there are enough columns to process
        // Expected columns: [Empty, Company, Role, Location, Application/Link, Date Posted, ...]
        if (columns.length < 5) {
          continue; // Skip lines that don't have enough columns
        }
  
        const companyCell = columns[1];
        const role = columns[2];
        const location = columns[3];
        const applicationLinkCell = columns[4];
        const datePosted = columns[5] || '';
  
        // Check if the row is a main company entry or a sub-entry
        if (companyCell !== '↳') {
          // Extract company name and link using regex
          const companyMatch = /\*\*\[([^\]]+)\]\((https?:\/\/[^\)]+)\)\*\*/.exec(companyCell);
          if (companyMatch) {
            currentCompanyName = companyMatch[1];
            currentCompanyLink = companyMatch[2];
          } else {
            // If the company cell doesn't match the expected format, use the raw text
            currentCompanyName = companyCell;
            currentCompanyLink = null;
          }
        }
        // If the companyCell is '↳', retain the currentCompanyName and currentCompanyLink
  
        // Extract all href URLs from the applicationLinkCell using regex
        const linkMatches = [...applicationLinkCell.matchAll(/href="(https?:\/\/[^"]+)"/g)].map(m => m[1]);
  
        // Assign the extracted links
        let applyLink = null;
        let simplifyLink = null;
        if (linkMatches.length >= 2) {
          applyLink = linkMatches[0];
          simplifyLink = linkMatches[1];
        } else if (linkMatches.length === 1) {
          applyLink = linkMatches[0];
        }
  
        // Push the extracted job information into the jobLinks array
        jobLinks.push({
          companyName: currentCompanyName,
          companyLink: currentCompanyLink,
          role,
          location,
          applyLink,
          simplifyLink,
          datePosted
        });
      }
  
      console.log(`Found ${jobLinks.length} job links from SimplifyJobs`);
  
      await this.processSimplifyJobLinks(jobLinks);
  
      return jobLinks;
      
    } catch (error) {
      console.error('Error fetching SimplifyJobs internships:', error);
      return [];
    }
  }

  /*
  jobLinks = 
[
  {
    companyName: 'Dow Jones',
    companyLink: 'https://simplify.jobs/c/Dow-Jones',
    role: 'Summer 2025 Internship – Software Engineer Intern',
    location: 'Princeton, NJ</br>NYC',
    applyLink: 'https://dowjones.wd1.myworkdayjobs.com/en-US/Dow_Jones_Career/job/NYC---1211-Ave-of-the-Americas/Summer-2025-Internship---Software-Engineer-Intern_Job_Req_43114?utm_source=Simplify&ref=Simplify',
    simplifyLink: 'https://simplify.jobs/p/54c64056-7e71-42a1-a119-0abfdfd66fe9?utm_source=GHList',
    datePosted: 'Sep 17'
  },
  {
    companyName: 'CACI',
    companyLink: 'https://simplify.jobs/c/CACI',
    role: 'Cleared Software Engineer Intern - Summer 2025',
    location: 'Denver, CO</br>Dulles, VA',
    applyLink: 'https://caci.wd1.myworkdayjobs.com/External/job/US-CO-Denver/Cleared-Software-Engineer-Intern---Summer-2025_301978-1?utm_source=Simplify&ref=Simplify',
    simplifyLink: 'https://simplify.jobs/p/7ff71059-98f4-4f29-ae65-4134ccec468f?utm_source=GHList',
    datePosted: 'Sep 17'
  },
  ... 572 more items
]
  */
  async processSimplifyJobLinks(jobLinks) {
    try {
    // Retrieve all existing company job links from the database
      const companyJobLinks = await jobQueries.getAllCompanyJobLinks();

      // Iterate over each job link in the provided array
      for (const jobLink of jobLinks) {
        try {
        // Check if the applyLink exists
          if (!jobLink.applyLink) {
            console.log(`No apply link found for ${jobLink.companyName} - ${jobLink.role}`);
            continue; // Skip to the next jobLink
          }

          // Check if the job link already exists in the database
          const existingJob = companyJobLinks.find(link => link.link === jobLink.applyLink);
          if (existingJob) {
            console.log(`Job posting for ${jobLink.companyName} - ${jobLink.role} already exists in the database`);
            continue; // Skip to the next jobLink
          }

          // Process the job link to extract job data
          const jobData = await this.processJobLinkWithRetry(jobLink.applyLink);
          console.log('jobData', jobData);

          // If the job is not marked as skipped, add it to the database
          if (!jobData.skipped) {
            await jobQueries.createJobPosting(
              jobData.title ? jobData.title : '',
              jobData.salary ? jobData.salary : 0,
              jobData.experience_level ? jobData.experience_level : '',
              jobData.location ? jobData.location : '',
              new Date(),
              jobData.company_id,
              jobLink.applyLink ? jobLink.applyLink : '',
              null,
              jobData.tags ? jobData.tags.split(',') : [],
              jobData.description ? jobData.description : '',
              jobData.salary_max ? jobData.salary_max : 0,
              '1',
              jobData.skills ? jobData.skills.split(',') : [],
              jobData.benefits ? jobData.benefits.split(',') : [],
              jobData.additional_information ? jobData.additional_information : '',
              jobData.PreferredQualifications ? jobData.PreferredQualifications : '',
              jobData.MinimumQualifications ? jobData.MinimumQualifications : '',
              jobData.Responsibilities ? jobData.Responsibilities : '',
              jobData.Requirements ? jobData.Requirements : '',
              jobData.NiceToHave ? jobData.NiceToHave : '',
              jobData.Schedule ? jobData.Schedule : '',
              jobData.HoursPerWeek ?  jobData.HoursPerWeek : 0,
              jobData.H1BVisaSponsorship ? jobData.H1BVisaSponsorship : 0,
              jobData.IsRemote ? jobData.IsRemote : 0,
              jobData.EqualOpportunityEmployerInfo ? jobData.EqualOpportunityEmployerInfo : '',
              jobData.Relocation ? jobData.Relocation : 0
            );
            console.log(`Added job posting for ${jobData.company_name} - ${jobData.title} with ID ${jobData.company_id}`);
          } else {
          // Log the reason for skipping the job posting
            console.log(`Skipped job posting for ${jobLink.companyName} - ${jobData.reason}`);
          }
        } catch (linkError) {
        // Log any errors that occur while processing the individual jobLink
          console.error(`Error processing job link for ${jobLink.companyName} - ${jobLink.role}: ${linkError.message}`);
          // Optionally, you can log the entire error stack for more detailed debugging
          // console.error(linkError);
          // Continue with the next jobLink without interrupting the flow
          continue;
        }
      }
    } catch (error) {
    // Handle errors that occur while fetching all company job links
      console.error(`Failed to retrieve company job links: ${error.message}`);
      // Depending on your application's requirements, you might want to rethrow the error
      // or handle it in another appropriate way
      throw error;
    }
  }



  async collectJobLinksFromLink(jobBoardUrl) {
    const companyJobBoards = await jobQueries.getAllCompanyJobBoards();
    const allJobPostingLinks = await jobQueries.getAllCompanyJobLinks();
    const allLinks = new Set();
    let currentPage = 1;
  
    try {
      const parsedUrl = new URL(jobBoardUrl);
      const jobBoardDomain = parsedUrl.hostname;
  
      const matchingBoard = companyJobBoards.find(board => this.urlMatches(board.job_board_url, jobBoardUrl));
  
      let companyId;
      if (!matchingBoard) {
        console.log(`No matching job board found for ${jobBoardUrl}. Creating company for job board URL...`);
        const browser = await puppeteer.launch({ args: ['--disable-http2'] });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        await page.goto(jobBoardUrl, { waitUntil: 'networkidle0' });
        const pageContent = await page.content();
        const $ = cheerio.load(pageContent);
  
        const company = await this.useChatGPTAPI_CompanyInfo(jobBoardUrl, $('body').text().replace(/\s\s+/g, ' ').trim());
  
        const existingCompany = await jobQueries.getCompanyIdByName(company.name);
  
        if (!existingCompany) {
          companyId = await jobQueries.createCompany(company.name, company.logo, company.location, company.description, company.industry, company.size, company.stock_symbol, company.founded);
          console.log(`Created company ${company.name} with ID ${companyId}`);
        } else {
          companyId = existingCompany.id;
          console.log(`Company ${company.name} found in database with ID ${companyId}.`);
        }
  
        await jobQueries.addJobBoardUrl(companyId, jobBoardUrl);
        await browser.close();
      } else {
        console.log(`Matching job board found: ${matchingBoard.job_board_url}`);
        companyId = matchingBoard.company_id;
        if (matchingBoard.job_board_url !== jobBoardUrl) {
          console.log(`Updating job board URL from ${matchingBoard.job_board_url} to ${jobBoardUrl}`);
          await jobQueries.updateJobBoardUrl(matchingBoard.id, jobBoardUrl);
        }
      }
  
      const browser = await puppeteer.launch({ args: ['--disable-http2'] });
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  
      const links = await this.handlePagination(page, jobBoardUrl, jobBoardDomain);

      links.forEach(link => {
        const normalizedNewUrl = this.normalizeUrl(link.url);
        const existingJob = allJobPostingLinks.find(job =>
          this.normalizeUrl(job.link) === normalizedNewUrl
        );
        
        allLinks.add({
          link: link.url,
          title: link.title,
          new: !existingJob,
          techJob: this.isTechJob(link.title),
          applyType: link.applyType,
          companyId: companyId
        });
      });
  
      await browser.close();
  
      console.log(`Collected a total of ${allLinks.size} job links from ${jobBoardUrl}`);
      return { links: Array.from(allLinks) };
    } catch (error) {
      console.error(`Error collecting job links from ${jobBoardUrl}:`, error);
      return { links: [] };
    }
  }

  getMaxPages($, jobBoardUrl) {
    // Implement logic to extract max pages based on the specific job board
    // This is just an example and should be adapted for each job board
    const paginationText = $('.pagination').text().trim();
    const match = paginationText.match(/Page \d+ of (\d+)/);
    if (match) {
      return Math.min(parseInt(match[1], 10), 15);
    }
    return null;
  }
  

  async collectJobLinks(company) {
    const jobBoardUrl = company.job_board_url;
    const allLinks = new Set();
    let maxPages = 4;

    try {
      if (jobBoardUrl.includes('linkedin.com')) {
        return;
        await this.searchLinkedInJobs(allLinks);
      }  else if (jobBoardUrl.includes('myworkdayjobs.com')) {
        const links = await this.grabWorkDayLinks(jobBoardUrl);
        return { companyId: company.id, links };
      } else {
        const firstPageResponse = await this.makeRequest(jobBoardUrl);
        const $firstPage = cheerio.load(firstPageResponse.data);
        
        if (jobBoardUrl.includes('linkedin.com')) {
          const paginationText = $firstPage('.jobs-search-pagination__page-state').text().trim();
          const match = paginationText.match(/Page \d+ of (\d+)/);
          if (match) {
            maxPages = 1;
          }
        }


        const firstPageLinks = await this.extractJobLinks($firstPage, jobBoardUrl);
          
        firstPageLinks.forEach(link => {
          if (!Array.from(allLinks).some(existingLink => existingLink.url.trim() === link.url.trim())) {
            allLinks.add(link);
          }
        });

      }

      console.log(`Collected ${allLinks.size} job links from ${jobBoardUrl}`);
      return { companyId: company.id, links: Array.from(allLinks) };
    } catch (error) {
      console.error(`Error collecting job links from ${jobBoardUrl}:`, error);
      return { companyId: company.id, links: [] };
    }
  }

  async extractJobLinksFromPage(jobBoardUrl) {
    console.log(`Extracting job links from ${jobBoardUrl}`);
    const pageUrl = this.getPageUrl(jobBoardUrl, 1);

    const response = await this.makeRequest(pageUrl);
    console.log(response.data);
    const $ = cheerio.load(response.data);
    const pageLinks = await this.extractJobLinks($, pageUrl);
    console.log(pageLinks);
    return pageLinks;
  }

  getPageUrl(baseUrl, page) {
    const url = new URL(baseUrl);
    
    if (baseUrl.includes('linkedin.com')) {
      url.searchParams.set('start', (page - 1) * 25);
    } else if (baseUrl.includes('ashbyhq.com')) {
      url.searchParams.set('page', page);
    } else if (baseUrl.includes('myworkday.com')) {
      url.searchParams.set('page', page);
    } else if (baseUrl.includes('bytedance.com')) {
      url.searchParams.set('current', page);
    } else if (baseUrl.includes('microsoft.com')) {
      url.searchParams.set('pg', page);
      url.searchParams.set('size', 20);
    } else if (baseUrl.includes('roblox.com')) {
      url.searchParams.set('page', page);
      url.searchParams.set('pageSize', 9);
    } else {
      url.searchParams.set('page', page);
    }

    return url.toString();
  }

  async extractJobLinks($, baseUrl) {
    const links = new ObjectSet();
    console.log('baseUrl', baseUrl);
  
    if (baseUrl.includes('linkedin.com')) {
      const promises = [];
      $('.job-card-container').each((index, element) => {
        const linkElement = $(element).find('.job-card-container__link');
        const link = linkElement.attr('href').trim();
        const title = linkElement.text().trim();
  
        if (this.isTechJob(title)) {
          const jobUrl = new URL(link, baseUrl).href;
          promises.push(this.checkLinkedInApplyType(jobUrl).then(applyType => {
            links.add(JSON.stringify({ url: jobUrl, applyType }));
          }));
        }
      });
      await Promise.all(promises);
    } else {
      $('a').each((index, element) => {
        const link = $(element).attr('href');
        if (!link) return;
    
        const title = $(element).text().trim();
        if (!title) return; // Skip if title is empty after trimming
        const jobLinkPattern = /(\b(job|career|position|opportunity)\b.*)|.*(jobId=|jobID=|job_id=|positionId=|openingId=).*/i;

        // Only process links that are job postings
        if (!jobLinkPattern.test(link)) return;
    
        // Normalize the title by replacing special characters with spaces
        const normalizedTitle = title.replace(/[\/\-]/g, ' ').toLowerCase();
    
    
        if (this.isTechJob(normalizedTitle)) {
          const jobUrl = new URL(link, baseUrl).href;
          links.add(JSON.stringify({ url: jobUrl }));
        } else {
          // console.log(`Not a tech job: ${title}`);
        }
      });
    
    }
  
    // Convert Set to Array and parse JSON strings back to objects
    return Array.from(links).map(link => JSON.parse(link));
  }

  async fetchWithRender(url) {
    try {
      const renderUrl = `https://render-tron.appspot.com/render/${encodeURIComponent(url)}`;
      const response = await axios.get(renderUrl, {
        headers: {
          'User-Agent': 'core/1.0 (support@getcore.dev)',
        },
        timeout: 15000, // 15 seconds timeout
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching rendered page for ${url}:`, error.message);
      throw error;
    }
  }

  async fullExtractJobLinks($, baseUrl, jobBoardDomain) {
    const links = new ObjectSet();
    const baseUrlObj = new URL(baseUrl);
  
    if (baseUrlObj.hostname.includes('linkedin.com')) {
      let currentUrl = baseUrl;
      let hasMore = true;
      let start = 0;
      let maxPages = this.getMaxPages($, currentUrl) || 1;
  
      while (hasMore && start < maxPages * 25) {
        const url = new URL(currentUrl);
        url.searchParams.set('start', start.toString());
        console.log(`Scraping page: ${url.toString()}`);
  
        const response = await this.makeRequest(url.toString());
        const $page = cheerio.load(response.data);
  
        $page('.base-card').each((index, element) => {
          const linkElement = $page(element).find('a.base-card__full-link');
          const link = linkElement.attr('href');
          const title = $page(element).find('.base-search-card__title').text().trim();
          const company = $page(element).find('.base-search-card__subtitle').text().trim();
          const location = $page(element).find('.job-search-card__location').text().trim();
  
          if (this.isTechJob(title)) {
            const jobUrl = new URL(link, baseUrl).href;
            if (new URL(jobUrl).hostname === jobBoardDomain) {
              links.add({ url: jobUrl, title, company, location });
            }
          }
          console.log(links);
        });
  
        hasMore = false;
  
        console.log(`Collected ${links.size} links so far`);
  
        // Add a delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    } else if (baseUrlObj.hostname.includes('myworkdayjobs.com')) {
      // Workday job board handling
      const companyName = baseUrlObj.hostname.split('.')[0];
      const apiUrl = `https://${companyName}.wd1.myworkdayjobs.com/wday/cxs/${companyName}/External/jobs`;
  
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            appliedFacets: {},
            limit: 20,
            offset: 0,
            searchText: ''
          })
        });
  
        const data = await response.json();
  
        if (data.jobPostings && Array.isArray(data.jobPostings)) {
          data.jobPostings.forEach(job => {
            const jobUrl = new URL(job.externalPath, baseUrl).href;
            links.add({
              url: jobUrl,
              title: job.title,
              location: job.locationsText,
              postedOn: job.postedOn,
              timeType: job.timeType
            });
          });
        }
  
        console.log(`Collected ${links.size} links from Workday job board`);
      } catch (error) {
        console.error('Error fetching Workday jobs:', error);
      }

    } else if (baseUrlObj.hostname.includes('ashbyhq.com')) {
      // Ashby HQ handling (unchanged)
      const companyName = baseUrlObj.pathname.split('/').pop();
      const apiUrl = 'https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobBoardWithTeams';
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operationName: 'ApiJobBoardWithTeams',
          variables: {
            organizationHostedJobsPageName: companyName
          },
          query: `query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) {
            jobBoard: jobBoardWithTeams(
              organizationHostedJobsPageName: $organizationHostedJobsPageName
            ) {
              teams {
                id
                name
                parentTeamId
                __typename
              }
              jobPostings {
                id
                title
                teamId
                locationId
                locationName
                employmentType
                secondaryLocations {
                  ...JobPostingSecondaryLocationParts
                  __typename
                }
                compensationTierSummary
                __typename
              }
              __typename
            }
          }
          
          fragment JobPostingSecondaryLocationParts on JobPostingSecondaryLocation {
            locationId
            locationName
            __typename
          }`
        })
      });
  
      const data = await response.json();
      if (data.data && data.data.jobBoard && data.data.jobBoard.jobPostings) {
        data.data.jobBoard.jobPostings.forEach(job => {
          const jobUrl = `${baseUrl}/${job.id}`;
          links.add({ url: jobUrl, title: job.title, location: job.locationName });
        });
      }
    } else if (baseUrlObj.hostname.includes('microsoft.com')) {
      console.log('microsoft job detected');
      const apiUrl = new URL(baseUrl);
      apiUrl.hostname = 'gcsservices.careers.microsoft.com';
      apiUrl.pathname = '/search/api/v1/search';
      apiUrl.searchParams.append('flt', 'true');
  
      try {
        const response = await fetch(apiUrl.toString());
        const data = await response.json();
        console.log(data);
      
        if (data.operationResult && data.operationResult.result && Array.isArray(data.operationResult.result.jobs)) {
          data.operationResult.result.jobs.forEach(job => {
            const jobUrl = `https://jobs.careers.microsoft.com/global/en/job/${job.jobId}`;
            links.add({ url: jobUrl, title: job.title, location: job.location });
          });
        }
      } catch (error) {
        console.error('Error fetching Microsoft jobs:', error);
      }
    } else {
      // Generic job board handling (unchanged)
      $('a[href*="job"], a[href*="career"], a[href*="position"]').each((index, element) => {
        const link = $(element).attr('href');
        const fullUrl = new URL(link, baseUrl).href;
        
        if (new URL(fullUrl).hostname === jobBoardDomain) {
          const title = $(element).find('p').map((i, el) => $(el).text().trim()).get().join(' ') || $(element).text().trim();
          if (this.isTechJob(title)) {
            links.add({ url: fullUrl, title });
          }
        }
      });
    }
  
    return Array.from(links);
  }

  async checkLinkedInApplyType(jobUrl) {
    try {
      const response = await this.makeRequest(jobUrl);
      const $ = cheerio.load(response.data);
      const applyButton = $('.jobs-apply-button');
      
      if (applyButton.text().trim().toLowerCase() === 'easy apply') {
        return 'Easy Apply';
      } else {
        const externalLink = applyButton.attr('href');
        return externalLink ? { type: 'External', url: externalLink } : 'Apply';
      }
    } catch (error) {
      console.error(`Error checking apply type for ${jobUrl}:`, error);
      return 'Unknown';
    }
  }

  async hasNextPage($, currentUrl) {
    // if greenhouse it doesnt have a next page
    if (currentUrl.includes('greenhouse.io')) {
      return false;
    }
    this.updateProgress({ currentAction: 'Checking next page' });
    const url = new URL(currentUrl);

    try {
    // Specific handling for known job board domains
      if (url.hostname.includes('linkedin.com')) {
        return await this.hasNextPageLinkedIn($, url);
      } else if (url.hostname.includes('careers.microsoft.com')) {
        return await this.hasNextPageMicrosoft($, url);
      } else {
        return await this.hasNextPageGeneric($, url);
      }
    } catch (error) {
      console.error(`Error checking next page for ${url}:`, error);
      return false;
    }
  }

  async hasNextPageLinkedIn($, url) {
    const start = parseInt(url.searchParams.get('start')) || 0;
    const nextStart = start + 25; // LinkedIn typically shows 25 jobs per page

    const nextPageUrl = new URL(url);
    nextPageUrl.searchParams.set('start', nextStart.toString());

    console.log(`Checking next page: ${nextPageUrl}`);

    try {
      const response = await this.makeRequest(nextPageUrl.toString());
      
      if (response.status === 200) {
        const $nextPage = cheerio.load(response.data);
        const jobCards = $nextPage('.base-card');
        
        if (jobCards.length > 0) {
          console.log(`Found ${jobCards.length} jobs on next page. Continuing...`);
          return true;
        }
      }
    } catch (error) {
      console.error(`Error checking next page ${nextPageUrl}:`, error);
    }

    console.log('No more jobs found. Stopping pagination.');
    return false;
  }

  async hasNextPageMicrosoft($, url) {
    // Implement Microsoft-specific logic here
    // Return true if there's a next page, false otherwise
  }

  async hasNextPageGeneric($, url) {
    // Check for common pagination elements
    const nextPageLink = $('a[rel="next"], a:contains("Next"), a:contains("»"), .pagination .next a').first();
  
    if (nextPageLink.length) {
      let nextPageUrl = nextPageLink.attr('href');
  
      // If the next page URL is relative, make it absolute
      if (nextPageUrl && !nextPageUrl.startsWith('http')) {
        nextPageUrl = new URL(nextPageUrl, url.origin).toString();
      }
  
      if (nextPageUrl && nextPageUrl !== url.toString()) {
        return nextPageUrl;
      }
    }
  
    // Check for page numbers in URL
    const pageParams = ['current', 'page', 'pg', 'p'];
    let currentPage = 1;
    let pageParam = '';
  
    for (const param of pageParams) {
      const value = url.searchParams.get(param);
      if (value !== null) {
        currentPage = parseInt(value) || 1;
        pageParam = param;
        break;
      }
    }
  
    if (currentPage > 0 || pageParam) {
      const nextPageUrl = new URL(url);
      
      // Special handling for ByteDance
      if (url.hostname.includes('bytedance.com')) {
        nextPageUrl.searchParams.set('current', (currentPage + 1).toString());
      } else if (pageParam === 'current') {
        nextPageUrl.searchParams.set('current', (currentPage + 1).toString());
        // Ensure 'page' parameter is removed if it exists
        nextPageUrl.searchParams.delete('page');
      } else {
        nextPageUrl.searchParams.set(pageParam || 'page', (currentPage + 1).toString());
      }
  
      console.log(`Checking next page: ${nextPageUrl}`);
      return nextPageUrl.toString();
    }
  
    console.log('No more jobs found. Stopping pagination.');
    return false;
  }

  extractJobLinksFromAPI(apiResponse) {
    const links = [];
  
    // Check if the response is an array of job postings
    if (Array.isArray(apiResponse)) {
      apiResponse.forEach(job => {
        if (job.url || job.link || job.jobUrl) {
          links.push({
            url: job.url || job.link || job.jobUrl,
            title: job.title || job.jobTitle || '',
            company: job.company || job.companyName || '',
            location: job.location || ''
          });
        }
      });
    } 
    // Check if the response is an object with a jobs array
    else if (apiResponse.jobs && Array.isArray(apiResponse.jobs)) {
      apiResponse.jobs.forEach(job => {
        if (job.url || job.link || job.jobUrl) {
          links.push({
            url: job.url || job.link || job.jobUrl,
            title: job.title || job.jobTitle || '',
            company: job.company || job.companyName || '',
            location: job.location || ''
          });
        }
      });
    }
    // Check for nested structures (e.g., data.jobBoard.jobPostings)
    else if (apiResponse.data && apiResponse.data.jobBoard && Array.isArray(apiResponse.data.jobBoard.jobPostings)) {
      apiResponse.data.jobBoard.jobPostings.forEach(job => {
        if (job.id) {  // Assuming job.id is used to construct the URL
          const jobUrl = `${this.baseUrl}/${job.id}`;
          links.push({
            url: jobUrl,
            title: job.title || '',
            company: this.company_name,  // Assuming this is set elsewhere in the class
            location: job.locationName || ''
          });
        }
      });
    }
  
    // Filter out non-tech jobs
    return links.filter(link => this.isTechJob(link.title));
  }
  
  async checkNextPage(nextPageUrl) {
    console.log(`Checking next page: ${nextPageUrl}`);
  
    try {
      const browser = await puppeteer.launch();
      const page = await browser.newPage();
  
      // Set up request interception
      await page.setRequestInterception(true);
  
      const apiResponses = [];
      page.on('request', request => {
        if (request.resourceType() === 'xhr' || request.resourceType() === 'fetch') {
          request.continue();
        } else {
          request.continue();
        }
      });
  
      page.on('response', async response => {
        if (response.request().resourceType() === 'xhr' || response.request().resourceType() === 'fetch') {
          try {
            const responseBody = await response.json();
            apiResponses.push(responseBody);
          } catch (e) {
            // Not JSON, ignore
          }
        }
      });
  
      // Navigate to the page
      await page.goto(nextPageUrl, { waitUntil: 'networkidle0' });
  
      const pageContent = await page.content();
      const $ = cheerio.load(pageContent);
  
      const parsedUrl = new URL(nextPageUrl);
      const jobBoardDomain = parsedUrl.hostname;
  
      const pageLinks = await this.fullExtractJobLinks($, nextPageUrl, jobBoardDomain);
  
      // Process API responses
      for (const apiResponse of apiResponses) {
        const apiLinks = this.extractJobLinksFromAPI(apiResponse);
        pageLinks.push(...apiLinks);
      }
  
      await browser.close();
  
      if (pageLinks.length > 0) {
        console.log(`Found ${pageLinks.length} jobs on next page. Continuing...`);
        return true;
      }
    } catch (error) {
      console.error(`Error checking next page ${nextPageUrl}:`, error);
    }
  
    console.log('No jobs found on next page. Stopping pagination.');
    return false;
  }

  async searchLinkedInJobs(allLinks, searchTerm) {
    const encodedTerm = encodeURIComponent(searchTerm);
    const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodedTerm}&f_TPR=r86400`;

    console.log(`Searching LinkedIn for: ${searchTerm}`);

    try {
      for (let page = 0; page < this.MAX_PAGES_PER_SEARCH; page++) {
        const pageUrl = `${searchUrl}&start=${page * 25}`;
        const response = await this.makeRequest(pageUrl);
        const $ = cheerio.load(response.data);

        const pageLinks = await this.extractJobLinks($, pageUrl);
        pageLinks.forEach(link => allLinks.add(link));

        if (!this.hasNextPage($, pageUrl)) {
          break;
        }

        await this.delay(this.DELAY_BETWEEN_REQUESTS);
      }
    } catch (error) {
      console.error(`Error searching LinkedIn for ${searchTerm}:`, error);
    }

    await this.delay(this.DELAY_BETWEEN_SEARCHES);
  }

  async processJobLinkWithRetry(link, retryCount = 0) {
    try {
      await this.rateLimit(!this.useGemini);
      return this.processJobLink(link);
    } catch (error) {
      const rateLimitDelay = this.parseRateLimitError(error);
      if (rateLimitDelay && retryCount < this.MAX_RETRIES) {
        const backoffTime = rateLimitDelay * Math.pow(this.BACKOFF_FACTOR, retryCount);
        console.log(`Rate limit reached. Retrying in ${backoffTime / 1000} seconds...`);
        await this.delay(backoffTime);
        return this.processJobLinkWithRetry(link, retryCount + 1);
      } else {
        throw error;
      }
    }
  }

  async handlePagination(page, baseUrl, jobBoardDomain) {
    let hasNextPage = true;
    let currentPage = 1;
    const allLinks = new Set();
  
    while (hasNextPage && currentPage <= this.MAX_PAGES_PER_SEARCH) {
      console.log(`Scraping page ${currentPage}: ${baseUrl}`);
  
      // Handle URL-based pagination
      const pageUrl = this.getPageUrl(baseUrl, currentPage);
      await page.goto(pageUrl, { waitUntil: 'networkidle0' });
  
      // Extract links from the current page
      const pageLinks = await this.fullExtractJobLinks(await page.content(), pageUrl, jobBoardDomain);
      pageLinks.forEach(link => allLinks.add(link));
  
      // Check for "Load More" button
      const loadMoreButton = await page.$('button:contains("Load More"), button:contains("Show More")');
      if (loadMoreButton) {
        await loadMoreButton.click();
        await page.waitForNavigation({ waitUntil: 'networkidle0' });
      } else {
        // Check for traditional pagination
        const nextPageButton = await page.$('a:contains("Next"), a:contains("»"), .pagination .next a');
        if (nextPageButton) {
          await nextPageButton.click();
          await page.waitForNavigation({ waitUntil: 'networkidle0' });
        } else {
          hasNextPage = false;
        }
      }
  
      // If no new links were found, stop pagination
      if (allLinks.size === pageLinks.length) {
        hasNextPage = false;
      }
  
      currentPage++;
      await this.delay(this.DELAY_BETWEEN_REQUESTS);
    }
  
    return Array.from(allLinks);
  }

  async processGreenhouseJobLink (url) {
    // grab div.job__title and div.job__description from the page

    // get the company part of the url
    // https://job-boards.greenhouse.io/flexport/jobs/6035440?gh_jid=6035440 you should grab 'flexport'
    const company = url.split('/')[3];
    const companyUrl = `https://job-boards.greenhouse.io/${company}`;
    const companyId = await this.getOrCreateCompany(company, '', '', companyUrl, '', '', '', '', '');
    console.log(companyId);

    // return an object with title and description
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const title = $('.section-header').text().trim();
    const location = $('.body--metadata').text().trim();
    const descriptionHtml = $('div.job__description').html();

    const turndownService = new TurndownService({
      headingStyle: 'atx', // Use ATX-style headings (e.g., # Heading)
      bulletListMarker: '-', // Use dashes for bullet lists
      codeBlockStyle: 'fenced', // Use fenced code blocks
      emDelimiter: '*', // Use asterisks for emphasis
      strongDelimiter: '**', // Use double asterisks for strong emphasis
    });

    const descriptionMarkdown = turndownService.turndown(descriptionHtml).trim();
    

    console.log({ url, companyId, title, description: descriptionMarkdown, location });
    return { url, companyId, title, description: descriptionMarkdown, location };
  }

  async processLeverJobLink (url) {
    // ensure there is no /apply after the url like https://jobs.lever.co/immuta/6f50874d-64c9-4fb2-b87a-d6a8c18a7db6/apply
    url = url.split('/apply')[0];
    // grab div.job__title and div.job__description from the page

    // get the company part of the url
    // https://jobs.lever.co/immuta/6f50874d-64c9-4fb2-b87a-d6a8c18a7db6, should grab 'immuta'
    const company = url.split('/')[3];
    const companyUrl = `https://jobs.lever.co/${company}`;
    // check if it exists in the db, if not create it
    const companyId = await this.getOrCreateCompany(company, '', '', companyUrl, '', '', '', '', '');

    // return an object with title and description
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    /*
    <div class="posting-headline"><h2>Product Engineering Internship (Summer 2025)</h2><div class="posting-categories"><div href="#" class="sort-by-time posting-category medium-category-label width-full capitalize-labels location">College Park, MD</div><div href="#" class="sort-by-team posting-category medium-category-label capitalize-labels department">Internships – Internships /</div><div href="#" class="sort-by-commitment posting-category medium-category-label capitalize-labels commitment">Intern /</div><div href="#" class="sort-by-time posting-category medium-category-label capitalize-labels workplaceTypes">Hybrid</div></div></div>
    */
    // get the h2 element within posting-headline div
    const title = $('.posting-headline h2').text().trim();
    const location = $('.location').text().trim();
    const experience_level = $('.commitment').text().replace('Intern', 'Internship').replace('/', '').trim();
    const employmentType = $('.workplaceTypes').text().trim();
    const descriptionHtml = $('div[data-qa="job-description"]').html() + $('div[data-qa="closing-description"]').html();

    const turndownService = new TurndownService({
      headingStyle: 'atx', // Use ATX-style headings (e.g., # Heading)
      bulletListMarker: '-', // Use dashes for bullet lists
      codeBlockStyle: 'fenced', // Use fenced code blocks
      emDelimiter: '*', // Use asterisks for emphasis
      strongDelimiter: '**', // Use double asterisks for strong emphasis
    });

    const descriptionMarkdown = turndownService.turndown(descriptionHtml).trim();
    

    console.log({ url, companyId, title, experience_level, employmentType, description: descriptionMarkdown, location });
    return { url, companyId, title, experience_level, employmentType, description: descriptionMarkdown, location };
  }

  async processBoFALink (url) {
    // grab div.job__title and div.job__description from the page

    // get the company part of the url
    // https://job-boards.greenhouse.io/flexport/jobs/6035440?gh_jid=6035440 you should grab 'flexport'
    const company = 'Bank of America';
    const companyId = await this.getOrCreateCompany(company, '', '', '', '', '', '', '', '');
    console.log(companyId);

    // return an object with title and description
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const title = $('.job-description-body__title').text().trim();
    const location = $('.locations__names').text().trim();
    const descriptionHtml = $('.job-description-body__internal').html();

    const turndownService = new TurndownService({
      headingStyle: 'atx', // Use ATX-style headings (e.g., # Heading)
      bulletListMarker: '-', // Use dashes for bullet lists
      codeBlockStyle: 'fenced', // Use fenced code blocks
      emDelimiter: '*', // Use asterisks for emphasis
      strongDelimiter: '**', // Use double asterisks for strong emphasis
    });

    const descriptionMarkdown = turndownService.turndown(descriptionHtml).trim();
    

    console.log({ url, companyId, title, description: descriptionMarkdown, location });
    return { url, companyId, title, description: descriptionMarkdown, location };
  }

  convertWorkdayLink(url) {
    try {
      // Parse the URL
      const parsedUrl = new URL(url);
      
      // Extract the company name and wd number
      const hostParts = parsedUrl.hostname.split('.');
      const company = hostParts[0];
      const wdNumber = hostParts[1].replace('wd', '');
      
      // Construct the standardized URL
      const standardizedUrl = `https://${company}.wd${wdNumber}.myworkdayjobs.com/wday/cxs/${company}/Careers/jobs`;
      
      return standardizedUrl;
    } catch (error) {
      console.error('Error converting Workday link:', error.message);
      return null;
    }
  }
  
  async grabWorkDayLinks(url) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
  
    // Enable request interception
    await page.setRequestInterception(true);
  
    let allJobs = [];
    let interceptedData = null;
  
    page.on('request', request => {
      if (request.url().includes('/jobs') && request.method() === 'POST') {
        request.continue();
      } else {
        request.continue();
      }
    });
  
    page.on('response', async response => {
      if (response.url().includes('/jobs') && response.request().method() === 'POST') {
        try {
          const data = await response.json();
          if (data && data.jobPostings) {
            interceptedData = data;
          }
        } catch (error) {
          console.error('Error parsing response:', error);
        }
      }
    });
  
    try {
      // Navigate to the page
      await page.goto(url, { waitUntil: 'networkidle0' });
  
      // Wait for the job postings data to be intercepted
      while (!interceptedData) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
  
      // Process the intercepted data
      const total = interceptedData.total;
      allJobs = interceptedData.jobPostings.map(job => ({
        ...job,
        externalPath: `${url.replace('/jobs', '')}${job.externalPath}`
      }));
  
      console.log(`Fetched ${allJobs.length} out of ${total} jobs`);
  
      // If there are more jobs to fetch, you may need to implement pagination here
      // This would involve clicking a "Load More" button or handling infinite scroll
  
      console.log('All job data fetched successfully:', allJobs);
      return allJobs;
    } catch (error) {
      console.error('Error fetching job data:', error.message);
      return null;
    } finally {
      await browser.close();
    }
  }

  async processC3AILink(url) {
    let browser;
    try {
    // Define the company
      const company = 'C3.ai';
      const companyId = await this.getOrCreateCompany(company, '', '', '', '', '', '', '', '');
      console.log(`Company ID: ${companyId}`);

      // Launch Puppeteer
      browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();

      // Optional: Set a user-agent to mimic a real browser
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/113.0.0.0 Safari/537.36');

      // Navigate to the URL and wait until the network is idle
      console.log(`Navigating to ${url}...`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // Introduce an explicit delay of 3 seconds to allow dynamic content to load
      console.log('Waiting for 3 seconds to ensure dynamic content loads...');
      await this.delay(3000);

      // Use Locators to wait for elements
      const titleLocator = page.locator('.app-title');
      await titleLocator.waitHand;
      const title = await titleLocator.textContent();
      console.log(`Title: ${title.trim()}`);

      const locationLocator = page.locator('.location');
      await locationLocator.wait();
      const location = await locationLocator.textContent();
      console.log(`Location: ${location.trim()}`);

      // Locate the description element
      const descriptionLocator = page.locator('div.page > div.section > div.layoutArea > div.column > div.page > div.section > div.layoutArea > div.column');
      await descriptionLocator.wait();
      const descriptionHtml = await descriptionLocator.evaluate(el => el.innerHTML);

      if (!descriptionHtml) {
        console.log('No description found, skipping...');
        return { skipped: true, reason: 'No description found' };
      }

      if (!this.isTechJob(title.trim())) { 
        console.log('Not a tech job, skipping...');
        return { skipped: true, reason: 'Not a tech job' };
      }

      // Convert HTML to Markdown
      const turndownService = new TurndownService({
        headingStyle: 'atx',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        emDelimiter: '*',
        strongDelimiter: '**',
      });

      const descriptionMarkdown = turndownService.turndown(descriptionHtml).trim();
      console.log('Description converted to Markdown.');

      // Return the extracted data
      return { url, companyId, title: title.trim(), description: descriptionMarkdown, location: location.trim() };

    } catch (error) {
      console.error(`Error processing URL ${url}:`, error);
      return { skipped: true, reason: 'Error occurred' };
    } finally {
      if (browser) {
        await browser.close();
        console.log('Browser closed.');
      }
    }
  }


  async processWorkDayJobLink(url) {
    // make a get request to the url it will reply with something in the format:
    /*
    {
  "jobPostingInfo": {
    "id": "79d7e6973b75100165f39588d4bf0001",
    "title": "PGIM Investments - IBD Regional Director, North Carolina",
    "jobDescription": "\u003Cp\u003EJob Classification:\u003C/p\u003ESales - Sales\u003Cp\u003E\u003C/p\u003E\u003Cp\u003E\u003C/p\u003E\u003Cp\u003E\u003Cb\u003E\u003Cspan\u003EWhat you will do\u003C/span\u003E\u003C/b\u003E\u003C/p\u003E\u003Cp\u003EThe External Wholesaler is responsible for representing PGIM through retail investment vehicles (mutual funds, separate accounts &amp; 401(k) platforms) to investment professionals and partner firm product coordinators.\u003C/p\u003E\u003Cp\u003E\u003C/p\u003E\u003Cp\u003EThe External Wholesaler will engage advisors/teams in several relationship building activities. These activities include: providing technical information on the products they represent, demonstrating a strong knowledge of the competitive landscape, financial markets and industry related topics. The External Wholesaler would also act as a consultant in the areas of practice management and portfolio construction.\u003C/p\u003E\u003Cp\u003E\u003C/p\u003E\u003Cp\u003E\u003Cb\u003EIn field responsibilities are to drive Prudential Investments separate account and mutual fund sales and improve retention of PGIM assets under management including\u003C/b\u003E\u003C/p\u003E\u003Cul\u003E\u003Cli\u003ERepresenting Prudential Investments mutual funds and separate accounts to advisors knowledgeably and effectively so that advisors can clearly identify the benefits of the products relative to its competitors.\u003C/li\u003E\u003C/ul\u003E\u003Cul\u003E\u003Cli\u003ESharing business building ideas and strategies with financial advisors.\u003C/li\u003E\u003Cli\u003EProviding expert perspective in client meetings.\u003C/li\u003E\u003Cli\u003EProviding technical information to advisors\u003C/li\u003E\u003Cli\u003EOffering and coordinating client marketing assistance to advisors (i.e., client and prospect seminars).\u003C/li\u003E\u003Cli\u003EWorking closely with other business partners to align activities and plans for the given region and its advisors\u003C/li\u003E\u003Cli\u003EDevelop collaborative quarterly business plans for their region around meeting each of the above objectives.\u003C/li\u003E\u003C/ul\u003E\u003Cp\u003E\u003C/p\u003E\u003Cp\u003E\u003Cb\u003E\u003Cspan\u003EWhat you will bring\u003C/span\u003E\u003C/b\u003E\u003C/p\u003E\u003Cul\u003E\u003Cli\u003EThe candidate must be motivated with strong territory management and selling skills, and the ability to drive to his/her objectives relatively autonomously.\u003C/li\u003E\u003Cli\u003EThe candidate should have 5-7 years of experience in the Investments industry, and 3-5 years of wholesaling experience.\u003C/li\u003E\u003Cli\u003EThe candidate will be required to travel extensively in the field, approximately 90% of the time.\u003C/li\u003E\u003Cli\u003ERequired licenses: Series 7 and Series 63 or 65.\u003C/li\u003E\u003C/ul\u003E\u003Cp\u003E\u003C/p\u003E\u003Cp\u003E\u003Cb\u003E\u003Cspan\u003EWhat we offer you \u003C/span\u003E\u003C/b\u003E\u003C/p\u003E\u003Cul\u003E\u003Cli\u003EMedical, dental, vision, life insurance and PTO (Paid Time Off)\u003C/li\u003E\u003Cli\u003ERetirement plans:401(k) plan with generous company match (up to 4%) and Company-funded pension plan\u003C/li\u003E\u003Cli\u003EWellness Programs to help you achieve your wellbeing goals, including up to $1,600 a year for reimbursement of items purchased to support personal wellbeing needs\u003C/li\u003E\u003Cli\u003EWork/Life Resources to help support topics such as parenting, housing, senior care, finances, pets, legal matters, education, emotional health, and career development.\u003C/li\u003E\u003Cli\u003ETuition Assistance to help finance traditional college enrollment, approved degrees, many accredited certificate programs, and industry designations.\u003C/li\u003E\u003C/ul\u003E\u003Cp\u003E\u003C/p\u003E\u003Cp\u003E\u003Cb\u003EAbout PGIM Investments\u003C/b\u003E\u003C/p\u003E\u003Cp\u003EPGIM Investments is a diversified distributor of asset management capabilities, with over 100 actively managed funds globally. We are dedicated to helping clients tackle their toughest investment challenges and base the foundation of our investment strategy around collaboration and innovation. Our leadership team welcomes new ideas and challenging the status-quo and are committed to developing talent for long-term success. \u003C/p\u003E\u003Cp\u003E\u003C/p\u003E\u003Cp\u003E\u003Cb\u003EA GLOBAL FIRM WITH A DIVERSE &amp; INCLUSIVE CULTURE\u003C/b\u003E\u003C/p\u003E\u003Cp\u003EAs the Global Asset Management business of Prudential, we’re always looking for ways to improve financial services. We’re passionate about making a meaningful impact - touching the lives of millions and solving financial challenges in an ever-changing world. We also believe talent is key to achieving our vision and are intentional about building a culture on respect and collaboration. When you join PGIM, you’ll unlock a motivating and impactful career – all while growing your skills and advancing your profession at one of the world’s leading global asset managers! If you’re not afraid to think differently and challenge the status quo, come and be a part of a dedicated team that’s investing in your future by shaping tomorrow today.\u003C/p\u003E\u003Cp\u003EAt PGIM, You Can!\u003C/p\u003E\u003Cp\u003E\u003C/p\u003E\u003Cp\u003E\u003C/p\u003E\u003Cp\u003E\u003C/p\u003E\u003Cp\u003E\u003C/p\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cdiv\u003E\u003Cp\u003E\u003Cspan\u003EPrudential Financial, Inc. of the United States is not affiliated with Prudential plc. which is headquartered in the United Kingdom.\u003C/span\u003E\u003C/p\u003E\u003Cp\u003E\u003C/p\u003E\u003Cp\u003E\u003Cspan\u003EPrudential is a multinational financial services leader with operations in the United States, Asia, Europe, and Latin America. Leveraging its heritage of life insurance and asset management expertise, Prudential is focused on helping individual and institutional customers grow and protect their wealth. The company&#39;s well-known Rock symbol is an icon of strength, stability, expertise and innovation that has stood the test of time. Prudential&#39;s businesses offer a variety of products and services, including life insurance, annuities, retirement-related services, mutual funds, asset management, and real estate services.\u003C/span\u003E\u003C/p\u003E\u003Cp\u003E\u003C/p\u003E\u003Cp\u003E\u003Cspan\u003EWe recognize that our strength and success are directly linked to the quality and skills of our diverse associates. We are proud to be a place where talented people who want to make a difference can grow as professionals, leaders, and as individuals. Visit \u003Ca href=\"http://www.prudential.com/\" target=\"_blank\"\u003Ewww.prudential.com\u003C/a\u003E to learn more about our values, our history and our brand.\u003C/span\u003E\u003C/p\u003E\u003Cp\u003E\u003C/p\u003E\u003Cp\u003E\u003Cspan\u003EPrudential is an equal opportunity employer. All qualified applicants will receive consideration for employment without regard to race, color, religion, national origin, ancestry, sex, sexual orientation, gender identity, national origin, genetics, disability, marital status, age, veteran status, domestic partner status , medical condition or any other characteristic protected by law. \u003C/span\u003E\u003C/p\u003E\u003Cp\u003E\u003C/p\u003E\u003Cp\u003E\u003Cspan\u003EThe Prudential Insurance Company of America, Newark, NJ and its affiliates.\u003C/span\u003E\u003C/p\u003E\u003Cp\u003E\u003C/p\u003E\u003Cp\u003E\u003Cspan\u003ENote that this posting is intended for individual applicants. Search firms or agencies should email Staffing at \u003Ca href=\"mailto:staffingagencies&#64;prudential.com\" target=\"_blank\"\u003E\u003Cu\u003E\u003Cspan\u003Estaffingagencies&#64;prudential.com\u003C/span\u003E\u003C/u\u003E\u003C/a\u003E for more information about doing business with Prudential.\u003C/span\u003E\u003C/p\u003E\u003Cp\u003E\u003C/p\u003E\u003Cp\u003E\u003Cspan\u003EPEOPLE WITH DISABILITIES:\u003Cbr /\u003EIf you need an accommodation to complete the application process, which may include an assessment, please email \u003C/span\u003E\u003Ca href=\"mailto:accommodations.hw&#64;prudential.com\" target=\"_blank\"\u003Eaccommodations.hw&#64;prudential.com\u003C/a\u003E.\u003C/p\u003E\u003Cp\u003E\u003C/p\u003E\u003Cp\u003E\u003Cspan\u003EPlease note that the above email is solely for individuals with disabilities requesting an accommodation.  If you are experiencing a technical issue with your application or an assessment, please email \u003C/span\u003E \u003Cspan\u003E\u003Ca href=\"mailto:careers.technicalsupport&#64;prudential.com\" target=\"_blank\"\u003E\u003Cspan\u003Ecareers.technicalsupport&#64;prudential.com\u003C/span\u003E\u003C/a\u003E\u003C/span\u003E \u003Cspan\u003E to request assistance.\u003C/span\u003E\u003C/p\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E",
    "location": "NC-Virtual Office",
    "postedOn": "Posted 16 Days Ago",
    "startDate": "2024-09-11",
    "timeType": "Full time",
    "jobReqId": "R-118647",
    "jobPostingId": "PGIM-Investments---IBD-Regional-Director--North-Carolina_R-118647-1",
    "jobPostingSiteId": "Careers",
    "country": {
      "descriptor": "United States of America",
      "id": "bc33aa3152ec42d4995f4791a106ed09"
    },
    "canApply": true,
    "posted": true,
    "includeResumeParsing": true,
    "jobRequisitionLocation": {
      "descriptor": "NC-Virtual Office",
      "country": {
        "descriptor": "United States of America",
        "id": "bc33aa3152ec42d4995f4791a106ed09",
        "alpha2Code": "US"
      }
    },
    "externalUrl": "https://pru.wd5.myworkdayjobs.com/Careers/job/NC-Virtual-Office/PGIM-Investments---IBD-Regional-Director--North-Carolina_R-118647-1",
    "questionnaireId": "095bc6d2e6db0101b58b3f616e600000",
    "secondaryQuestionnaireId": "666020109e0710019c47e39b43130000",
    "supplementaryQuestionnaireId": "72f882abbfd11001b1e02fc8cc580000"
  },
  "hiringOrganization": {
    "name": "072 PGIM Investments,LLC",
    "url": ""
  },
  "similarJobs": [],
  "userAuthenticated": false
}
  */

    const response = await axios.get(url);
    const data = response.data;
    console.log(data);
    const jobPostingInfo = data.jobPostingInfo;
    const title = jobPostingInfo.title;
    const location = jobPostingInfo.location;
    const date = jobPostingInfo.startDate;
    const descriptionHtml = jobPostingInfo.jobDescription;

    const hiringOrganization = data.hiringOrganization;


  }



  async processAbbVieLink (url) {
    // grab div.job__title and div.job__description from the page

    // get the company part of the url
    // https://job-boards.greenhouse.io/flexport/jobs/6035440?gh_jid=6035440 you should grab 'flexport'
    const company = 'AbbVie';
    const companyId = await this.getOrCreateCompany(company, '', '', '', '', '', '', '', '');
    console.log(companyId);

    // return an object with title and description
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const title = $('.header__text').text().trim();
    const location = $('.attrax-job-information-widget__freetext-field-value').text().trim();
    const descriptionHtml = $('.description-widget').html();

    const turndownService = new TurndownService({
      headingStyle: 'atx', // Use ATX-style headings (e.g., # Heading)
      bulletListMarker: '-', // Use dashes for bullet lists
      codeBlockStyle: 'fenced', // Use fenced code blocks
      emDelimiter: '*', // Use asterisks for emphasis
      strongDelimiter: '**', // Use double asterisks for strong emphasis
    });

    const descriptionMarkdown = turndownService.turndown(descriptionHtml).trim();
    
    return { url, companyId, title, description: descriptionMarkdown, location };
  }

  async processJobLink(link) {
    const url = typeof link === 'object' && link.url ? link.url : link;

    if (typeof url !== 'string' || !url.startsWith('http')) {
      console.error('Invalid URL:', url);
      return { error: 'Invalid URL' };
    }

    if (this.processedLinks.has(url)) {
      return { skipped: true, reason: 'Already processed' };
    }

    // check if link contains greenhouse.io
    if (url && url.includes('greenhouse.io')) {
      const jobData = await this.processGreenhouseJobLink(url);
      return jobData;
    } else if (url && url.includes('bankofamerica.com')) {
      const jobData = await this.processBoFALink(url);
      return jobData;
    } else if (url && url.includes('abbvie.com')) {
      const jobData = await this.processAbbVieLink(url);
      return jobData;
    } else if (url && url.includes('c3.ai')) {
      const jobData = await this.processC3AILink(url);
      return jobData;
    } else if (url && url.includes('lever.co')) {
      const jobData = await this.processLeverJobLink(url);
      return jobData;
    } else if (url && url.includes('myworkdayjobs.com')) {
      const jobData = await this.processWorkDayJobLink(url);
      return jobData;
    } else {
      console.error('Unsupported job board:', url);
      return { error: 'Unsupported job board' };
    }

    /*
    try {
      console.log('Processing job link:', url);

      // Attempt to fetch page content with axios
      let response;
      try {
        response = await axios.get(url, {
          timeout: 10000, // 10 seconds timeout
          headers: {
            'User-Agent': 'Mozilla/5.0',
          },
        });
      } catch (axiosError) {
        console.log('Axios fetch failed, falling back to Puppeteer:', axiosError.message);
        response = null;
      }

      let textContent = '';
      if (response && response.status === 200) {
        // Parse HTML with Cheerio
        const $ = cheerio.load(response.data);
        textContent = $('body').text().replace(/\s\s+/g, ' ').trim();

        // Check if the content is sufficient
        if (textContent.length < 500) {
          console.log('Content too short, possibly requires JavaScript rendering.');
          textContent = null;
        }
      }

      // If content is empty or insufficient, use Puppeteer
      if (!textContent) {
        // Attempt to fetch with a pre-rendering service before Puppeteer
        try {
          console.log('Attempting to fetch with rendertron...');
          const renderedHtml = await this.fetchWithRender(url);
          const $ = cheerio.load(renderedHtml);
          textContent = $('body').text().replace(/\s\s+/g, ' ').trim();

          if (textContent.length < 500) {
            console.log('Content still insufficient after rendertron, falling back to Puppeteer.');
            textContent = null;
          }
        } catch (renderError) {
          console.error('Rendertron fetch failed:', renderError.message);
          textContent = null;
        }
      }

      if (!textContent) {
        this.updateProgress({ currentAction: 'Launching browser' });
        const browser = await this.getBrowserInstance();
        const page = await browser.newPage();

        this.updateProgress({ currentAction: 'Loading page with Puppeteer' });
        await page.goto(url, { waitUntil: 'networkidle0' });

        this.updateProgress({ currentAction: 'Extracting content with Puppeteer' });
        textContent = await page.evaluate(() => {
          // Remove scripts and styles
          const scripts = document.getElementsByTagName('script');
          const styles = document.getElementsByTagName('style');
          for (const element of [...scripts, ...styles]) {
            element.remove();
          }
          return document.body.innerText.replace(/\s\s+/g, ' ').trim();
        });

        await page.close();
      }

      let extractedData;

      if (this.useGemini) {
        this.updateProgress({ currentAction: 'Using Gemini API' });
        extractedData = await this.useGeminiAPI(link, textContent);
        extractedData = this.validateAndCleanJobData(extractedData);
      } else {
        this.updateProgress({ currentAction: 'Using ChatGPT API' });
        extractedData = await this.useChatGPTAPI(link, textContent);
      }

      const companyId = await this.getOrCreateCompany(
        extractedData.company_name || '',
        extractedData.company_description || '',
        extractedData.company_location || '',
        extractedData.company_job_board_url || '',
        extractedData.company_industry || '',
        extractedData.company_size || '',
        extractedData.company_stock_symbol || '',
        extractedData.company_logo || '',
        extractedData.company_founded || null
      );
      extractedData.company_id = companyId;


      this.updateProgress({ currentAction: 'Saving processed link' });
      await this.saveProcessedLink(url);

      if (extractedData.skipped) {
        this.updateProgress({ currentAction: 'Skipped job' });
        return { skipped: true, title: extractedData.title, reason: extractedData.reason };
      }

      return extractedData;
    } catch (error) {
      console.error(`Error processing job link ${url}:`, error);
      throw error;
    }
      */
  }

  async getBrowserInstance() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
    return this.browser;
  }
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  getDefaultTechJobTitles() {
    return [
      'Software Engineer',
      'Data Scientist',
      'Product Manager',
      'DevOps Engineer',
      'Frontend Developer',
      'Backend Developer',
      'Full Stack Developer',
      'Machine Learning Engineer',
      'Cloud Architect',
      'Cybersecurity Analyst',
      'UX Designer',
      'Mobile Developer',
      'AI Engineer',
      'Blockchain Developer',
      'QA Engineer',
      'Data Engineer',
      'Systems Architect',
      'Network Engineer',
      'Database Administrator',
      'IT Project Manager'
    ];
  }

  async useGeminiAPI(link, textContent) {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = this.generatePrompt(link, textContent);
    const result = await model.generateContent(prompt);
    let response = await result.response;
    response = response.text();
    const cleanedResponse = response.replace(/`+/g, '').match(/\{.*\}/s)?.[0] || '';
    return JSON.parse(cleanedResponse);
  }

  async useChatGPTAPI_CompanyInfo(link, textContent) {
    const companyResponse = z.object({
      name: z.string(),
      description: z.string(),
      industry: z.string(),
      location: z.string(),
      size: z.string().nullable(),
      stock_symbol: z.string().nullable(),
      logo: z.string().nullable(),
      founded: z.string().nullable()
    });

    const maxCharacters = 200000;
    const truncatedTextContent = textContent.length > maxCharacters ? textContent.slice(0, maxCharacters) : textContent;
    
    const prompt = `
        From the job posting data at ${link}, please extract or provide the following information about the company:
          - name
          - description
          - industry
          - location (where the city is based out of: city, state)
          - size (estimated number of employees)
          - stock_symbol (nullable)
          - logo (usually default to the format of /src/<company-name>logo.png, do not include space in the company logo)
          - full date company was founded (datetime format, string)
          Provide the extracted information in JSON format.
          ${truncatedTextContent}
          `;
    try {
      const completion = await this.openai.beta.chat.completions.parse({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that extracts company information from text.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: zodResponseFormat(companyResponse, 'companyResponse')
      });

      const message = completion.choices[0]?.message;
      return message.parsed;
    } catch (error) {
      console.error('OpenAI API Error:', error.message);
      throw error;
    }
  }

  async verifyAndUpdateCompanyData() {
    const companies = await jobQueries.getCompanies();
    
    this.updateProgress({ 
      phase: 'Verifying and updating company data', 
      totalCompanies: companies.length,
      processedCompanies: 0
    });

    for (const [index, company] of companies.entries()) {
      if (company.id === 8) {
        console.log(`Skipping company with id 8: ${company.name}`);
        continue;
      }

      this.updateProgress({ 
        company: company.name, 
        processedCompanies: index + 1,
        currentAction: 'Verifying company data'
      });

      const missingFields = this.checkMissingFields(company);

      if (missingFields.length > 4) {
        this.updateProgress({ currentAction: 'Updating company data' });
        
        const prompt = this.generateCompanyPrompt({ name: company.name });
        let updatedData;

        try {
          if (this.useGemini) {
            updatedData = await this.useGeminiAPI(company.name, prompt);
          } else {
            updatedData = await this.useChatGPTAPI_CompanyInfo(company.name, prompt);
          }

          // Merge existing data with updated data
          const mergedData = { ...company, ...updatedData };
          console.log('Merged data:', mergedData);

          // Update company in the database
          await jobQueries.forceUpdateCompany(company.id, mergedData);

          console.log(`Updated company data for ${company.name}`);
        } catch (error) {
          console.error(`Error updating data for ${company.name}:`, error);
        }
      } else {
        console.log(`Company data for ${company.name} is complete`);
      }

    }

    this.updateProgress({ phase: 'Company data verification completed' });
  }

  checkMissingFields(company) {
    const requiredFields = [
      'name', 'location', 'description', 'industry', 'founded', 'size',
      'stock_symbol', 'company_stage', 'company_recent_news_sentiment',
      'company_sentiment', 'company_issues', 'company_engineer_choice',
      'company_website', 'twitter_username', 'company_linkedin_page'
    ];

    return requiredFields.filter(field => !company[field]);
  }


  async useChatGPTAPI(link, textContent) {
    const jobResponse = z.object({
      title: z.string(),
      company_name: z.string(),
      company_description: z.string(),
      company_location: z.string(),
      company_job_board_url: z.string(),
      company_industry: z.string(),
      company_size: z.string(),
      company_stock_symbol: z.string(),
      company_logo: z.string(),
      company_founded: z.string().nullable(),
      location: z.string(),
      salary: z.number(),
      salary_max: z.number(),
      experience_level: z.string(),
      skills: z.string(),
      tags: z.string(),
      description: z.string(),
      benefits: z.string(),
      additional_information: z.string(),
      PreferredQualifications: z.string(),
      MinimumQualifications: z.string(),
      Responsibilities: z.string(),
      Requirements: z.string(),
      NiceToHave: z.string(),
      Schedule: z.string(),
      HoursPerWeek: z.number(),
      H1BVisaSponsorship: z.boolean(),
      IsRemote: z.boolean(),
      EqualOpportunityEmployerInfo: z.string(),
      Relocation: z.boolean()
    });

    const maxCharacters = 200000;
    const truncatedTextContent = textContent.length > maxCharacters ? textContent.slice(0, maxCharacters) : textContent;
    
    const prompt = this.generatePrompt(link, truncatedTextContent);
    
    try {
      const completion = await this.openai.beta.chat.completions.parse({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that extracts job information from text.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: zodResponseFormat(jobResponse, 'jobResponse')
      });

      const message = completion.choices[0]?.message;
      const jobPosting = message.parsed;

      if (this.isTechJob(jobPosting.title)) {
        return jobPosting;
      } else {
        console.log(`Skipping non-tech job: ${jobPosting.title}`);
        return { skipped: true, title: jobPosting.title, reason: 'Non-tech job' };
      }
    } catch (error) {
      console.error('OpenAI API Error:', error.message);
      throw error;
    }
  }

  async useChatGPTAPI_CompanyInfo2(name, textContent) {
    const companyResponse = z.object({
      name: z.string(),
      description: z.string(),
      industry: z.string(),
      location: z.string(),
      size: z.string().nullable(),
      stock_symbol: z.string().nullable(),
      founded: z.string().nullable(),
      company_stage: z.string().nullable(),
      company_recent_news_sentiment: z.string().nullable(),
      company_sentiment: z.string().nullable(),
      company_issues: z.string().nullable(),
      company_engineer_choice: z.string().nullable(),
      company_website: z.string().nullable(),
      twitter_username: z.string().nullable(),
      company_linkedin_page: z.string().nullable()
    });
  
    const maxCharacters = 200000;
    const truncatedTextContent = textContent.length > maxCharacters ? textContent.slice(0, maxCharacters) : textContent;
    
    const prompt = this.generateCompanyPrompt({ name: name });
  
  
    try {
      const completion = await this.openai.beta.chat.completions.parse({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that extracts company information from text.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: zodResponseFormat(companyResponse, 'companyResponse')
      });
  
      const message = completion.choices[0]?.message;
      return message.parsed;
    } catch (error) {
      console.error('OpenAI API Error:', error.message);
      throw error;
    }
  }

  generateCompanyPrompt(companyContext) {
    return `
     Currently for the company ${companyContext.name}, please given all current information known on the company give the following information:
     - location (where the city is based out of: city, state),
     - description (description of the company and what their main products are),
     - industry (what industry or industries the company is in, comma-separated),
     - founded (year the company was founded),
     - size (estimated number of employees, can be a range or exact number, only give number like '1000' or '1000-5000'),
     - stock_symbol (nullable),
     - company_stage (if available, e.g., "Startup", "Scaleup", "Enterprise"),
     - company_recent_news_sentiment (if available, write a sentence or two about the recent news sentiment),
     - company_sentiment (if available, write a sentence or two about the general sentiment of the company),
     - company_issues (if available, write a sentence or two about the issues the company is facing),
     - company_engineer_choice (if available, write a sentence or two about why people choose to work at the company),
     - company_website (if available),
     - twitter_username (if available),
     - company_linkedin_page (if available)
     `;
  }

  generatePrompt(link, textContent) {
    this.updateProgress({ currentAction: 'Generating prompt' });
    return `
    IF THE JOB POSTING DATA IS NOT A JOB RELATED TO A COMPUTER SCIENCE, MATHEMATICS, OR ENGINEERING FIELD, PLEASE SKIP THIS JOB POSTING.
      Please extract the following information from this job posting data: ${textContent}
      - title (e.g., Software Engineer, Data Analyst, include if there is a specific team or project in the title like :'Software Engineer, Frontend'. if the title is not something related to computer science or software engineering, please DO NOT include it)
      - company_name NVARCHAR(50) (as simple as possible and you can tell the company name from the job posting link: ${link})
      - company_description (blank)
      - company_location (blank)
      - company_job_board_url (the url of the job careers page if you can get it, for example: 'https://careers.micron.com/careers?pid=25250316&domain=micron.com&sort_by=relevance' -> 'https://careers.micron.com/careers')
      - company_industry (blank)
      - company_size (blank)
      - company_stock_symbol (blank)
      - company_logo (blank)
      - company_founded (blank)
      - location (City, State(full name), Country(full name), if remote N/A)
      - salary (integer only, ALWAYS ATTEMPT TO CONVERT TO USD USING A CURRENT CONVERSION RATE no currency symbol, no matter what format the salary in (hourly, monthly, weekly) convert to yearly salary, if none present 0)
      - salary_max (integer only, ALWAYS ATTEMPT TO CONVERT TO USD USING A CURRENT CONVERSION RATE, no currency symbol, no matter what format the salary in (hourly, monthly, weekly) convert to yearly salary, if none present 0)
      - experience_level ("Internship", "Entry Level", "Junior", "Mid Level", "Senior", "Lead" or "Manager" only)
      - skills (6-10 skills, required skills for the job that would be listed in the job posting, as a comma-separated list)
      - tags (at least 10, these should be different from skills and are things commonly searched related to the job. e.g., "remote", "healthcare", "startup" as a comma-separated list)
      - description (write this in the format of "<company name> is looking for a" try to take up to 3 paragraphs from the original source)
      - benefits (as a comma-separated list) 
      - additional_information (blank if nothing detected in the job posting, otherwise provide any additional information that you think is relevant to the job posting)
      - PreferredQualifications (if available)
      - MinimumQualifications (if available)
      - Responsibilities (responsibilities of the job)
      - Requirements (requirements of the job)
      - NiceToHave (nice to have skills or experience)
      - Schedule (assume monday to friday, 9am to 5pm, if not specified, default to this)
      - HoursPerWeek (integer only, this can be defaulted to 40 for full-time, and 20 for part-time. If not specified, default to 40)
      - H1BVisaSponsorship BIT (assume no if not specified)
      - IsRemote BIT (if the job location is remote or n/a then assume yes)
      - EqualOpportunityEmployerInfo NVARCHAR(MAX) (if available, attempt to give the companie's equal opportunity employer information)
      - Relocation BIT
      Provide the extracted information in JSON format.
    `;
  }

  validateAndCleanJobData(data) {
    this.updateProgress({ currentAction: 'Validating and cleaning job data' });
    return {
      title: data.title || '',
      company_name: data.company_name || '',
      company_description: data.company_description || '',
      company_location: data.company_location || '',
      company_job_board_url: data.company_job_board_url || '',
      company_industry: data.company_industry || '',
      company_size: data.company_size || '',
      company_stock_symbol: data.company_stock_symbol || '',
      company_logo: data.company_logo || '',
      company_founded: data.company_founded || null,
      location: data.location || '',
      salary: parseInt(data.salary) || 0,
      salary_max: parseInt(data.salary_max) || 0,
      experience_level: data.experience_level || '',
      skills: Array.isArray(data.skills)
        ? data.skills.join(',')
        : typeof data.skills === 'string'
          ? data.skills
          : '',
      tags: Array.isArray(data.tags)
        ? data.tags.join(',')
        : typeof data.tags === 'string'
          ? data.tags
          : '',
      description: data.description || '',
      benefits: Array.isArray(data.benefits)
        ? data.benefits.join(',')
        : typeof data.benefits === 'string'
          ? data.benefits
          : '',
      additional_information: data.additional_information || '',
      PreferredQualifications: data.PreferredQualifications || '',
      MinimumQualifications: data.MinimumQualifications || '',
      Responsibilities: data.Responsibilities || '',
      Requirements: data.Requirements || '',
      NiceToHave: data.NiceToHave || '',
      Schedule: data.Schedule || '',
      HoursPerWeek: parseInt(data.HoursPerWeek) || 0,
      H1BVisaSponsorship: data.H1BVisaSponsorship === true ? 1 : 0,
      IsRemote: data.IsRemote === true ? 1 : 0,
      EqualOpportunityEmployerInfo: data.EqualOpportunityEmployerInfo || '',
      Relocation: data.Relocation === true ? 1 : 0,
    };
  }

  async cleanJobInfo(jobInfo) {
    // function to prompt gpt using the data gathered from linkedin posting
    const prompt = this.generatePrompt(jobInfo.applicationLink, JSON.stringify(jobInfo));
    const response = await this.useChatGPTAPI(jobInfo.applicationLink, prompt);
    const validated = this.validateAndCleanJobData(response);
    return validated;
  }

  async searchTechJobOnLinkedIn(jobTitle, location='United States') {
    const linkedInSearchUrl = `https://www.linkedin.com/jobs/search?keywords=${jobTitle.split(' ').join('%20')}&location=${location.split(' ').join('%20')}&geoId=&trk=public_jobs_jobs-search-bar_search-submit&original_referer=`;
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  
    await page.goto(linkedInSearchUrl, { waitUntil: 'networkidle2' });
  
    // Function to scroll the page
    const scrollPage = async () => {
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second after each scroll
    };
  
    // Scroll 4-6 times with random intervals
    const scrollTimes = Math.floor(Math.random() * 3) + 4; // Random number between 4 and 6
    for (let i = 0; i < scrollTimes; i++) {
      await scrollPage();
      await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 500)); // Random wait between 500ms and 1000ms
    }
  
    // Wait for new job listings to load after scrolling
    await new Promise(resolve => setTimeout(resolve, 2000));
  
    const jobs = await page.evaluate(() => {
      const jobElements = document.querySelectorAll('.base-card');
      const jobPostings = [];
      
      jobElements.forEach(element => {
        const titleElement = element.querySelector('.base-search-card__title');
        const companyElement = element.querySelector('.base-search-card__subtitle');
        const locationElement = element.querySelector('.job-search-card__location');
        const dateElement = element.querySelector('.job-search-card__listdate');
        const linkElement = element.querySelector('a.base-card__full-link');


        jobPostings.push({
          link: linkElement ? linkElement.href : null,
          title: titleElement ? titleElement.textContent.trim() : null,
          company: companyElement ? companyElement.textContent.trim() : null,
          location: locationElement ? locationElement.textContent.trim() : null,
          date: dateElement ? dateElement.textContent.trim() : null
        });
      });
      
      return jobPostings;
    });
  
    await browser.close();
    return jobs;
  }

  async getJobInfoFromLinkedIn(linkedInUrl) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
  
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.goto(linkedInUrl, { waitUntil: 'networkidle2' });
  
    await page.waitForSelector('#main-content', { timeout: 10000 });
  
    const jobInfo = await page.evaluate(async () => {
      const titleElement = document.querySelector('.top-card-layout__title');
      const companyElement = document.querySelector('.topcard__org-name-link');
      const locationElement = document.querySelector('.topcard__flavor--bullet');
      const descriptionElement = document.querySelector('.description__text');
      const additionalInfoElement = document.querySelector('.description__job-criteria-list');
  
      // Function to click the apply button and get the application link
      const getApplicationLink = async () => {
        const applyButton = document.querySelector('button.sign-up-modal__outlet[data-tracking-control-name="public_jobs_apply-link-offsite_sign-up-modal"]');
        console.log(applyButton);
        if (applyButton) {
          applyButton.click();
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for popup to appear
          const linkElement = document.querySelector('.sign-up-modal__company_webiste a');
          console.log(linkElement);
          return linkElement ? linkElement.href : null;
        }
        return null;
      };
  
      const getSimilarJobs = () => {
        const similarJobs = [];
        const similarJobElements = document.querySelectorAll('.similar-jobs__list .base-card');
        similarJobElements.forEach(element => {
          const title = element.querySelector('.base-main-card__title')?.textContent.trim();
          const company = element.querySelector('.base-main-card__subtitle')?.textContent.trim();
          const location = element.querySelector('.main-job-card__location')?.textContent.trim();
          const salary = element.querySelector('.main-job-card__salary-info')?.textContent.trim();
          const link = element.querySelector('a.base-card__full-link')?.href;
          const postedTime = element.querySelector('.main-job-card__listdate')?.textContent.trim();
          similarJobs.push({ title, company, location, salary, link, postedTime });
        });
        return similarJobs;
      };
  
  
      const getPeopleAlsoViewed = () => {
        const peopleAlsoViewed = [];
        const peopleAlsoViewedElements = document.querySelectorAll('.people-also-viewed__list .base-card');
        peopleAlsoViewedElements.forEach(element => {
          const title = element.querySelector('.base-aside-card__title')?.textContent.trim();
          const company = element.querySelector('.base-aside-card__subtitle')?.textContent.trim();
          const location = element.querySelector('.aside-job-card__location')?.textContent.trim();
          const salary = element.querySelector('.aside-job-card__salary-info')?.textContent.trim();
          const link = element.querySelector('a.base-card__full-link')?.href;
          peopleAlsoViewed.push({ title, company, location, salary, link });
        });
        return peopleAlsoViewed;
      };
  
      const applicationLink = await getApplicationLink();
  
      // Clean up the description
      const cleanDescription = (description) => {
        if (!description) return null;
        // Remove "Show more" and "Show less" texts and surrounding whitespace
        return description.replace(/\s*Show (more|less)\s*/g, '').trim();
      };
  
      return {
        title: titleElement ? titleElement.textContent.trim() : null,
        company: companyElement ? companyElement.textContent.trim() : null,
        location: locationElement ? locationElement.textContent.trim() : null,
        description: cleanDescription(descriptionElement ? descriptionElement.textContent : null),
        additional: additionalInfoElement ? additionalInfoElement.textContent.trim() : null,
        applicationLink,
        similarJobs: getSimilarJobs(),
        peopleAlsoViewed: getPeopleAlsoViewed()
      };
    });
  
    // Resolve the external link
    if (jobInfo.applicationLink) {
      jobInfo.applicationLink = await this.getRedirectedUrl(jobInfo.applicationLink);
    }
  
    await browser.close();
    return jobInfo;
  }

  async getRedirectedUrl(url) {
    const browser = await puppeteer.launch({
      headless: 'true',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  
    try {
      const page = await browser.newPage();
      
      // Set a user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Enable request interception
      await page.setRequestInterception(true);
      
      // Abort all resource requests except for document
      page.on('request', (request) => {
        if (request.resourceType() !== 'document') {
          request.abort();
        } else {
          request.continue();2;
        }
      });
  
      // Navigate to the URL and wait for the network to be idle
      await page.goto(url, { waitUntil: 'networkidle0' });
  
      // Get the final URL after all redirects
      const finalUrl = page.url();
  
      return finalUrl;
    } catch (error) {
      console.error('Error occurred while getting redirected URL:', error);
      return url; // Return original URL if there's an error
    } finally {
      await browser.close();
    }
  }

  async crawlLinkedIn() {
    const jobTitles = [
      'Software Engineer', 'Data Analyst', 'Web Developer', 'System Architect',
      'Network Security Specialist', 'Database Administrator', 'Mobile App Developer',
      'Project Manager', 'QA Engineer', 'Java Developer', 'Python Developer',
      'JavaScript Developer', 'Game Developer', 'Blockchain Developer',
      'DevOps Engineer', 'Cloud Architect', 'UI/UX Designer', 'Machine Learning Engineer',
      'Full Stack Developer', 'Frontend Developer', 'Backend Developer'
    ];
  
    const stateMappings = {
      'United States': 'US', 'California': 'US-CA', 'New York': 'US-NY', 'Texas': 'US-TX',
      'Florida': 'US-FL', 'Illinois': 'US-IL', 'Pennsylvania': 'US-PA', 'Ohio': 'US-OH',
    };
  
    const getRandomElement = (array) => array[Math.floor(Math.random() * array.length)];
  
    let allJobLinks = [];
    const batchSize = 250;
    const createdJobs = [];

    this.updateProgress({ currentAction: 'Collecting job links' });
  
    // Step 1: Collect job links
    while (allJobLinks.length < batchSize) {
      const randomJobTitle = getRandomElement(jobTitles);
      const randomLocation = getRandomElement(Object.keys(stateMappings));
  
      console.log(`Searching for: ${randomJobTitle} in ${randomLocation}`);
      try {
        const jobs = await this.searchTechJobOnLinkedIn(randomJobTitle, randomLocation);
        allJobLinks = allJobLinks.concat(jobs.map(job => job.link));
        console.log(`Found ${jobs.length} jobs for ${randomJobTitle} in ${randomLocation}`);
        this.updateProgress({ totalJobs: allJobLinks.length });
  
        const randomTimeout = Math.floor(Math.random() * 4000) + 1000;
        await new Promise(resolve => setTimeout(resolve, randomTimeout));
      } catch (error) {
        console.error(`Error searching for ${randomJobTitle} in ${randomLocation}:`, error);
      }
    }

    this.updateProgress({ currentAction: 'Processing job links' });
  
    console.log(`Total job links collected: ${allJobLinks.length}`);
  
    // Step 2: Scrape job details and create job postings
    for (const link of allJobLinks) {
      try {
        this.updateProgress({ currentAction: 'Processing job details' });
        console.log(`Scraping job details from: ${link}`);
        const jobInfo = await this.getJobInfoFromLinkedIn(link);
        const applicationLink = jobInfo.applicationLink ? jobInfo.applicationLink : link;
        
        const cleanedJobInfo = await this.useChatGPTAPI(applicationLink, JSON.stringify(jobInfo));
        this.updateProgress({ currentAction: 'Validating and cleaning job data' });
        
        if (cleanedJobInfo.skipped) {
          this.updateProgress({ currentAction: 'Skipped job' });
          console.log(`Skipping non-tech job: ${cleanedJobInfo.title}`);
          continue;
        }
        
        const validatedJobData = this.validateAndCleanJobData(cleanedJobInfo);
        
        // Get or create company
        this.updateProgress({ currentAction: 'Getting or creating company object' });
        const companyId = await this.getOrCreateCompany(
          validatedJobData.company_name || jobInfo.company,
          validatedJobData.company_description || jobInfo.company,
          validatedJobData.company_location || jobInfo.location,
          validatedJobData.company_job_board_url || '',
          validatedJobData.company_industry || '',
          validatedJobData.company_size || '',
          validatedJobData.company_stock_symbol || '',
          validatedJobData.company_logo || '',
          validatedJobData.company_founded || null
        );
        
        // Create job posting
        this.updateProgress({ currentAction: 'Creating job posting' });
        await this.createJobPosting(validatedJobData, companyId, applicationLink);
        
        createdJobs.push(validatedJobData);
        console.log(`Created job posting: ${validatedJobData.title}`);
  
        // Add similar jobs and "people also viewed" jobs to the list for scraping
        const additionalLinks = [
          ...jobInfo.similarJobs.map(job => job.link),
          ...jobInfo.peopleAlsoViewed.map(job => job.link)
        ];
  
        allJobLinks = [...new Set([...allJobLinks, ...additionalLinks])];
      } catch (error) {
        this.updateProgress({ currentAction: 'Error processing job' });
        console.error(`Error processing job from ${link}:`, error);
      }
  
      if (createdJobs.length >= batchSize) {
        break;  // Stop processing if we have created enough job postings
      }
    }
  
    console.log(`Total job postings created: ${createdJobs.length}`);
  
    return createdJobs;
  }

  async getOrCreateCompany(companyName, companyDescription, companyLocation, companyJobBoardUrl, companyIndustry, companySize, companyStockSymbol, companyLogo, companyFounded) {
    try {
      // First, try to get the company by name
      let company = await jobQueries.getCompanyIdByName(companyName);
      
      if (company) {
        console.log(`Found existing company: ${companyName}`);
        return company.id;
      } else {
        console.log(`Company not found. Creating new company: ${companyName}`);
        // If the company doesn't exist, create it
        let newCompany = await jobQueries.createCompany(
          companyName,
          companyLogo,
          companyLocation,
          companyJobBoardUrl,
          companyDescription,
          companyIndustry,
          companySize,
          companyStockSymbol,
          companyFounded
        );

        return newCompany.id;
      }
    } catch (error) {
      console.error(`Error in getOrCreateCompany for ${companyName}:`, error);
      throw error;
    }
  }

  async createJobPosting(jobData, companyId, link) {
    this.updateProgress({ currentAction: 'Creating job posting' });
  
    const fields = [
      jobData.title,
      jobData.salary,
      jobData.experience_level,
      jobData.location,
      jobData.tags,
      jobData.description,
      jobData.salary_max,
      jobData.skills,
      jobData.benefits,
      jobData.additional_information,
      jobData.PreferredQualifications,
      jobData.MinimumQualifications,
      jobData.Responsibilities,
      jobData.Requirements,
      jobData.NiceToHave,
      jobData.Schedule,
      jobData.HoursPerWeek,
      jobData.H1BVisaSponsorship,
      jobData.IsRemote,
      jobData.EqualOpportunityEmployerInfo,
      jobData.Relocation,
      jobData.employmentType
    ];

    const sanitizeField = (field) => {
      if (typeof field === 'string') {
        return sanitizeHtml(field, {
          allowedTags: [], // Disallow all HTML tags
          allowedAttributes: {}, // Disallow all HTML attributes
          // Optionally, you can allow specific tags or attributes
        });
      }
      return field;
    };
  
    const missingFieldsCount = fields.filter(field => !field).length;
    const isProcessed = missingFieldsCount > 6 ? '0' : '1';
  
    await jobQueries.createJobPosting(
      sanitizeField(jobData.title),
      jobData.salary || 0,
      jobData.experience_level || '',
      jobData.location || '',
      new Date(),
      companyId || null,
      link || '',
      null, // expiration_date
      jobData.tags ? jobData.tags.split(',') : [],
      sanitizeField(jobData.description) || '',
      jobData.salary_max || null,
      '1', // recruiter_id (add this line)
      jobData.skills ? jobData.skills.split(',') : [],
      jobData.benefits ? jobData.benefits.split(',') : [],
      jobData.additional_information || '',
      jobData.PreferredQualifications || '',
      jobData.MinimumQualifications || '',
      jobData.Responsibilities || '',
      jobData.Requirements || '',
      jobData.NiceToHave || '',
      jobData.Schedule || '',
      jobData.HoursPerWeek || 0,
      jobData.H1BVisaSponsorship || 0,
      jobData.IsRemote || 0,
      jobData.EqualOpportunityEmployerInfo || '',
      jobData.Relocation || 0,
      isProcessed,
      jobData.employmentType || ''
    );
  
    this.updateProgress({ processedJobs: this.progress.processedJobs + 1 });
  }

  getLinkedInSearchTerms(processedJobTitles) {
    const defaultTerms = this.getDefaultTechJobTitles();
    return Array.from(new Set([...processedJobTitles, ...defaultTerms]));
  }


  async processJobLinks(links, companyId, isLinkedIn = false) {
    const concurrencyLimit = 10; // Adjust based on your system's capability
    const processingQueue = [];
    
    for (const link of links) {
      const jobData = await this.processJobLinkWithRetry(link);
      console.log(jobData);
      if (jobData && !jobData.error && !jobData.skipped) {
        console.log('Creating job posting:', jobData.title);  
        if (this.isTechJob(jobData.title))
          return this.createJobPosting(jobData, companyId, link.url || link);
      }
    }
  }
  

  async processLinkedInJob(jobData) {
    if (this.processedLinks.has(jobData.url)) {
      console.log('LinkedIn job already processed:', jobData.url);
      return { skipped: true, title: jobData.title, reason: 'Already processed' };
    }
  
    try {
      console.log('Processing LinkedIn job:', jobData.url);
      const response = await this.makeRequest(jobData.url);
      const $ = cheerio.load(response.data);
  
      const extractedData = {
        title: $('.job-details-jobs-unified-top-card__job-title').text().trim(),
        company_name: $('.job-details-jobs-unified-top-card__company-name').text().trim(),
        location: $('.job-details-jobs-unified-top-card__bullet').first().text().trim(),
        job_type: $('.job-details-jobs-unified-top-card__job-insight:contains("Internship")').text().trim(),
        salary_range: $('.job-details-jobs-unified-top-card__job-insight:contains("$")').text().trim(),
        description: $('.jobs-description__content').text().trim(),
        skills: $('.job-details-how-you-match-card__skills-item-subtitle').map((i, el) => $(el).text().trim()).get().join(', '),
        company_details: {
          size: $('.job-details-jobs-unified-top-card__job-insight:contains("employees")').text().trim(),
          industry: $('div.t-14:contains("Technology, Information and Internet")').first().text().trim()
        },
        application_info: {
          total_applicants: $('.job-details-jobs-unified-top-card__applicant-count').text().trim(),
          post_date: $('time').attr('datetime')
        },
        benefits: $('.jobs-description__content ul li').map((i, el) => $(el).text().trim()).get().join(', ')
      };
  
      // Extract qualifications
      $('.jobs-description__content h3').each((i, el) => {
        const header = $(el).text().trim().toLowerCase();
        const content = $(el).next('ul').find('li').map((i, li) => $(li).text().trim()).get().join('; ');
        
        if (header.includes('qualifications')) {
          extractedData.qualifications = content;
        } else if (header.includes('responsibilities')) {
          extractedData.responsibilities = content;
        }
      });
  
      // Check if it's a tech job
      if (this.isTechJob(extractedData.title)) {
        const processedData = this.useGemini ? 
          await this.useGeminiAPI(jobData.url, JSON.stringify(extractedData)) :
          await this.useChatGPTAPI(jobData.url, JSON.stringify(extractedData));
  
        await this.saveProcessedLink(jobData.url);
        return this.validateAndCleanJobData(processedData);
      } else {
        console.log(`Skipping non-tech job: ${extractedData.title}`);
        return { skipped: true, title: extractedData.title, reason: 'Non-tech job' };
      }
    } catch (error) {
      console.error(`Error processing LinkedIn job ${jobData.url}:`, error);
      throw error;
    }
  }

  async searchAdditionalJobBoards(companyName) {
    const jobBoards = [];
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(companyName + ' careers')}`;

    try {
      const response = await this.makeRequest(searchUrl);
      const $ = cheerio.load(response.data);

      $('a').each((index, element) => {
        const href = $(element).attr('href');
        if (href) {
          for (const platform of this.jobBoardPlatforms) {
            if (href.includes(platform)) {
              jobBoards.push(href);
              break;
            }
          }
        }
      });

      // Search for company's own career page
      $('a').each((index, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().toLowerCase();
        if (href && (text.includes('career') || text.includes('job'))) {
          jobBoards.push(href);
        }
      });
    } catch (error) {
      console.error(`Error searching additional job boards for ${companyName}:`, error);
    }

    return [...new Set(jobBoards)]; // Remove duplicates
  }

  async updateJobPostings() {
    const companies = await jobQueries.getCompanies();

    this.updateProgress({ 
      phase: 'Processing job boards', 
      totalCompanies: companies.length
    });
    

    // Phase 1: Process regular job boards and search for additional career pages
    for (const [index, company] of companies.entries()) {
      const existingJobPostings = await jobQueries.getAllCompanyJobLinks();
      this.updateProgress({ 
        company: company.name, 
        processedCompanies: index + 1,
        currentAction: 'Collecting job links'
      });

      try {
        if (company.job_board_url) {
          const result = await this.collectJobLinks(company);
          // filter out existing job postings
          const newJobPostings = [...result.links].filter(link => 
            !existingJobPostings.some(job => job.link === link.url)
          );
          console.log(`New jobs for ${company.name} (${company.job_board_url}):`, newJobPostings);
          this.updateProgress({ 
            totalJobs: newJobPostings.length,
            currentAction: 'Processing job links'
          });

          console.log('Processing job links:', newJobPostings);
          await this.processJobLinks(newJobPostings, company.id);
        }
      } catch (error) {
        console.error(`Error processing job links for ${company.name}:`, error);
      }
    }
  }

  async start() {

    await this.init();


    await this.updateJobPostings();
    /*
    await this.collectJobLinksFromSimplify();

    await this.verifyAndUpdateCompanyData();

    const companies = await jobQueries.getCompanies();

    this.updateProgress({ 
      phase: 'Processing job boards', 
      totalCompanies: companies.length
    });
    

    // Phase 1: Process regular job boards and search for additional career pages
    for (const [index, company] of companies.entries()) {
      this.updateProgress({ 
        company: company.name, 
        processedCompanies: index + 1,
        currentAction: 'Collecting job links'
      });

      if (company.job_board_url) {
        const result = await this.collectJobLinks(company);
        this.updateProgress({ 
          totalJobs: result.links.length,
          currentAction: 'Processing job links'
        });
        await this.processJobLinks(result.links, company.id);
      }
    }

    this.updateProgress({ 
      phase: 'LinkedIn Crawler',
      company: '',
      processedCompanies: 0,
      totalJobs: 0,
      processedJobs: 0
    });
    
    // Phase 2: Process LinkedIn jobs
    let linkedInJobs = [];
    while (linkedInJobs.length < 5000) {
      const linkedInAddedJobs = await this.crawlLinkedIn();
      linkedInJobs = linkedInJobs.concat(linkedInAddedJobs);
    }

    await this.closeBrowser();
    this.updateProgress({ phase: 'Cleaning job postings' });
    await this.removeDuplicateJobs();


    this.updateProgress({ phase: 'Completed' });
    */
  }
}

module.exports = JobProcessor;