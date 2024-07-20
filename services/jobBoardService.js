const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');
const environment = require('../config/environment');
const jobQueries = require('../queries/jobQueries');

class JobProcessor {
  constructor(
    geminiKey = environment.geminiKey,
    openaiKey = environment.openAIKey
  ) {
    this.genAI = new GoogleGenerativeAI(geminiKey);
    this.openai = new OpenAI({ apiKey: openaiKey });
    this.useGemini = false;
    this.lastRequestTime = 0;
    this.GEMINI_DELAY_MS = 1000;
    this.OPENAI_DELAY_MS = 20000;
    this.processedLinksFile = path.join(__dirname, 'processed_links.txt');
    this.processedLinks = new Set();
  }

  async init() {
    await this.loadProcessedLinks();
  }

  isTechJob(title) {
    const techKeywords = [
      'software', 'developer', 'programmer', 'data', 'analyst',
      'scientist', 'IT', 'information technology', 'web', 'frontend', 'backend',
      'full stack', 'devops', 'cloud', 'network', 'security', 'database',
      'machine learning', 'AI', 'artificial intelligence', 'QA', 'quality assurance',
      'UX', 'UI', 'product manager', 'scrum master', 'agile', 'tech', 'systems',
      'infrastructure', 'mobile', 'iOS', 'Android', 'cybersecurity', 'blockchain',
      'IoT', 'robotics', 'automation', 'SRE', 'reliability', 'architect'
    ]; 
    
    const lowercaseTitle = title.toLowerCase();
    return techKeywords.some(keyword => lowercaseTitle.includes(keyword));
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async processJobLinkWithDelay(link, delayMs) {
    await this.delay(delayMs);
    return this.processJobLink(link);
  }
  

  async start() {
    await this.init();

    console.log('running job cleanup');
    await this.cleanupCompanyData();

    console.log('running job processor');
  
    const companies = await jobQueries.getCompanies();
  
    const collectLinksPromises = companies
      .filter(company => company.job_board_url)
      .map(company => this.collectJobLinks(company));
  
    const allCompanyLinks = await Promise.all(collectLinksPromises);
  
    const jobLinkPromises = [];
    let delayMs = 0;
    const delayIncrement = 100; // Adjust this value based on the API rate limit
  
    for (const { companyId, links } of allCompanyLinks.flat()) {
      for (const link of links) {
        jobLinkPromises.push(
          this.processJobLinkWithDelay.call(this, link, delayMs)
            .then(async jobData => {
              if (jobData && !jobData.error && !jobData.alreadyProcessed) {
                try {
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
                  console.log(`Processed job data for ${link}`);
                } catch (error) {
                  console.error(`Error creating job posting for ${link}:`, error);
                }
              }
            })
        );
        delayMs += delayIncrement; // Increment delay for the next request
      }
    }
  
    await Promise.all(jobLinkPromises);
  
    console.log('Job processing completed.');
  }

  async processIndividualJob(link) {
    await this.init();
    if (!this.processedLinks.has(link)) {
      const jobData = await this.processJobLink(link);
      if (jobData && !jobData.error && !jobData.alreadyProcessed) {
        return jobData;
      }
    }
    return null;
  }

  async collectJobLinks(company) {
    const jobBoardUrl = company.job_board_url;
    try {
      const response = await axios.get(jobBoardUrl);
      const $ = cheerio.load(response.data);
      const links = new Set();

      $('a[href*="job"], a[href*="career"], a[href*="position"]').each(
        (index, element) => {
          const link = $(element).attr('href');
          const title = $(element).text().toLowerCase();
          if (this.isTechJob(title)) links.add(new URL(link, jobBoardUrl).href);
        }
      );

      // console.log({companyId: company.id, links: Array.from(links)});
      // console.log(`Collected ${links.size} job links from ${jobBoardUrl}.`);
      return {companyId: company.id, links: Array.from(links)}; 
    } catch (error) {
      console.error(`Error collecting job links from ${jobBoardUrl}:`, error);
      return [];
    }
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

  async saveProcessedLink(link) {
    this.processedLinks.add(link);
    await fs.appendFile(this.processedLinksFile, link + '\n');
  }

  async processJobLink(link) {
    if (this.processedLinks.has(link)) {
      console.log('Link already processed:', link);
      return { alreadyProcessed: true };
    }
  
    try {
      console.log('Processing job link:', link);
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.82 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
      };
  
      const linkResponse = await axios.get(link, { headers, timeout: 5000 });
      const { data } = linkResponse;
  
      const $ = cheerio.load(data);
      $('script, style').remove();
      const textContent = $('body').text().replace(/\s\s+/g, ' ').trim();
  
      let extractedData;
      try {
        if (this.useGemini) {
          await this.rateLimit(true);
          extractedData = await this.useGeminiAPI(link, textContent);
        } else {
          await this.rateLimit(false);
          extractedData = await this.useChatGPTAPI(link, textContent);
        }
  
        extractedData = this.validateAndCleanJobData(extractedData);
  
        // Check if the job is tech-related
        if (!this.isTechJob(extractedData.title)) {
          console.log(`Skipping non-tech job: ${extractedData.title}`);
          return { skipped: true };
        }
  
      } catch (error) {
        if (error.message.includes('RECITATION') || error.status === 429) {
          console.log('Switching to ChatGPT API due to Gemini error or rate limiting');
          this.useGemini = false;
          await this.rateLimit(false);
          extractedData = await this.useChatGPTAPI(link, textContent);
          extractedData = this.validateAndCleanJobData(extractedData);
  
          // Check if the job is tech-related (after fallback to ChatGPT)
          if (!this.isTechJob(extractedData.title)) {
            console.log(`Skipping non-tech job: ${extractedData.title}`);
            return { skipped: true };
          }
        } else {
          throw error;
        }
      }
  
      await this.saveProcessedLink(link);
      return extractedData;
    } catch (error) {
      console.error(`Error processing job link ${link}:`, error);
      return { error: error.message };
    }
  }

  async processJobLinksConcurrently(links) {
    const results = await Promise.all(links.map(link => this.processJobLink(link)));
    return results;
  }

  async useGeminiAPI(link, textContent) {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = this.generatePrompt(link, textContent);
    const result = await model.generateContent(prompt);
    let response = await result.response;
    response = response.text();
    const cleanedResponse =
      response.replace(/`+/g, '').match(/\{.*\}/s)?.[0] || '';
    return JSON.parse(cleanedResponse);
  }

  async useChatGPTAPI(link, textContent) {
    const prompt = this.generatePrompt(link, textContent);
    try {
      const completion = await this.openai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful assistant that extracts job information from text.',
          },
          { role: 'user', content: prompt },
        ],
        model: 'gpt-4o-mini',
      });

      const responseContent = completion.choices[0].message.content;
      const cleanedResponse = responseContent.match(/\{.*\}/s)?.[0] || '';
      return JSON.parse(cleanedResponse);
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
      - company_industry (e.g., Technology, Healthcare, Finance, etc.)
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
      - description (try to take up to 3 paragraphs from the original source)
      - benefits (as a comma-separated list) 
      - additional_information (blank if nothing detected in the job posting, otherwise provide any additional information that you think is relevant to the job posting)
      - PreferredQualifications (if available)
      - MinimumQualifications (if available)
      - Responsibilities (responsibilities of the job)
      - Requirements (requirements of the job)
      - NiceToHave (nice to have skills or experience)
      - Schedule (mon-fri, 9-5, etc.)
      - HoursPerWeek (integer only)
      - H1BVisaSponsorship BIT
      - IsRemote BIT
      - EqualOpportunityEmployerInfo NVARCHAR(MAX)
      - Relocation BIT
      Provide the extracted information in JSON format.
    `;
  }

  async rateLimit(isGemini) {
    const now = Date.now();
    const delayMs = isGemini ? this.GEMINI_DELAY_MS : this.OPENAI_DELAY_MS;
    const elapsed = now - this.lastRequestTime;

    if (elapsed < delayMs) {
      await new Promise((resolve) => setTimeout(resolve, delayMs - elapsed));
    }

    this.lastRequestTime = Date.now();
  }
  async cleanupCompanyData() {
    try {
      // Step 1: Fetch all companies
      const companies = await jobQueries.getAllCompanies();

      // Step 2: Group similar company names
      const companyGroups = this.groupSimilarCompanies(companies);

      // Step 3: Consolidate companies and update job listings
      for (const [mainCompany, similarCompanies] of Object.entries(companyGroups)) {
        if (similarCompanies.length > 0) {
          const mainCompanyId = mainCompany.id;

          // Update job listings for similar companies
          for (const company of similarCompanies) {
            await jobQueries.updateJobListingsCompanyId(company.id, mainCompanyId);
          }

          // Delete similar companies
          for (const company of similarCompanies) {
            await jobQueries.deleteCompany(company.id);
          }

          console.log(`Consolidated ${similarCompanies.length} companies into ${mainCompany.name}`);
        }
      }

      console.log('Company data cleanup completed.');
    } catch (error) {
      console.error('Error during company data cleanup:', error);
    }
  }

  groupSimilarCompanies(companies) {
    const groups = {};
    const processed = new Set();

    for (const company of companies) {
      if (processed.has(company.id)) continue;

      const simplifiedName = this.simplifyCompanyName(company.name);
      if (!groups[simplifiedName]) {
        groups[simplifiedName] = {
          main: company,
          similar: []
        };
      } else {
        groups[simplifiedName].similar.push(company);
      }

      processed.add(company.id);
    }

    return groups;
  }

  simplifyCompanyName(name) {
    return name.toLowerCase()
      .replace(/\binc\.?\b|\bllc\.?\b|\bcorp\.?\b|\btechnologies\b|\btech\b/g, '')
      .replace(/[^a-z0-9]+/g, '')
      .trim();
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
}

module.exports = JobProcessor;
