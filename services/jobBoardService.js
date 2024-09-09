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
const puppeteer = require('puppeteer');
const jobQueries = require('../queries/jobQueries');
const { title } = require('process');
const rateLimit = require('axios-rate-limit');
const http = rateLimit(axios.create(), { maxRequests: 2, perMilliseconds: 1000 });
const WebScraper = require('./webScraperService');
const { link } = require('fs');
const { set } = require('../app');
const web = new WebScraper();


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
  
    // Define tech job categories with associated keywords
    const techCategories = {
      software: ['software', 'developer', 'programmer', 'engineer', 'coder', 'c#', 'test'],
      data: ['data', 'analyst', 'analytics', 'machine learning', 'ai', 'artificial intelligence'],
      web: ['web', 'frontend', 'backend', 'full stack', 'ui', 'ux'],
      systems: ['system', 'architect', 'devops', 'cloud', 'infrastructure'],
      network: ['network', 'security', 'cybersecurity'],
      database: ['database', 'sql', 'nosql', 'administrator'],
      mobile: ['mobile', 'ios', 'android'],
      specific_roles: ['product manager', 'scrum master', 'agile coach', 'tech lead', 'qa engineer', 'quality assurance'],
      languages: ['java', 'python', 'javascript', 'c++', 'ruby', 'php', 'scala', 'typescript'],
      game_dev: ['game', 'gameplay', 'graphics'],
      blockchain: ['blockchain', 'crypto', 'ethereum', 'solidity'],
      devops: ['devops', 'site reliability', 'qa', 'quality assurance', 'automation', 'tools'],
      cloud: ['cloud', 'azure'],
      tech: ['technology', 'technical', 'information technology'],
      graphics: ['graphics', 'ui/ux', 'designer', 'animator'],
      product: ['program', 'project'],
    };
  
    // Function to check if the title contains any of the keywords
    const containsKeyword = (keywords) => keywords.some(keyword => lowercaseTitle.includes(keyword));
  
    // Check for exact matches or highly specific tech roles
    if (containsKeyword(['software engineer', 'gameplay animator', 'data center technician', 'desktop support', 'saas administrator', 'character assembly artist', 'environment artist', 'data scientist', 'technical artist', 'engine programmer', 'ui programmer', 'graphic designer', 'systems designer', 'systems engineer', 'full stack developer', 'machine learning engineer', 'devops engineer', 'systems architect'])) {
      return true;
    }
  
    // Check if the title contains keywords from at least two different categories
    const categoriesFound = Object.values(techCategories).filter(category => containsKeyword(category)).length;
    if (categoriesFound >= 2) {
      return true;
    }
  
    // Check for titles that explicitly mention technology or engineering
    if (lowercaseTitle.includes('technology') || lowercaseTitle.includes('engineer')) {
      // But exclude non-tech engineering roles
      const nonTechEngineering = ['civil engineer', 'smart meter engineer', 'meter engineer', 'mechanical engineer', 'chemical engineer'];
      if (!nonTechEngineering.some(role => lowercaseTitle.includes(role))) {
        return true;
      }
    }
  
    // Check for specific tech-related words that might appear alone
    const standaloneKeywords = ['programmer', 'developer', 'coder', 'analyst', 'architect', 'admin'];
    if (standaloneKeywords.some(keyword => lowercaseTitle.split(/\s+/).includes(keyword))) {
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
      const response = await http.get(url, {
        headers: {
          'User-Agent': 'core/1.0 (support@getcore.dev)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        // Implement proper error handling
        validateStatus: function (status) {
          return status >= 200 && status < 300; // default
        },
      });
  
      return response;
    } catch (error) {
      if (error.response) {
        console.error(`Request failed with status ${error.response.status}`);
      } else if (error.request) {
        console.error('No response received:', error.request);
      } else {
        console.error('Error setting up request:', error.message);
      }
      throw error;
    }
  }
  getCompanyIdentifier(jobBoardUrl) {
    const parsedUrl = new URL(jobBoardUrl);
    const pathParts = parsedUrl.pathname.split('/').filter(part => part);
  
    if (parsedUrl.hostname.includes('greenhouse.io')) {
      // For Greenhouse, the company identifier is usually the last part of the path
      return pathParts[pathParts.length - 1];
    } else if (parsedUrl.hostname.includes('lever.co')) {
      // For Lever, the company identifier is usually the first part of the path
      return pathParts[0];
    } else {
      // For other job boards, use the subdomain if present, otherwise the first path part
      const subdomain = parsedUrl.hostname.split('.')[0];
      return subdomain !== 'www' ? subdomain : pathParts[0];
    }
  }
  
  urlMatches(url1, url2) {
    const identifier1 = this.getCompanyIdentifier(url1);
    const identifier2 = this.getCompanyIdentifier(url2);
    return identifier1 === identifier2;
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
  
      // Set up request interception once
      await page.setRequestInterception(true);
      page.on('request', request => {
        if (request.resourceType() === 'xhr' || request.resourceType() === 'fetch') {
          request.continue();
        } else {
          request.continue();
        }
      });
  
      let previousLinksLength = 0;
          
      while (true && currentPage <= 5) {
        const pageUrl = this.getPageUrl(jobBoardUrl, currentPage);
        console.log(`Scraping page ${currentPage}: ${pageUrl}`);
          
        try {
          await page.goto(pageUrl, { waitUntil: 'networkidle0' });
        } catch (error) {
          console.error(`Error navigating to ${pageUrl}:`, error);
          break;
        }
          
        // Clear previous response listeners
        page.removeAllListeners('response');
          
        const apiResponses = [];
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
          
        const pageContent = await page.content();
        const $ = cheerio.load(pageContent);
          
        console.log(`pageUrl: ${pageUrl}`);
        const pageLinks = await this.fullExtractJobLinks($, pageUrl, jobBoardDomain);
          
        // Process API responses
        for (const apiResponse of apiResponses) {
          const apiLinks = this.extractJobLinksFromAPI(apiResponse);
          pageLinks.push(...apiLinks);
        }
          
        pageLinks.forEach(link => {
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
          
        console.log(`Collected ${pageLinks.length} links from page ${currentPage}`);
          
        // Check if the length of links stays the same
        if (allLinks.size === previousLinksLength) {
          console.log('No new links found, stopping the scraping process.');
          break;
        }
          
        previousLinksLength = allLinks.size;
        currentPage++;
        await this.delay(this.DELAY_BETWEEN_REQUESTS);
      }
  
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
        await this.searchLinkedInJobs(allLinks);
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
  
    if (baseUrl.includes('linkedin.com')) {
      const promises = [];
      $('.job-card-container').each((index, element) => {
        const linkElement = $(element).find('.job-card-container__link');
        const link = linkElement.attr('href');
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
        const title = $(element).text().toLowerCase();
        console.log(title);
        if (this.isTechJob(title)) {
          const jobUrl = new URL(link, baseUrl).href;
          links.add(JSON.stringify({ url: jobUrl }));
        }
      });
    }
  
    // Convert Set to Array and parse JSON strings back to objects
    return Array.from(links).map(link => JSON.parse(link));
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
    this.updateProgress({ currentAction: 'Checking next page' });
    const url = new URL(currentUrl);

    // Specific handling for known job board domains
    if (url.hostname.includes('linkedin.com')) {
      return this.hasNextPageLinkedIn($, url);
    } else if (url.hostname.includes('careers.microsoft.com')) {
      return this.hasNextPageMicrosoft($, url);
    } else {
      return this.hasNextPageGeneric($, url);
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
        return await this.checkNextPage(nextPageUrl);
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
  
      return await this.checkNextPage(nextPageUrl.toString());
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
    const url = typeof link === 'object' && link.url ? link.url : link;
  
    if (typeof url !== 'string' || !url.startsWith('http')) {
      console.error('Invalid URL:', url);
      return { error: 'Invalid URL' };
    }
  
    if (this.processedLinks.has(url)) {
      return { alreadyProcessed: true };
    }
  
    try {
      console.log('Processing job link:', url);
      
      this.updateProgress({ currentAction: 'Launching browser' });
      const browser = await puppeteer.launch();
      const page = await browser.newPage();
  
      this.updateProgress({ currentAction: 'Loading page' });
      await page.goto(url, { waitUntil: 'networkidle0' });
  
      this.updateProgress({ currentAction: 'Extracting content' });
      const textContent = await page.evaluate(() => {
        const scripts = document.getElementsByTagName('script');
        const styles = document.getElementsByTagName('style');
        
        for (const element of [...scripts, ...styles]) {
          element.remove();
        }
        
        return document.body.innerText.replace(/\s\s+/g, ' ').trim();
      });
  
      await browser.close();
  
      let extractedData;
  
      if (this.useGemini) {
        this.updateProgress({ currentAction: 'Using Gemini API' });
        extractedData = await this.useGeminiAPI(link, textContent);
        extractedData = this.validateAndCleanJobData(extractedData);
      } else {
        this.updateProgress({ currentAction: 'Using ChatGPT API' });
        extractedData = await this.useChatGPTAPI(link, textContent);
      }
  
      this.updateProgress({ currentAction: 'Saving processed link' });
      await this.saveProcessedLink(link);
  
      if (extractedData.skipped) {
        this.updateProgress({ currentAction: 'Skipped job' });
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
        return { skipped: true, title: jobPosting.title };
      }
    } catch (error) {
      console.error('OpenAI API Error:', error.message);
      throw error;
    }
  }

  async useChatGPTAPI_CompanyInfo(name, textContent) {
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
    
    await page.waitForSelector('.base-search-card__info', { timeout: 10000 });
  
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
          request.continue();
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
      'Product Manager', 'QA Engineer', 'Java Developer', 'Python Developer',
      'JavaScript Developer', 'Game Developer', 'Blockchain Developer',
      'DevOps Engineer', 'Cloud Architect', 'UI/UX Designer', 'Machine Learning Engineer',
      'Full Stack Developer', 'Frontend Developer', 'Backend Developer'
    ];
  
    const stateMappings = {
      Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA',
      Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA',
      Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA',
      Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD',
      Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS', Missouri: 'MO',
      Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
      'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH',
      Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
      'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT',
      Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY',
      'United States': 'US'
    };
  
    const getRandomElement = (array) => array[Math.floor(Math.random() * array.length)];
  
    let allJobLinks = [];
    const batchSize = 500;
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

  async getOrCreateCompany(companyName, companyDescription, companyLocation, companyIndustry, companySize, companyStockSymbol, companyLogo, companyFounded) {
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
    await jobQueries.createJobPosting(
      jobData.title ? jobData.title : '',
      jobData.salary ? jobData.salary : 0,
      jobData.experience_level ? jobData.experience_level : '',
      jobData.location ? jobData.location : '',
      new Date(),
      companyId || null,
      link ? link : '',
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
      jobData.Relocatio ? jobData.Relocation : 0
    );

    this.updateProgress({ processedJobs: this.progress.processedJobs + 1 });
  }

  getLinkedInSearchTerms(processedJobTitles) {
    const defaultTerms = this.getDefaultTechJobTitles();
    return Array.from(new Set([...processedJobTitles, ...defaultTerms]));
  }


  async processJobLinks(links, companyId, isLinkedIn = false) {
    for (const [index, link] of links.entries()) {
      try {
        this.updateProgress({ 
          processedJobs: index + 1,
          currentAction: `Processing job: ${link.url || link}`
        });

        const currentCompanyJobLinks = await jobQueries.getCompanyJobLinks(companyId);

        if (currentCompanyJobLinks.some(job => job.link === link.url || job.link === link)) {
          console.log('Job already processed:', link.url || link);
          continue;
        }

        let jobData;
        if (isLinkedIn) {
          jobData = await this.processLinkedInJob(link);
        } else {
          jobData = await this.processJobLinkWithRetry(link);
        }

        this.updateProgress({ currentAction: 'Creating job posting' });

        if (jobData && !jobData.error && !jobData.alreadyProcessed && !jobData.skipped) {
          await this.createJobPosting(jobData, companyId, link.url || link);
          console.log(`Processed job data for ${link.url || link}`);
        }
      } catch (error) {
        this.updateProgress({ currentAction: 'Error processing job' });
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

    await this.verifyAndUpdateCompanyData();

    await this.removeDuplicateJobs();
    this.updateProgress({ phase: 'Cleaning job postings' });

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

    await this.crawlLinkedIn();

    this.updateProgress({ phase: 'Completed' });
  }
}

module.exports = JobProcessor;