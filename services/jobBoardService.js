const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const { zodResponseFormat } = require('openai/helpers/zod');
const { z } = require('zod');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const EventEmitter = require('events');
const path = require('path');
const jobQueries = require('../queries/jobQueries');

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
    this.DELAY_BETWEEN_REQUESTS = 3000; 
    this.DELAY_BETWEEN_SEARCHES = 10000;
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

  async removeDuplicateJobs() {
    try {
      const duplicateJobIds = await jobQueries.getDuplicateJobPostings();
      const batchSize = 5; 

      this.updateProgress({
        phase: 'Removing duplicate jobs',
        totalJobs: duplicateJobIds.length,
        processedJobs: 0,
        currentAction: 'Deleting duplicate jobs'
      });
  
      for (let i = 0; i < duplicateJobIds.length; i += batchSize) {
        const batch = duplicateJobIds.slice(i, i + batchSize);
        const deletePromises = batch.map(job => {
          const jobId = job.id;
          return jobQueries.automatedDeleteJob(jobId);

        });
  
        await Promise.all(deletePromises);
        this.updateProgress({ processedJobs: i + batch.length });
      }
  
    } catch (error) {
      console.error('Error removing duplicate jobs:', error);
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
    const techKeywords = [
      'software', 'developer', 'programmer', 'data', 'analyst', 'scientist', 'systems', 'systems administrator', 'systems engineer', 'systems architect', 'cloud engineer', 'cloud admin',
      'information technology', 'web', 'frontend', 'backend', 'full stack',
      'devops', 'cloud', 'network', 'security', 'database', 'machine learning',
      'ai', 'artificial intelligence', 'qa engineer', 'ui designer', 'ux/ui', 'quality assurance',
      'product manager', 'scrum master', 'agile', 'systems', 
      'infrastructure', 'mobile developer', 'ios developer', 'android', 'cybersecurity', 'blockchain', 'robotics', 'automation', 'sre', 'reliability', 'architect',
      'engineering', 'java', 'python', 'javascript', 'c++', 'ruby', 'php', 'project manager', 'program manager', 
      'scala', 'typescript', 'sql', 'nosql', 'azure', 'machine learning', 'data science', 'data engineer', 'data analyst', 'data visualization',
      'cloud engineer', 'cloud architect', 'cloud security', 'network engineer', 'network security', 'database administrator', 'database developer',
      'devops engineer', 'site reliability engineer', 'security engineer', 'security analyst', 'security architect', 'frontend developer', 'backend developer',
      'full stack developer', 'mobile developer', 'ios developer', 'android developer', 'cybersecurity analyst', 'cybersecurity engineer', 'frontend engineer',
      'backend engineer', 'full stack engineer', 'mobile engineer', 'ios engineer', 'android engineer', 'qa engineer', 'quality assurance engineer',
      'ux designer', 'ui designer', 'product manager', 'scrum master', 'agile coach', 'tech lead', 'systems engineer', 'infrastructure engineer',
      'mobile architect', 'ios architect', 'android architect', 'cybersecurity architect', 'front-end', 'gameplay engineer', 'game engineer', 'analytics engineer', 'graphics engineer', 'game designer', 'research engineer', 
    ];
    
    const lowercaseTitle = title.toLowerCase();
    return techKeywords.some(keyword => lowercaseTitle.includes(keyword));
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
    return axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.82 Safari/537.36'
      }
    });
  }

  async collectJobLinks(company) {
    const jobBoardUrl = company.job_board_url;
    const allLinks = new Set();
    let maxPages = 15;

    try {
      if (jobBoardUrl.includes('linkedin.com')) {
        await this.searchLinkedInJobs(allLinks);
      } else {
        const firstPageResponse = await this.makeRequest(jobBoardUrl);
        const $firstPage = cheerio.load(firstPageResponse.data);
        
        if (jobBoardUrl.includes('linkedin.com')) {
          const paginationText = $firstPage('.jobs-search-pagination__page-state').text().trim();
          const match = paginationText.match(/Page \d+ of (\d+)/);
          if (match) {
            maxPages = Math.min(parseInt(match[1], 10), 15);
          }
        }

        for (let page = 1; page <= maxPages; page++) {
          const pageUrl = this.getPageUrl(jobBoardUrl, page);
          console.log(`Scraping page ${page} of ${maxPages}: ${pageUrl}`);

          const response = await this.makeRequest(pageUrl);
          const $ = cheerio.load(response.data);
          const pageLinks = await this.extractJobLinks($, pageUrl);
          
          pageLinks.forEach(link => allLinks.add(link));

          if (!this.hasNextPage($, pageUrl)) {
            console.log(`No more pages found after page ${page}`);
            break;
          }

          await this.delay(this.DELAY_BETWEEN_REQUESTS);
        }
      }

      console.log(`Collected ${allLinks.size} job links from ${jobBoardUrl}`);
      return { companyId: company.id, links: Array.from(allLinks) };
    } catch (error) {
      console.error(`Error collecting job links from ${jobBoardUrl}:`, error);
      return { companyId: company.id, links: [] };
    }
  }

  getPageUrl(baseUrl, page) {
    const url = new URL(baseUrl);
    
    if (baseUrl.includes('linkedin.com')) {
      url.searchParams.set('start', (page - 1) * 25);
    } else if (baseUrl.includes('ashbyhq.com')) {
      url.searchParams.set('page', page);
    } else if (baseUrl.includes('myworkday.com')) {
      url.searchParams.set('page', page);
    } else {
      url.searchParams.set('page', page);
    }

    return url.toString();
  }

  async extractJobLinks($, baseUrl) {
    const links = new Set();

    if (baseUrl.includes('linkedin.com')) {
      $('.job-card-container').each(async (index, element) => {
        const linkElement = $(element).find('.job-card-container__link');
        const link = linkElement.attr('href');
        const title = linkElement.text().trim();

        if (this.isTechJob(title)) {
          const jobUrl = new URL(link, baseUrl).href;
          const applyType = await this.checkLinkedInApplyType(jobUrl);
          links.add({ url: jobUrl, applyType });
        }
      });
    } else {
      $('a[href*="job"], a[href*="career"], a[href*="position"]').each((index, element) => {
        const link = $(element).attr('href');
        const title = $(element).text().toLowerCase();
        if (this.isTechJob(title)) {
          links.add(new URL(link, baseUrl).href);
        }
      });
    }

    return links;
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

  hasNextPage($, currentUrl) {
    if (currentUrl.includes('linkedin.com')) {
      return $('.jobs-search-pagination__button--next').length > 0;
    } else {
      return $('a[href]:contains("Next"), a[href]:contains("»"), a[rel="next"]').length > 0;
    }
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
      return await this.processJobLink(link);
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

  async processJobLink(link) {
    if (this.processedLinks.has(link)) {
      console.log('Link already processed:', link);
      return { alreadyProcessed: true };
    }
  
    try {
      console.log('Processing job link:', link);
      const response = await this.makeRequest(link);
      const { data } = response;
  
      const $ = cheerio.load(data);
      $('script, style').remove();
      const textContent = $('body').text().replace(/\s\s+/g, ' ').trim();
  
      let extractedData;

        if (this.useGemini) {
          extractedData = await this.useGeminiAPI(link, textContent);
          extractedData = this.validateAndCleanJobData(extractedData);
        } else {
          extractedData = await this.useChatGPTAPI(link, textContent);
        }
  
      await this.saveProcessedLink(link);

      if (extractedData.skipped) {
        return { skipped: true };
      }
      return extractedData;
    } catch (error) {
      console.error(`Error processing job link ${link}:`, error);
      throw error;
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

  async useChatGPTAPI(link, textContent) {
    const jobResponse = z.object({
      title: z.string(),
      company_name: z.string(),
      company_description: z.string(),
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


    const prompt = this.generatePrompt(link, textContent);
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
      console.log('OpenAI API Response:', message);
      console.log('Parsed:', message.parsed);
      const jobPosting = message.parsed;

      if (this.isTechJob(jobPosting.title)) {
        return jobPosting;
      } else {
        console.log(`Skipping non-tech job: ${jobPosting.title}`);
        return { skipped: true };
      }
    } catch (error) {
      console.error('OpenAI API Error:', error.message);
      throw error;
    }
  }

  generatePrompt(link, textContent) {
    return `
    IF THE JOB POSTING DATA IS NOT A JOB RELATED TO A COMPUTER SCIENCE, MATHEMATICS, OR ENGINEERING FIELD, PLEASE SKIP THIS JOB POSTING.
      Please extract the following information from this job posting data: ${textContent}
      - title (e.g., Software Engineer, Data Analyst, include if there is a specific team or project in the title like :'Software Engineer, Frontend'. if the title is not something related to computer science or software engineering, please DO NOT include it)
      - company_name NVARCHAR(50) (as simple as possible and you can tell the company name from the job posting link: ${link})
      - company_description NVARCHAR(MAX)(write a short paragraph about the company, where they're located, their mission, etc)
      - company_industry (just write down the general industry of the company, like tech, healthcare, finance, etc, those are not the only options.)
      - company_size (e.g., 1-10, 11-50, 51-200, 201-500, 501-1000, 1001-5000, 5001-10000, 10001+)
      - company_stock_symbol (if public, otherwise leave blank)
      - company_logo (in the format of /src/<company-name>logo.png do not include space in the company logo)
      - company_founded (year founded, if available, otherwise leave blank, format in SQL datetime format)
      - location (City, State(full name), Country(full name), if remote N/A)
      - salary (integer only, no currency symbol, no matter what format the salary in (hourly, monthly, weekly) convert to yearly salary, if none present 0)
      - salary_max (integer only, no currency symbol, no matter what format the salary in (hourly, monthly, weekly) convert to yearly salary, if none present 0)
      - experience_level ("Internship", "Entry Level", "Junior", "Mid Level", "Senior", "Lead" or "Manager" only)
      - skills (6-10 skills, prefer single word skills, as a comma-separated list)
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
    return {
      title: data.title || '',
      company_name: data.company_name || '',
      company_description: data.company_description || '',
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

  async createJobPosting(jobData, companyId, link) {
    await jobQueries.createJobPosting(
      jobData.title,
      jobData.salary,
      jobData.experience_level,
      jobData.location,
      new Date(),
      companyId,
      link,
      null,
      jobData.tags.split(','),
      jobData.description,
      jobData.salary_max,
      null,
      jobData.skills.split(','),
      jobData.benefits.split(','),
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
      jobData.Relocation
    );
  }

  getLinkedInSearchTerms(processedJobTitles) {
    const defaultTerms = this.getDefaultTechJobTitles();
    return Array.from(new Set([...processedJobTitles, ...defaultTerms]));
  }

  async crawlLinkedIn(searchTerm) {
    const jobs = new Set();
    const encodedTerm = encodeURIComponent(searchTerm);
    const baseUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodedTerm}&f_TPR=r86400`;

    console.log(`Crawling LinkedIn for: ${searchTerm}`);

    for (let page = 0; page < this.MAX_LINKEDIN_PAGES; page++) {
      const pageUrl = `${baseUrl}&start=${page * 25}`;
      try {
        const response = await this.makeRequest(pageUrl);
        const $ = cheerio.load(response.data);

        $('.job-card-container').each((index, element) => {
          const jobLink = $(element).find('.job-card-container__link').attr('href');
          const jobTitle = $(element).find('.job-card-list__title').text().trim();
          const companyName = $(element).find('.job-card-container__company-name').text().trim();

          if (jobLink && this.isTechJob(jobTitle)) {
            jobs.add({
              url: new URL(jobLink, baseUrl).href,
              title: jobTitle,
              company_name: companyName
            });
          }
        });
        console.log(jobs);

        if (!this.hasNextPage($, pageUrl)) {
          break;
        }
        

        await this.delay(this.DELAY_BETWEEN_REQUESTS);
      } catch (error) {
        console.error(`Error crawling LinkedIn page for ${searchTerm}:`, error);
        break;
      }
    }

    return Array.from(jobs);
  }

  async processJobLinks(links, companyId, isLinkedIn = false) {
    for (const [index, link] of links.entries()) {
      try {
        this.updateProgress({ 
          processedJobs: index + 1,
          currentAction: `Processing job: ${link.url || link}`
        });

        let jobData;
        if (isLinkedIn) {
          jobData = await this.processLinkedInJob(link);
        } else {
          jobData = await this.processJobLinkWithRetry(link);
        }

        if (jobData && !jobData.error && !jobData.alreadyProcessed && !jobData.skipped) {
          await this.createJobPosting(jobData, companyId, link.url || link);
          console.log(`Processed job data for ${link.url || link}`);
        }
      } catch (error) {
        console.error(`Error processing job link ${link.url || link}:`, error);
      }
      
      await this.delay(this.DELAY_BETWEEN_REQUESTS);
    }
  }

  async processLinkedInJob(jobData) {
    if (this.processedLinks.has(jobData.url)) {
      console.log('LinkedIn job already processed:', jobData.url);
      return { alreadyProcessed: true };
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
        return { skipped: true };
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

 async start() {
    await this.init();
    console.log('Running enhanced job processor');

    await this.cleanupOldJobs();
    await this.removeDuplicateJobs();

    const companies = await jobQueries.getCompanies();
    const processedJobTitles = new Set();

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
    
    await this.removeDuplicateJobs();

    // Phase 2: LinkedIn Crawler
    const linkedInSearchTerms = this.getLinkedInSearchTerms(processedJobTitles);
    
    for (const [index, searchTerm] of linkedInSearchTerms.entries()) {
      this.updateProgress({ 
        currentAction: `Searching LinkedIn for: ${searchTerm}`,
        processedCompanies: index + 1,
        totalCompanies: linkedInSearchTerms.length
      });

      const linkedInJobs = await this.crawlLinkedIn(searchTerm);
      this.updateProgress({ 
        totalJobs: linkedInJobs.length,
        currentAction: 'Processing LinkedIn jobs'
      });
      await this.processJobLinks(linkedInJobs, null, true);
      await this.delay(this.LINKEDIN_SEARCH_DELAY);
    }

    this.updateProgress({ phase: 'Completed' });
    console.log('Job processing completed.');
  }
}

module.exports = JobProcessor;