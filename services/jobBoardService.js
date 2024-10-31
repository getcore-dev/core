const sanitizeHtml = require("sanitize-html"); // Import the sanitization library
const url = require("url");
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const OpenAI = require("openai");
const { zodResponseFormat } = require("openai/helpers/zod");
const { z } = require("zod");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs").promises;
const notificationQueries = require("../queries/notificationQueries");
const EventEmitter = require("events");
const path = require("path");
const puppeteer = require("puppeteer");
const jobQueries = require("../queries/jobQueries");
const { title } = require("process");
const rateLimit = require("axios-rate-limit");
const http = rateLimit(axios.create(), {
  maxRequests: 10,
  perMilliseconds: 1000,
}); // 10 requests per second
const WebScraper = require("./webScraperService");
const { link } = require("fs");
const Queue = require("bull");
const { set } = require("../app");
const web = new WebScraper();
const TurndownService = require("turndown");
const { count } = require("console");
const { name } = require("ejs-async");
const BROWSER_CONFIG = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote',
    '--single-process',
    '--disable-extensions',
    '--disable-software-rasterizer',
    '--disable-features=site-per-process',
    '--ignore-certificate-errors'
  ],
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
  timeout: 30000
};

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
    this.companyJobUrls = {
      "linkedin.com": ["view", "jobs"],
      "greenhouse": ["jid=", "job"],
      "bankofamerica.com": ["/"],
      "ashbyhq": ["/"],
      "stripe": ["jobs/"],
      "abbvie": ["careers/"],
      "eightfold": ["/job/"],
      "c3.ai": ["careers/"],
      "wiz.io": ["careers/"],
      "lever.co": ["/"],
      "jobvite.com": ["job/"],
      "tiktok": ["job/"],
      "myworkday": ["job/", "wd", "en-US"],
      "smartrecruiters": ["/"],
      "microsoft": ["job/"],
      "apple": ["jobs/"],
      "epicgames": ["job/"],
      "okta": ["careers/"],
      "ycombinator": ["companies"],
      "datadog": ["/"],
      "amazon.jobs": ["/job"]
    };
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    this.genAI = new GoogleGenerativeAI(geminiKey);
    this.jobQueue = [];
    this.companyLinkQueue = [];
    this.currentJobLinks = new Set();
    this.jobLinks = new Set();
    this.isProcessing = false;
    this.isProcessingCompanyLinks = false;

    this.openai = new OpenAI({ apiKey: openaiKey });
    this.useGemini = false;
    this.lastRequestTime = 0;
    this.GEMINI_DELAY_MS = 3000;
    this.OPENAI_DELAY_MS = 3000;
    this.MAX_RETRIES = 5;
    this.JOB_EXPIRATION_DAYS = 60;
    this.BACKOFF_FACTOR = 1.5;
    this.processedLinksFile = path.join(__dirname, "processed_links.txt");
    this.processedLinks = new Set();
    this.DELAY_BETWEEN_REQUESTS = 1000;
    this.DELAY_BETWEEN_SEARCHES = 5000;
    this.MAX_PAGES_PER_SEARCH = 3;
    this.jobBoardPlatforms = [
      "greenhouse.io",
      "ashbyhq.com",
      "myworkday.com",
      "lever.co",
    ];
    this.LINKEDIN_SEARCH_DELAY = 60000;
    this.MAX_LINKEDIN_PAGES = 5;
    this.progress = {
      phase: "Initializing",
      company: "",
      totalCompanies: 0,
      processedCompanies: 0,
      totalJobs: 0,
      processedJobs: 0,
      currentAction: "",
    };
    this.browser = null;
    this.maxConcurrentPages = 5;
    this.currentPages = 0;

    this.paginationSelectorsMap = {
      default: {
        next: "button.pagination__btn.pagination__next",
        prev: "button.pagination__btn.pagination__previous",
        active: "button.pagination__link--active",
        nextInactive:
          "button.pagination__btn.pagination__next.pagination__next--inactive",
        prevInactive:
          "button.pagination__btn.pagination__previous.pagination__previous--inactive",
      },
      "epicgames.com": {
        next: "a.pagination-btn.arrow:has(i.icon-chevron-right)",
        prev: "a.pagination-btn.arrow:has(i.icon-chevron-left)",
        active: "a.pagination-btn.active",
        nextInactive: "",
        prevInactive: "",
      },
      "careers.tiktok.com": {
        next: ".atsx-pagination-next",
        prev: ".atsx-pagination-prev",
        active: ".atsx-pagination-item-active",
        nextInactive: "",
        prevInactive: "",
      },
      "stripe.com": {
        next: 'a.JobsPagination__link:not(.JobsPagination__link--isCurrent):contains("Next")',
        prev: 'a.JobsPagination__link:not(.JobsPagination__link--isCurrent):contains("Previous")',
        active: "a.JobsPagination__link--isCurrent",
        nextInactive: "",
        prevInactive: "",
      },
      "greenhouse.io": {
        next: "button.pagination__btn.pagination__next",
        prev: "button.pagination__btn.pagination__previous",
        active: "button.pagination__link--active",
        nextInactive:
          "button.pagination__btn.pagination__next.pagination__next--inactive",
        prevInactive:
          "button.pagination__btn.pagination__previous.pagination__previous--inactive",
      },
      "job-boards.greenhouse.io": {
        next: "button.pagination__btn.pagination__next",
        prev: "button.pagination__btn.pagination__previous",
        active: "button.pagination__link--active",
        nextInactive:
          "button.pagination__btn.pagination__next.pagination__next--inactive",
        prevInactive:
          "button.pagination__btn.pagination__previous.pagination__previous--inactive",
      },
      "apple.com": {
        next: "span.next",
        prev: "span.prev",
        active: "input#page-number",
        nextInactive: "span.next.disabled",
        prevInactive: "span.prev.disabled",
      },
      "workday.com": {
        next: 'button[data-uxi-element-id="next"]',
        prev: 'button[data-uxi-element-id="prev"]',
        active: ".WGDC-pagination-current",
        nextInactive: ".WGDC-pagination-next[disabled]",
        prevInactive: ".WGDC-pagination-previous[disabled]",
      },
    };

    this.urlExclusionRules = {
      stripe: {
        include: "listing",
        exclude: "",
      },
      epicgames: {
        include: "jobs",
        exclude: "",
      },
      tiktok: {
        include: "position",
        exclude: "",
      },
      // Add more rules for other companies as needed
    };

    this.paginationPreferences = {
      "greenhouse.io": "?page=",
      "job-boards.greenhouse.io": "?page=",
      "stripe.com": "?skip=",
      "epicgames.com": "?page=",
      "tiktok.com": "?current=",
    };
  }

  async addToCompanyLinkQueue(link) {
    if (!this.companyLinkQueue.includes(link)) {
      this.companyLinkQueue.push(link);
      console.log(`Added company link to queue: ${link}`);
    }
    this.processCompanyLinkQueue();
  }

  async processCompanyLinkQueue() {
    if (this.isProcessingCompanyLinks) {
      return;
    }
    this.isProcessingCompanyLinks = true;

    while (this.companyLinkQueue.length > 0) {
      const link = this.companyLinkQueue.shift();
      await this.processQueuedCompanyLink(link);
    }

    this.isProcessingCompanyLinks = false;
  }

  async processQueuedCompanyLink(link) {
    console.log(`Processing queued company link: ${link}`);
    this.updateProgress({
      phase: "Processing company links",
      totalCompanies: this.companyLinkQueue.length + 1,
      processedCompanies: this.processedLinks.size,
      currentAction: `Processing company link ${this.processedLinks.size + 1} of ${this.companyLinkQueue.length + 1}`,
    });
    try {
      await this.processAllLinksOnPage(link);
    } catch (error) {
      console.error(`Error processing queued company link ${link}:`, error);
    }

    await this.delay(500);
  }

  async processAllLinksOnPage(url) {
    try {
      console.log(`Processing all links on page ${url}`);
      const jobLinks = await this.extractJobLinksFromPage(url);
      for (const link of jobLinks) {
        const jobUrl = link.link || link.url || link.externalPath;
        if (jobUrl && this.isJobLink(jobUrl)) {
          await this.addToJobProcessingQueue(jobUrl);
        }
      }
    } catch (error) {
      console.error(`Error processing links on page ${url}:`, error);
    }
  }

  async addToJobProcessingQueue(link) {
    if (this.processedLinks.has(link) || !this.isJobLink(link)) {
      return;
    }
    if (!this.jobLinks.has(link)) {
      this.jobLinks.add(link);
      console.log(`Added job link to queue: ${link}`);
    }
    this.processJobQueue();
  }

  async processJobQueue() {
    if (this.isProcessingJobs) {
      return;
    }
    this.isProcessingJobs = true;

    for (const link of this.jobLinks) {
      await this.processQueuedJob(link);
      this.jobLinks.delete(link);
      await this.delay(Math.floor(Math.random() * 2000) + 1000);
    }

    this.isProcessingJobs = false;
  }

  async processQueuedJob(link) {
    console.log(`Processing queued job: ${link}`);
    try {
      const jobInfo = await this.processJobLinkWithRetry(link);
      console.log(jobInfo);
      if (jobInfo && !jobInfo.error && !jobInfo.skipped) {
        const companyId = await this.getOrCreateCompany(
          jobInfo.company_name,
          jobInfo.company_description || "",
          jobInfo.company_location || "",
          jobInfo.company_job_board_url || "",
          jobInfo.company_industry || "",
          jobInfo.company_size || "",
          jobInfo.company_stock_symbol || "",
          jobInfo.company_logo || "",
          jobInfo.company_founded || null,
        );
        await this.createJobPosting(jobInfo, companyId, link);
        console.log(`Processed and created job posting for: ${link}`);
      } else {
        console.log(`Skipped job posting for: ${link}`);
      }
    } catch (error) {
      console.error(`Error processing queued job ${link}:`, error);
    }
  }

  async cleanupOldJobs() {
    console.log("Cleaning up old jobs...");

    try {
      const deletedJobIds = await jobQueries.getOldJobs();
      const batchSize = 5;

      this.updateProgress({
        phase: "Cleaning up old jobs",
        totalJobs: deletedJobIds.length,
        processedJobs: 0,
        currentAction: "Deleting old jobs",
      });

      for (let i = 0; i < deletedJobIds.length; i += batchSize) {
        const batch = deletedJobIds.slice(i, i + batchSize);
        const deletePromises = batch.map((job) =>
          jobQueries.automatedDeleteJob(job.id),
        );

        await Promise.all(deletePromises);
        this.updateProgress({ processedJobs: i + batch.length });
      }

      console.log(`Removed ${deletedJobIds.length} old jobs.`);
    } catch (error) {
      console.error("Error cleaning up old jobs:", error);
    }
  }

  normalizeUrl(url) {
    try {
      const parsedUrl = new URL(url);
      let hostname = parsedUrl.hostname;

      // Remove 'www.' if present
      hostname = hostname.replace(/^www\./, "");

      // Handle the specific case of 'boards.greenhouse.io' vs 'job-boards.greenhouse.io'
      hostname = hostname.replace(/^(job-)?boards\./, "boards.");

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
      console.log(duplicateJobGroups);
      const totalJobs = duplicateJobGroups.reduce(
        (sum, group) => sum + group.length - 1,
        0,
      );
      console.log(totalJobs);

      this.updateProgress({
        phase: "Merging duplicate jobs",
        totalJobs: totalJobs,
        processedJobs: 0,
        currentAction: "Merging duplicate jobs",
      });

      for (const group of duplicateJobGroups) {
        // await this.mergeDuplicateJobGroup(group);
        this.updateProgress({
          processedJobs: this.updateProgress.processedJobs + group.length - 1,
        });
      }
    } catch (error) {
      console.error("Error merging duplicate jobs:", error);
    }
  }

  updateProgress(update) {
    this.progress = { ...this.progress, ...update };
    this.emit("progress", this.progress);
  }

  async init() {
    await this.loadProcessedLinks();
    await this.loadJobLinks();
  }

  async loadJobLinks() {
    const jobLinks = await jobQueries.getAllJobLinks();
    for (const link of jobLinks) {
      this.currentJobLinks.add(link.link);
    }
  }

  async loadProcessedLinks() {
    try {
      const data = await fs.readFile(this.processedLinksFile, "utf8");
      this.processedLinks = new Set(data.split("\n").filter(Boolean));
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("Error loading processed links:", error);
      }
    }
  }

  isTechJob(title) {
    // Convert title to lowercase for case-insensitive matching
    const lowercaseTitle = title.toLowerCase();

    // Highly specific tech roles
    const exactMatches = [
      "software engineer",
      "data scientist",
      "full stack developer",
      "machine learning engineer",
      "devops engineer",
      "systems architect",
      "systems engineer",
      "network engineer",
      "data analyst",
      "backend developer",
      "frontend developer",
      "web developer",
      "mobile developer",
      "cloud architect",
      "cloud engineer",
      "security engineer",
      "cybersecurity analyst",
      "technical lead",
      "tech lead",
      "database administrator",
      "qa engineer",
      "quality assurance engineer",
      "ux designer",
      "ui designer",
      "product manager",
      "scrum master",
      "agile coach",
      "site reliability engineer",
      "automation engineer",
      "blockchain developer",
      "game developer",
      "game designer",
      "graphic designer",
      "systems administrator",
      "it support",
      "it specialist",
      "it manager",
      "technical support",
      "technical writer",
      "ai engineer",
      "artificial intelligence engineer",
      "deep learning engineer",
      "data engineer",
      "big data engineer",
      "data architect",
      "information security analyst",
      "robotics engineer",
      "network administrator",
      "embedded systems engineer",
      "firmware engineer",
      "test engineer",
      "software tester",
      "business analyst",
      "it analyst",
      "solution architect",
      "enterprise architect",
      "devsecops engineer",
      "cloud specialist",
      "systems analyst",
      "applications engineer",
      "platform engineer",
      "release engineer",
      "build engineer",
      "hardware engineer",
      "electrical engineer",
      "electronics engineer",
      "microcontroller engineer",
      "ios developer",
      "android developer",
      "webmaster",
      "security analyst",
      "information technology specialist",
      "technical consultant",
      "pre-sales engineer",
      "post-sales engineer",
      "technical account manager",
      "computer vision engineer",
      "natural language processing engineer",
      "nlp engineer",
      "database developer",
      "data warehouse engineer",
      "etl developer",
      "bi developer",
      "business intelligence developer",
      "data visualization engineer",
      "cloud consultant",
      "solutions engineer",
      "integration engineer",
      "salesforce developer",
      "sap consultant",
      "oracle developer",
      "erp consultant",
      "crm consultant",
      "help desk technician",
      "desktop support technician",
      "it technician",
      "3d artist",
      "vr developer",
      "ar developer",
      "qa tester",
      "quality assurance tester",
      "network technician",
      "it director",
      "cto",
      "chief technology officer",
      "cio",
      "chief information officer",
      "ciso",
      "analyst",
      "data analyst",
      "data scientist",
      "data engineer",
      "data architect",
      "data security analyst",
      "chief information security officer",
      "coordinator",
      "chief information security officer",
      "coordinator",
      "director",
      "manager",
      "supervisor",
      "associate",
      "customer experience",
      "customer service",
      "technical writer",
      "technical support",
      "it analyst",
      "it specialist",
      "it manager",
      "information security analyst",
      "information security manager",
      "security analyst",
      "security manager",
      "security specialist",
      "security engineer",
      "security architect",
      "security consultant",
      "security director",
      "security officer",
      "security supervisor",
      "security technician",
      "security analyst",
      "security manager",
      "security specialist",
      "security engineer",
      "security architect",
      "security consultant",
      "security director",
      "security officer",
      "security supervisor",
      "security technician",
      "people manager",
      "hr",
      "account executive",
      "social media manager",
      "biostatistician",
      "financial analyst",
      "statistical programmer",
      "programmer",
      "trading intern",
      "trading analyst",
      "trading assistant",
      "trading manager",
      "trading specialist",
      "trading engineer",
      "trading architect",
      "trading consultant",
      "trading director",
      "trading officer",
      "trading supervisor",
      "trading technician",
      "trading analyst",
      "trading assistant",
      "trading manager",
      "trading specialist",
      "trading engineer",
      "trading architect",
      "trading consultant",
      "trading director",
      "trading officer",
      "trading supervisor",
      "trading technician",
      "quantitative researcher",
      "quantitative analyst",
      "quantitative manager",
      "quantitative specialist",
      "quantitative engineer",
      "quantitative architect",
      "quantitative consultant",
      "quantitative director",
      "quantitative officer",
      "quantitative supervisor",
      "quantitative technician",
      "risk strategist",
      "head of revenue",
      "head of kyc",
      "vp of design",
      "security engineer",
      "project manager",
      "product manager",
      "product designer",
      "computer science intern",
      "business development",
      "growth lead",
      "code sme",
      "head of growth,",
      "sales developmet",
      "head of recruiting",
      "customer service",
      "editor",
      "content editor",
      "content writer",
      "content strategist",
      "content manager",
      "content director",
      "content officer",
      "content supervisor",
      "content technician",
      "content analyst",
      "content specialist",
      "content engineer",
      "content architect",
      "content consultant",
      "content director",
      "content officer",
      "content supervisor",
      "content technician",
      "content analyst",
      "content specialist",
      "content engineer",
      "content architect",
      "content consultant",
      "content director",
      "content officer",
      "content supervisor",
      "content technician",
      "content analyst",
      "content specialist",
      "content engineer",
      "content architect",
      "content consultant",
      "customer support representative",
      "salesforce",
    ];

    // Non-tech engineering roles to exclude
    const nonTechEngineering = [
      "cashier",
      "cook",
      "waitress",
      "waiter",
      "bartender",
      "janitor",
      "security guard",
    ];

    // Function to create regex patterns for exact matches and keywords
    const createPattern = (words) =>
      new RegExp(`\\b(${words.join("|")})\\b`, "i");

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
      "developer",
      "designer",
      "analytics",
      "engineering",
      "programmer",
      "engineer",
      "software",
      "hardware",
      "technology",
      "technician",
      "administrator",
      "analyst",
      "architect",
      "consultant",
      "specialist",
      "support",
      "coder",
      "tester",
      "manager",
      "devops",
      "cloud",
      "data",
      "ai",
      "artificial intelligence",
      "machine learning",
      "ml",
      "blockchain",
      "crypto",
      "cybersecurity",
      "security",
      "database",
      "web",
      "mobile",
      "ios",
      "android",
      "quality assurance",
      "sre",
      "automation",
      "product",
      "agile",
      "scrum",
      "network",
      "system",
      "systems",
      "information technology",
      "digital",
      "full stack",
      "front end",
      "backend",
      "back end",
      "saas",
      "paas",
      "big data",
      "data science",
      "devsecops",
      "nlp",
      "natural language processing",
      "vr",
      "ar",
      "virtual reality",
      "augmented reality",
      "robotics",
      "embedded",
      "firmware",
      "microcontroller",
      "fpga",
      "simulation",
      "cloud computing",
      "docker",
      "kubernetes",
      "container",
      "microservices",
      "serverless",
      "distributed systems",
      "e-commerce",
      "ecommerce",
      "internet",
      "digital transformation",
      "iot",
      "internet of things",
      "opensource",
      "open source",
      "technical",
      "computing",
      "computational",
      "scientist",
      "quantitative",
      "researcher",
      "analyst",
      "coder",
      "biology",
      "lab",
      "immunology",
      "chemistry",
      "analytical",
      "development",
      "supply chain",
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
    await fs.appendFile(this.processedLinksFile, link + "\n");
  }

  async delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
    jobs.forEach((job) => {
      if (!this.isTechJob(job.title)) {
        jobQueries.deleteJob(job.id);
      }
    });
  }

  parseRateLimitError(error) {
    const message = error.message || error.error?.message || "";
    const match = message.match(/Please try again in (\d+)(\.\d+)?m?s/);
    if (match) {
      const delay = parseFloat(match[1] + (match[2] || ""));
      return Math.ceil(delay * (match[0].includes("m") ? 1000 : 1));
    }
    return null;
  }

  calculateUrlSimilarity(url1, url2) {
    // Remove protocol (http:// or https://) and www. from both URLs
    const cleanUrl1 = url1.replace(/^(https?:\/\/)?(www\.)?/, "");
    const cleanUrl2 = url2.replace(/^(https?:\/\/)?(www\.)?/, "");

    // Split URLs into parts
    const parts1 = cleanUrl1.split("/");
    const parts2 = cleanUrl2.split("/");

    // Compare domain and first level of path
    if (parts1[0] !== parts2[0] || parts1[1] !== parts2[1]) {
      return 0; // URLs are completely different
    }

    // Count matching parts
    let matchingParts = 2; // Domain and first level already matched
    for (let i = 2; i < Math.min(parts1.length, parts2.length); i++) {
      if (parts1[i] === parts2[i]) {
        matchingParts++;
      } else {
        break; // Stop at first difference
      }
    }

    // Calculate similarity as a percentage
    return matchingParts / Math.max(parts1.length, parts2.length);
  }

  async fetchLinkedInPageContent(url, maxRetries = 3, retryDelay = 5000) {
    let browser;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Only proceed if the URL is a LinkedIn job or company link
        if (
          !url.includes("linkedin.com/jobs") &&
          !url.includes("linkedin.com/company")
        ) {
          throw new Error(
            "The provided URL is not a LinkedIn job or company link.",
          );
        }
        browser = await puppeteer.launch(BROWSER_CONFIG);
        const page = await browser.newPage();

        // Set a more realistic user agent
        await page.setUserAgent(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        );

        // Navigate to the LinkedIn page with a realistic delay and error handling
        try {
          await page.goto(url);
          await this.randomDelay(1000, 1500);
        } catch (navError) {
          console.error(`Navigation error: ${navError.message}. Retrying...`);
          continue;
        }

        const currentUrl = page.url();
        const similarity = this.calculateUrlSimilarity(currentUrl, url);

        if (similarity < 0.7) {
          console.log(
            `Current URL (${currentUrl}) differs significantly from intended URL (${url}). Navigating to login page...`,
          );
          await page.goto("https://www.linkedin.com/login");
        } else {
          console.log(
            `Current URL (${currentUrl}) is sufficiently similar to intended URL (${url}). Proceeding...`,
          );
        }

        await this.randomDelay(500, 1200);

        // Check if we're on the login page
        const isLoginPage =
          page.url().includes("login") ||
          page.url().includes("authwall") ||
          page.url().includes("signin");

        await this.randomDelay(900, 1300);

        if (isLoginPage) {
          console.log("Login required. Attempting to log in...");

          try {
            // Fill in the login form with realistic typing
            const emailSelector = await page.waitForSelector(
              'input[name="session_key"]',
              { timeout: 10000 },
            );
            await this.typeWithVariation(
              page,
              emailSelector,
              process.env.LINKEDIN_EMAIL,
            );

            const passwordSelector = await page.waitForSelector(
              'input[name="session_password"]',
              { timeout: 10000 },
            );
            await this.typeWithVariation(
              page,
              passwordSelector,
              process.env.LINKEDIN_PASSWORD,
            );

            await this.randomDelay(400, 700);

            // Click the login button
            await page.click('button[type="submit"]');

            // Wait for navigation
            await page.waitForNavigation({ waitUntil: "networkidle2" });

            // Add delay to allow page to stabilize after login
            await this.randomDelay(2000, 3000);

            // After login, navigate back to the original URL with a delay
            await page.goto(url);
          } catch (loginError) {
            console.error(`Login failed: ${loginError.message}. Retrying...`);
            continue;
          }
        }

        // Wait for the content to load with a realistic delay
        await this.randomDelay(100, 400);
        await page.waitForSelector("body");

        // Get the page content
        const content = await page.content();

        return content;
      } catch (error) {
        console.error(
          `Error fetching LinkedIn page ${url} (Attempt ${attempt}/${maxRetries}):`,
          error,
        );

        if (attempt === maxRetries) {
          throw error;
        } else {
          console.log(`Retrying in ${retryDelay / 1000} seconds...`);
          await this.randomDelay(retryDelay, retryDelay + 2000);
        }
      } finally {
        if (browser) {
          await browser.close();
        }
      }
    }
  }

  async randomDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1) + min);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  async typeWithVariation(page, element, text) {
    for (const char of text) {
      await element.type(char, { delay: Math.random() * 100 + 50 });
    }
  }

  async simulateScrolling(page) {
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = Math.floor(Math.random() * (350 - 150 + 1)) + 150;
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

  /**
   * Makes an HTTP request to fetch job data or page content.
   * @param {string} url - The URL to fetch data from.
   * @returns {Promise<Object>} - The response object containing the fetched data.
   */
  async makeRequest(url, useAxios = false) {
    // List of domains known to work well with axios
    const axiosCompatibleDomains = [
      'github.com',
      'stackoverflow.com',
      'medium.com',
      'greenhouse.io'
    ];
  
    // Check if the URL is from a domain known to work with axios
    const shouldUseAxios = useAxios || axiosCompatibleDomains.some(domain => url.includes(domain));
  
    if (shouldUseAxios) {
      try {
        const response = await axios.get(url, {
          maxRedirects: 5,
          validateStatus: function (status) {
            return status >= 200 && status < 300;
          },
        });
  
        if (response.status !== 200) {
          throw new Error(`HTTP request failed with status ${response.status}`);
        }
  
        // Additional checks for axios response quality
        if (response.data.length < 1000) {
          console.log("Response too short. Falling back to Puppeteer.");
          return await this.usePuppeteerFallback(url);
        }
  
        return response;
      } catch (error) {
        console.log(`Axios request failed for ${url}, falling back to Puppeteer:`, error.message);
        return await this.usePuppeteerFallback(url);
      }
    }
  
    // Default to Puppeteer for all other cases
    return await this.usePuppeteerFallback(url);
  }

  getRandomUserAgent() {
    const userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36 OPR/78.0.4093.184",
    ];

    const randomIndex = Math.floor(Math.random() * userAgents.length);

    return userAgents[randomIndex];
  }

  async usePuppeteerFallback(url) {
    let browser;
    try {
      browser = await puppeteer.launch(BROWSER_CONFIG);
      const page = await browser.newPage();
      await page.setUserAgent(this.getRandomUserAgent());
  
      console.log("Loaded the browser");
  
      // Enable request interception
      await page.setRequestInterception(true);
  
      // Create a promise that will resolve when we find job data
      const jobDataPromise = new Promise((resolve) => {
        page.on("request", (request) => {
          request.continue();
        });
  
        page.on("response", async (response) => {
          // Check for excluded domains
          const excludedDomains = ["linkedin.com", "epicgames.com", "tiktok.com", "googleapis.com"];
          if (excludedDomains.some((domain) => response.url().includes(domain))) {
            return;
          }
        
          const contentType = response.headers()["content-type"];
        
          if (contentType && contentType.includes("application/json")) {
            try {
              const responseText = await response.text();
              const responseData = JSON.parse(responseText);
              console.log("JSON response data:", responseData);
        
              // Handle Careerpuck response format
              if (responseData && responseData.jobBoard && responseData.jobBoard.atsSourcePlatform === "greenhouse") {
                const jobData = {
                  link: responseData.publicUrl || responseData.applyUrl,
                  title: responseData.title,
                  location: responseData.location,
                  description: responseData.content,
                  department: responseData.departments?.[0]?.name || null,
                  office: responseData.offices?.[0]?.name || null,
                  workType: responseData.workType || null,
                  workplaceType: responseData.workplaceType || null,
                  postedAt: responseData.postedAt
                };
        
                if (jobData.link && jobData.title) {
                  console.log(jobData);
                  console.log("Found Careerpuck job data");
                  resolve({
                    data: [jobData],
                    status: 200,
                    intercepted: true,
                    count: 1
                  });
                  return;
                }
              }
        
              // Handle departments format
              if (responseData && Array.isArray(responseData.departments)) {
                const departmentJobs = [];
                for (const department of responseData.departments) {
                  if (Array.isArray(department.jobs)) {
                    for (const job of department.jobs) {
                      if (job.absolute_url && job.title) {
                        departmentJobs.push({
                          link: job.absolute_url,
                          title: job.title,
                        });
                      }
                    }
                  }
                }
                if (departmentJobs.length > 0) {
                  console.log("Found job data in departments");
                  resolve({
                    data: departmentJobs,
                    status: 200,
                    intercepted: true,
                    count: departmentJobs.length,
                  });
                  return;
                }
              }
        
              // Handle positions format
              if (responseData && Array.isArray(responseData.positions)) {
                const count = responseData.count || 0;
                const positionJobs = responseData.positions
                  .map((position) => ({
                    link: position.id
                      ? `https://aexp.eightfold.ai/careers/job/${position.id}`
                      : null,
                    title: position.name,
                    location: position.location,
                    department: position.department,
                    business_unit: position.business_unit,
                    work_location_option: position.work_location_option,
                  }))
                  .filter((job) => job.link && job.title);
        
                if (positionJobs.length > 0) {
                  console.log("Found job data in positions");
                  resolve({
                    data: positionJobs,
                    status: 200,
                    intercepted: true,
                    count: positionJobs.length,
                  });
                  return;
                }
              }
            } catch (error) {
              console.error("Error parsing JSON response:", error.message);
            }
          }
        });
      });
  
      // Create a promise for page navigation
      const navigationPromise = page.goto(url, {
        waitUntil: "networkidle0",
        timeout: 30000, // 30 seconds timeout
      });
  
      // Race between finding job data and page navigation completion
      const result = await Promise.race([
        jobDataPromise,
        navigationPromise.then(async () => {
          await this.randomDelay(500, 1000);
          console.log("Page loaded");
          const content = await page.evaluate(() => {
            // Remove all script and style elements
            const scripts = document.querySelectorAll('script');
            const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
            
            scripts.forEach(script => script.remove());
            styles.forEach(style => style.remove());
            
            return document.documentElement.outerHTML;
          });
          
          return {
            data: content,
            status: 200,
          };
        }),
      ]);
  
      return result;
  
    } catch (error) {
      console.error("Puppeteer fallback failed:", error.message);
      return {
        data: null,
        status: 500,
        error: error.message,
      };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async usePuppeteerFallbackNoIntercept(url) {
    let browser;
    try {
      browser = await puppeteer.launch(BROWSER_CONFIG);
      const page = await browser.newPage();
      await page.setUserAgent(this.getRandomUserAgent());

      console.log("Loaded the browser no intercept lol");

      await page.goto(url, {
        waitUntil: "networkidle0",
        timeout: 30000, 
      });

      await this.randomDelay(500, 1000);
      console.log("Page loaded");
      const content = await page.content();

      return {
        data: content,
        status: 200,
      };
    } catch (error) {
      console.error("Puppeteer fallback failed:", error.message);
      return {
        data: null,
        status: 500,
        error: error.message,
      };
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
    const pathParts = parsedUrl.pathname.split("/").filter((part) => part);

    if (parsedUrl.hostname.includes("greenhouse.io")) {
      return pathParts[pathParts.length - 1];
    } else if (parsedUrl.hostname.includes("lever.co")) {
      return pathParts[0];
    } else {
      const subdomain = parsedUrl.hostname.split(".")[0];
      return subdomain !== "www" ? subdomain : pathParts[0];
    }
  }

  urlMatches(url1, url2) {
    const identifier1 = this.getCompanyIdentifier(url1);
    const identifier2 = this.getCompanyIdentifier(url2);
    return identifier1 === identifier2;
  }

  async collectJobLinksFromSimplify() {
    const simplifyUrl =
      "https://raw.githubusercontent.com/SimplifyJobs/Summer2025-Internships/refs/heads/dev/README.md";

    try {
      const response = await axios.get(simplifyUrl);
      const markdownContent = response.data;

      // Split the content into lines
      const lines = markdownContent.split("\n");

      // Find the start of the table by locating the header
      const tableStartIndex = lines.findIndex((line) =>
        line.startsWith("| Company"),
      );

      if (tableStartIndex === -1) {
        console.error("Table not found in the markdown content");
        return [];
      }

      // The table headers are at tableStartIndex, the separator is at tableStartIndex +1
      // The table data starts at tableStartIndex + 2
      const tableDataLines = lines.slice(tableStartIndex + 2);

      const jobLinks = [];
      let currentCompanyName = "";
      let currentCompanyLink = null;

      for (const line of tableDataLines) {
        // Stop processing if the line doesn't start with '|', indicating the end of the table
        if (!line.startsWith("|")) {
          break;
        }

        // Split the line into columns by '|', trimming whitespace
        const columns = line.split("|").map((col) => col.trim());

        // Ensure there are enough columns to process
        // Expected columns: [Empty, Company, Role, Location, Application/Link, Date Posted, ...]
        if (columns.length < 5) {
          continue; // Skip lines that don't have enough columns
        }

        const companyCell = columns[1];
        const role = columns[2];
        const location = columns[3];
        const applicationLinkCell = columns[4];
        const datePosted = columns[5] || "";

        // Check if the row is a main company entry or a sub-entry
        if (companyCell !== "↳") {
          // Extract company name and link using regex
          const companyMatch =
            /\*\*\[([^\]]+)\]\((https?:\/\/[^\)]+)\)\*\*/.exec(companyCell);
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
        const linkMatches = [
          ...applicationLinkCell.matchAll(/href="(https?:\/\/[^"]+)"/g),
        ].map((m) => m[1]);

        // Assign the extracted links
        let applyLink = null;
        let simplifyLink = null;
        if (linkMatches.length >= 2) {
          applyLink = linkMatches[0];
          simplifyLink = linkMatches[1];
        } else if (linkMatches.length === 1) {
          applyLink = linkMatches[0];
        }

        if (applyLink) {
          this.addToJobProcessingQueue(applyLink);
        } else {
          console.log(
            `No apply link found for ${currentCompanyName} - ${role}`,
          );
        }
      }

      console.log(`Found ${jobLinks.length} job links from SimplifyJobs`);

      await this.processSimplifyJobLinks(jobLinks);

      return jobLinks;
    } catch (error) {
      console.error("Error fetching SimplifyJobs internships:", error);
      return [];
    }
  }
  async processSimplifyJobLinks(jobLinks) {
    try {
      // Retrieve all existing company job links from the database
      const companyJobLinks = await jobQueries.getAllCompanyJobLinks();

      // Iterate over each job link in the provided array
      for (const jobLink of jobLinks) {
        try {
          // Check if the applyLink exists
          if (!jobLink.applyLink) {
            console.log(
              `No apply link found for ${jobLink.companyName} - ${jobLink.role}`,
            );
            continue; // Skip to the next jobLink
          }

          // Check if the job link already exists in the database
          const existingJob = companyJobLinks.find(
            (link) => link.link === jobLink.applyLink,
          );
          if (existingJob) {
            console.log(
              `Job posting for ${jobLink.companyName} - ${jobLink.role} already exists in the database`,
            );
            continue; // Skip to the next jobLink
          }

          // Process the job link to extract job data
          const jobData = await this.processJobLinkWithRetry(jobLink.applyLink);
          console.log("jobData", jobData);

          // If the job is not marked as skipped, add it to the database
          if (!jobData.skipped) {
            await jobQueries.createJobPosting(
              jobData.title ? jobData.title : "",
              jobData.salary ? jobData.salary : 0,
              jobData.experience_level ? jobData.experience_level : "",
              jobData.location ? jobData.location : "",
              new Date(),
              jobData.company_id
                ? jobData.company_id
                : jobData.companyId
                  ? jobData.companyId
                  : null,
              jobLink.applyLink ? jobLink.applyLink : "",
              null,
              jobData.tags ? jobData.tags.split(",") : [],
              jobData.description ? jobData.description : "",
              jobData.salary_max ? jobData.salary_max : 0,
              "1",
              jobData.skills ? jobData.skills.split(",") : [],
              jobData.benefits ? jobData.benefits.split(",") : [],
              jobData.additional_information
                ? jobData.additional_information
                : "",
              jobData.PreferredQualifications
                ? jobData.PreferredQualifications
                : "",
              jobData.MinimumQualifications
                ? jobData.MinimumQualifications
                : "",
              jobData.Responsibilities ? jobData.Responsibilities : "",
              jobData.Requirements ? jobData.Requirements : "",
              jobData.NiceToHave ? jobData.NiceToHave : "",
              jobData.Schedule ? jobData.Schedule : "",
              jobData.HoursPerWeek ? jobData.HoursPerWeek : 0,
              jobData.H1BVisaSponsorship ? jobData.H1BVisaSponsorship : 0,
              jobData.IsRemote ? jobData.IsRemote : 0,
              jobData.EqualOpportunityEmployerInfo
                ? jobData.EqualOpportunityEmployerInfo
                : "",
              jobData.Relocation ? jobData.Relocation : 0,
            );
            console.log(
              `Added job posting for ${jobData.company_name} - ${jobData.title} with company ID ${jobData.company_id ? jobData.company_id : jobData.companyId ? jobData.companyId : null}`,
            );
          } else {
            // Log the reason for skipping the job posting
            console.log(
              `Skipped job posting for ${jobLink.companyName} - ${jobData.reason}`,
            );
          }
        } catch (linkError) {
          // Log any errors that occur while processing the individual jobLink
          console.error(
            `Error processing job link for ${jobLink.companyName} - ${jobLink.role}: ${linkError.message}`,
          );
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
    try {
      const parsedUrl = new URL(jobBoardUrl);

      let links = await this.extractJobLinksFromPage(jobBoardUrl);
      console.log("links:", links);

      console.log(
        `Collected a total of ${links.length} job links from ${jobBoardUrl}`,
      );
      return { links };
    } catch (error) {
      console.error(`Error collecting job links from ${jobBoardUrl}:`, error);
      return { links: [] };
    }
  }

  getMaxPages($, jobBoardUrl) {
    // Implement logic to extract max pages based on the specific job board
    // This is just an example and should be adapted for each job board
    const paginationText = $(".pagination").text().trim();
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
      if (jobBoardUrl.includes("linkedin.com")) {
        return;
        await this.searchLinkedInJobs(allLinks);
      } else if (jobBoardUrl.includes("myworkdayjobs.com")) {
        const links = await this.grabWorkDayLinks(jobBoardUrl);
        return { companyId: company.id, links };
      } else {
        let $firstPage;
        try {
          const firstPageResponse = await this.makeRequest(jobBoardUrl);
          $firstPage = cheerio.load(firstPageResponse.data);

          if (jobBoardUrl.includes("linkedin.com")) {
            const paginationText = $firstPage(
              ".jobs-search-pagination__page-state",
            )
              .text()
              .trim();
            const match = paginationText.match(/Page \d+ of (\d+)/);
            if (match) {
              maxPages = 1;
            }
          }
        } catch (error) {
          console.error(`Error making request for ${jobBoardUrl}:`, error);
          return { companyId: company.id, links: [] };
        }

        const firstPageLinks = await this.extractJobLinks(
          $firstPage,
          jobBoardUrl,
        );

        firstPageLinks.forEach((link) => {
          if (
            !Array.from(allLinks).some(
              (existingLink) => existingLink.url.trim() === link.url.trim(),
            )
          ) {
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

  getPageUrl(baseUrl, pageNumber) {
    const url = new URL(baseUrl);
    const hostname = url.hostname;
    const paginationPrefix = this.paginationPreferences[hostname] || "?page=";

    if (pageNumber > 1) {
      if (paginationPrefix.includes("=")) {
        // For prefixes like '?page=' or '?skip='
        const [key, value] = paginationPrefix.split("=");
        url.searchParams.set(key.replace("?", ""), pageNumber.toString());
      } else {
        // For custom pagination formats
        return `${baseUrl}${paginationPrefix}${pageNumber}`;
      }
    }

    return url.toString();
  }

  async extractJobLinks($, baseUrl) {
    const links = new ObjectSet();
    console.log("baseUrl", baseUrl);

    if (baseUrl.includes("linkedin.com")) {
      const promises = [];
      $(".job-card-container").each((index, element) => {
        const linkElement = $(element).find(".job-card-container__link");
        const link = linkElement.attr("href").trim();
        const title = linkElement.text().trim();

        if (this.isTechJob(title)) {
          const jobUrl = new URL(link, baseUrl).href;
          promises.push(
            this.checkLinkedInApplyType(jobUrl).then((applyType) => {
              links.add(JSON.stringify({ url: jobUrl, applyType }));
            }),
          );
        }
      });
      await Promise.all(promises);
    } else {
      $("a").each((index, element) => {
        const link = $(element).attr("href");
        if (!link) return;

        const title = $(element).text().trim();
        if (!title) return; // Skip if title is empty after trimming
        const jobLinkPattern =
          /(\b(job|career|position|opportunity)\b.*)|.*(jobId=|jobID=|job_id=|positionId=|openingId=).*/i;

        // Only process links that are job postings
        if (!jobLinkPattern.test(link)) return;

        // Normalize the title by replacing special characters with spaces
        const normalizedTitle = title.replace(/[\/\-]/g, " ").toLowerCase();

        if (this.isTechJob(normalizedTitle)) {
          const jobUrl = new URL(link, baseUrl).href;
          links.add(JSON.stringify({ url: jobUrl }));
        } else {
          // console.log(`Not a tech job: ${title}`);
        }
      });
    }

    // Convert Set to Array and parse JSON strings back to objects
    return Array.from(links).map((link) => JSON.parse(link));
  }

  async fetchWithRender(url) {
    try {
      const renderUrl = `https://render-tron.appspot.com/render/${encodeURIComponent(url)}`;
      const response = await axios.get(renderUrl, {
        headers: {
          "User-Agent": "core/1.0 (support@getcore.dev)",
        },
        timeout: 15000, // 15 seconds timeout
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching rendered page for ${url}:`, error.message);
      throw error;
    }
  }

  async grabMicrosoftLinks(jobBoardUrl) {
    try {
      // Extract the base URL and query parameters
      const url = new URL(jobBoardUrl);
      const baseApiUrl =
        "https://gcsservices.careers.microsoft.com/search/api/v1/search";

      // Preserve original query parameters
      const params = new URLSearchParams(url.search);
      params.delete("pg"); // Remove page parameter if exists
      params.delete("pgSz"); // Remove page size parameter if exists

      let allJobs = [];
      let currentPage = 1;
      const jobsPerPage = 100;

      while (true) {
        // Construct the API URL with original params and pagination
        params.set("pg", currentPage);
        params.set("pgSz", jobsPerPage);
        const apiUrl = `${baseApiUrl}?${params.toString()}`;

        console.log("Fetching:", apiUrl);
        const response = await axios.get(apiUrl);
        const jobData = response.data.operationResult.result;

        if (!jobData.jobs || jobData.jobs.length === 0) {
          break; // No more jobs to fetch
        }

        const jobs = jobData.jobs.map((job) => ({
          title: job.title,
          link: `https://jobs.careers.microsoft.com/global/en/job/${job.jobId}`,
          location: job.properties.primaryLocation || "Unknown",
          date: job.postingDate,
        }));

        console.log("jobs", jobs);

        allJobs = allJobs.concat(jobs);
        console.log(
          `Fetched ${jobs.length} jobs from page ${currentPage}. Total: ${allJobs.length}`,
        );

        currentPage++;

        if (allJobs.length >= jobData.totalJobs) {
          break; // We've fetched all available jobs
        }
      }

      console.log(`Found a total of ${allJobs.length} Microsoft jobs`);
      return allJobs;
    } catch (error) {
      console.error("Error fetching Microsoft jobs:", error);
      return [];
    }
  }

  async extractJobLinksFromPage(jobBoardUrl) {
    if (jobBoardUrl.includes("myworkdayjobs.com"))
      return await this.grabWorkDayLinks(jobBoardUrl);
    if (jobBoardUrl.includes("microsoft.com"))
      return await this.grabMicrosoftLinks(jobBoardUrl);
    if (jobBoardUrl.includes("smartrecruiters.com"))
      return await this.grabSmartRecruiterLinks(jobBoardUrl);

    console.log(`Extracting job links from ${jobBoardUrl}`);
    let allLinks = [];

    try {
      let currentUrl = jobBoardUrl;
      let isLastPage = false;
      let processedUrls = new Set();

      while (!isLastPage) {
        if (processedUrls.has(currentUrl)) {
          console.log("Detected repeating page URL. Stopping pagination.");
          break;
        }
        processedUrls.add(currentUrl);

        console.log(`Processing page: ${currentUrl}`);
        const response = await this.makeRequest(currentUrl);
        if (response.intercepted) {
          console.log("Request intercepted");
          return [...allLinks, ...response.data];
        }

        const result = await this.fullExtractJobLinksFromPage(
          response.data,
          currentUrl,
          new URL(currentUrl).hostname,
        );
        allLinks = allLinks.concat(result.links);

        if (result.pagination.isLastPage || !result.pagination.nextPageUrl) {
          isLastPage = true;
        } else {
          currentUrl = result.pagination.nextPageUrl;
        }

        if (processedUrls.size >= 100) {
          console.log("Reached maximum page limit. Stopping pagination.");
          break;
        }
      }
    } catch (error) {
      console.error(`Error extracting job links from ${jobBoardUrl}:`, error);
    }

    return allLinks;
  }

  async fullExtractJobLinksFromPage(response, pageUrl, jobBoardDomain) {
    let $;
    if (response.data) {
      $ = cheerio.load(response.data);
    } else {
      $ = cheerio.load(response);
    }
    const links = [];
    const paginationInfo = {
      isFirstPage: true,
      isLastPage: true,
      isOnlyPage: true,
      nextPageUrl: null,
      prevPageUrl: null,
    };

    // Extract job links
    $("a").each((index, element) => {
      const href = $(element).attr("href");
      if (href) {
        const title = $(element).text().trim().toLowerCase();
        const fullUrl = new URL(href, pageUrl).href;

        // Check if the fullUrl is already in the links array
        if (links.some((link) => link.url === fullUrl)) {
          return;
        }

        for (const [company, rules] of Object.entries(this.urlExclusionRules)) {
          if (fullUrl.includes(company)) {
            if (rules.include && !fullUrl.includes(rules.include)) {
              return;
            }
            if (rules.exclude && fullUrl.includes(rules.exclude)) {
              return;
            }
          }
        }

        // Check if it's a tech job or contains relevant keywords
        const isTechJob = this.isTechJob(title);
        const hasRelevantKeyword = /apply|go|job|career/.test(title);
        const hasRelevantUrlParam = /jobid=|jid=|jobs|careers/.test(
          fullUrl.toLowerCase(),
        );

        if (isTechJob || hasRelevantKeyword || hasRelevantUrlParam) {
          links.push({
            url: fullUrl,
            title: title,
            applyType: "external",
          });
        }
      }
    });

    const domain = jobBoardDomain.replace(/^www\./, "");
    const paginationSelectors =
      this.paginationSelectorsMap[domain] ||
      this.paginationSelectorsMap["default"];

    console.log("jobBoardDomain", jobBoardDomain);
    console.log("paginationSelectors", paginationSelectors);

    // Check pagination
    const nextElement = $(paginationSelectors.next);
    const prevElement = $(paginationSelectors.prev);

    if (
      nextElement.length > 0 &&
      !nextElement.is(paginationSelectors.nextInactive)
    ) {
      paginationInfo.isLastPage = false;
      paginationInfo.isOnlyPage = false;
      if (nextElement.is("a")) {
        paginationInfo.nextPageUrl = new URL(
          nextElement.attr("href"),
          pageUrl,
        ).href;
      } else {
        const currentPage = new URL(pageUrl).searchParams.get("page") || "1";
        const nextPage = parseInt(currentPage) + 1;
        paginationInfo.nextPageUrl = new URL(`?page=${nextPage}`, pageUrl).href;
      }
    }

    if (
      prevElement.length > 0 &&
      !prevElement.is(paginationSelectors.prevInactive)
    ) {
      paginationInfo.isFirstPage = false;
      paginationInfo.isOnlyPage = false;
      if (prevElement.is("a")) {
        paginationInfo.prevPageUrl = new URL(
          prevElement.attr("href"),
          pageUrl,
        ).href;
      }
    }

    console.log("Pagination Info:", paginationInfo);

    return {
      links,
      pagination: paginationInfo,
    };
  }

  async checkLinkedInApplyType(jobUrl) {
    try {
      const response = await this.makeRequest(jobUrl);
      const $ = cheerio.load(response.data);
      const applyButton = $(".jobs-apply-button");

      if (applyButton.text().trim().toLowerCase() === "easy apply") {
        return "Easy Apply";
      } else {
        const externalLink = applyButton.attr("href");
        return externalLink ? { type: "External", url: externalLink } : "Apply";
      }
    } catch (error) {
      console.error(`Error checking apply type for ${jobUrl}:`, error);
      return "Unknown";
    }
  }

  async hasNextPage($, currentUrl) {
    // if greenhouse it doesnt have a next page
    if (currentUrl.includes("greenhouse.io")) {
      return false;
    }
    this.updateProgress({ currentAction: "Checking next page" });
    const url = new URL(currentUrl);

    try {
      // Specific handling for known job board domains
      if (url.hostname.includes("linkedin.com")) {
        return await this.hasNextPageLinkedIn($, url);
      } else if (url.hostname.includes("careers.microsoft.com")) {
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
    const start = parseInt(url.searchParams.get("start")) || 0;
    const nextStart = start + 25; // LinkedIn typically shows 25 jobs per page

    const nextPageUrl = new URL(url);
    nextPageUrl.searchParams.set("start", nextStart.toString());

    console.log(`Checking next page: ${nextPageUrl}`);

    try {
      const response = await this.makeRequest(nextPageUrl.toString());

      if (response.status === 200) {
        const $nextPage = cheerio.load(response.data);
        const jobCards = $nextPage(".base-card");

        if (jobCards.length > 0) {
          console.log(
            `Found ${jobCards.length} jobs on next page. Continuing...`,
          );
          return true;
        }
      }
    } catch (error) {
      console.error(`Error checking next page ${nextPageUrl}:`, error);
    }

    console.log("No more jobs found. Stopping pagination.");
    return false;
  }

  async hasNextPageMicrosoft($, url) {
    // Implement Microsoft-specific logic here
    // Return true if there's a next page, false otherwise
  }

  async hasNextPageGeneric($, url) {
    // Check for common pagination elements
    const nextPageLink = $(
      'a[rel="next"], a:contains("Next"), a:contains("»"), .pagination .next a',
    ).first();

    if (nextPageLink.length) {
      let nextPageUrl = nextPageLink.attr("href");

      // If the next page URL is relative, make it absolute
      if (nextPageUrl && !nextPageUrl.startsWith("http")) {
        nextPageUrl = new URL(nextPageUrl, url.origin).toString();
      }

      if (nextPageUrl && nextPageUrl !== url.toString()) {
        return nextPageUrl;
      }
    }

    // Check for page numbers in URL
    const pageParams = ["current", "page", "pg", "p"];
    let currentPage = 1;
    let pageParam = "";

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
      if (url.hostname.includes("bytedance.com")) {
        nextPageUrl.searchParams.set("current", (currentPage + 1).toString());
      } else if (pageParam === "current") {
        nextPageUrl.searchParams.set("current", (currentPage + 1).toString());
        // Ensure 'page' parameter is removed if it exists
        nextPageUrl.searchParams.delete("page");
      } else {
        nextPageUrl.searchParams.set(
          pageParam || "page",
          (currentPage + 1).toString(),
        );
      }

      console.log(`Checking next page: ${nextPageUrl}`);
      return nextPageUrl.toString();
    }

    console.log("No more jobs found. Stopping pagination.");
    return false;
  }

  extractJobLinksFromAPI(apiResponse) {
    const links = [];

    // Check if the response is an array of job postings
    if (Array.isArray(apiResponse)) {
      apiResponse.forEach((job) => {
        if (job.url || job.link || job.jobUrl) {
          links.push({
            url: job.url || job.link || job.jobUrl,
            title: job.title || job.jobTitle || "",
            company: job.company || job.companyName || "",
            location: job.location || "",
          });
        }
      });
    }
    // Check if the response is an object with a jobs array
    else if (apiResponse.jobs && Array.isArray(apiResponse.jobs)) {
      apiResponse.jobs.forEach((job) => {
        if (job.url || job.link || job.jobUrl) {
          links.push({
            url: job.url || job.link || job.jobUrl,
            title: job.title || job.jobTitle || "",
            company: job.company || job.companyName || "",
            location: job.location || "",
          });
        }
      });
    }
    // Check for nested structures (e.g., data.jobBoard.jobPostings)
    else if (
      apiResponse.data &&
      apiResponse.data.jobBoard &&
      Array.isArray(apiResponse.data.jobBoard.jobPostings)
    ) {
      apiResponse.data.jobBoard.jobPostings.forEach((job) => {
        if (job.id) {
          // Assuming job.id is used to construct the URL
          const jobUrl = `${this.baseUrl}/${job.id}`;
          links.push({
            url: jobUrl,
            title: job.title || "",
            company: this.company_name, // Assuming this is set elsewhere in the class
            location: job.locationName || "",
          });
        }
      });
    }

    // Filter out non-tech jobs
    return links.filter((link) => this.isTechJob(link.title));
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
        pageLinks.forEach((link) => allLinks.add(link));

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
        const backoffTime =
          rateLimitDelay * Math.pow(this.BACKOFF_FACTOR, retryCount);
        console.log(
          `Rate limit reached. Retrying in ${backoffTime / 1000} seconds...`,
        );
        await this.delay(backoffTime);
        return this.processJobLinkWithRetry(link, retryCount + 1);
      } else {
        throw error;
      }
    }
  }

  async processGreenhouseJobLink(url) {
    // get the company part of the url
    // https://job-boards.greenhouse.io/flexport/jobs/6035440?gh_jid=6035440 you should grab 'flexport'
    const company = url.split("/")[3];
    const companyUrl = `https://job-boards.greenhouse.io/${company}`;

    // return an object with title and description
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const title =
      $(".job__title>h1").text().trim() || $(".app-title").text().trim();
    const location =
      $(".body--metadata").text().trim() || $("div.location").text().trim();
    const descriptionHtml =
      $("div.job__description").html() || $("div#content").html();
    const logoSrc = $("img.logo").attr("src") || '';


      const companyId = await this.getOrCreateCompany(
        company,
        "",
        "",
        companyUrl,
        "",
        "",
        "",
        logoSrc,
        "",
      );

      console.log(companyId);

    const turndownService = new TurndownService({
      headingStyle: "atx", // Use ATX-style headings (e.g., # Heading)
      bulletListMarker: "-", // Use dashes for bullet lists
      codeBlockStyle: "fenced", // Use fenced code blocks
      emDelimiter: "*", // Use asterisks for emphasis
      strongDelimiter: "**", // Use double asterisks for strong emphasis
    });

    let descriptionMarkdown;
    if (descriptionHtml) {
      descriptionMarkdown = turndownService.turndown(descriptionHtml).trim();
    } else {
      descriptionMarkdown = "No description provided";
    }

    console.log({
      url,
      companyId,
      title,
      company,
      description: descriptionMarkdown,
      location,
    });
    return {
      url,
      companyId,
      title,
      company_name: company,
      company,
      description: descriptionMarkdown,
      location,
    };
  }

  async processJobViteLink(url) {
    // Extract the company name from the URL
    const urlParts = url.split("/");
    let company = urlParts[3];

    // Remove 'careers' or 'jobs' from the company name
    company = company.replace(/-careers|-jobs/g, "");

    // Remove any trailing hyphens
    company = company.replace(/-+$/, "");

    const companyUrl = `https://jobs.jobvite.com/${company}`;
    const companyId = await this.getOrCreateCompany(
      company,
      "",
      "",
      companyUrl,
      "",
      "",
      "",
      "",
      "",
    );
    console.log(companyId);

    // return an object with title and description
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const title = $("h2.jv-header").text().trim();
    const location =
      $(".jv-job-detail-meta").text().trim() ||
      $("h3.jv-sub-header").text().trim();
    const descriptionHtml = $("div.jv-job-detail-description").html();

    const turndownService = new TurndownService({
      headingStyle: "atx", // Use ATX-style headings (e.g., # Heading)
      bulletListMarker: "-", // Use dashes for bullet lists
      codeBlockStyle: "fenced", // Use fenced code blocks
      emDelimiter: "*", // Use asterisks for emphasis
      strongDelimiter: "**", // Use double asterisks for strong emphasis
    });

    let descriptionMarkdown;
    if (descriptionHtml) {
      descriptionMarkdown = turndownService.turndown(descriptionHtml).trim();
    } else {
      descriptionMarkdown = "No description provided";
    }

    console.log({
      url,
      companyId,
      title,
      company,
      description: descriptionMarkdown,
      location,
    });
    return {
      url,
      companyId,
      title,
      company,
      company_name: company,
      description: descriptionMarkdown,
      location,
    };
  }

  async processLeverJobLink(url) {
    // Remove '/apply' and any query parameters if present at the end of the URL
    url = url.split("/apply")[0].split("?")[0];

    // Ensure the URL is in the correct format
    const urlPattern = /^https:\/\/jobs\.lever\.co\/[^\/]+\/[a-f0-9-]+$/;
    if (!urlPattern.test(url)) {
      console.error("Invalid Lever job URL format:", url);
      return { error: "Invalid Lever job URL format" };
    }

    // Extract the company name from the URL
    const company = url.split("/")[3];
    const companyUrl = `https://jobs.lever.co/${company}`;

    // Fetch job details
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const title = $(".posting-headline h2").text().trim();
    const location = $(".location").text().trim();
    const experience_level = $(".commitment")
      .text()
      .replace("Internship/Co-Op", "Internship")
      .replace("/", "")
      .trim();
    const employmentType = $(".workplaceTypes").text().trim();
    const logoSrc = $(".main-header-logo img").attr("src");
    const companyId = await this.getOrCreateCompany(
      company,
      "",
      "",
      companyUrl,
      "",
      "",
      "",
    logoSrc,
      "",
    );

    const descriptionHtml =
      $('div.section.page-centered').not('.posting-header').map(function() {
        return $(this).html();
      }).get().join('');

    const turndownService = new TurndownService({
      headingStyle: "atx",
      bulletListMarker: "-",
      codeBlockStyle: "fenced",
      emDelimiter: "*",
      strongDelimiter: "**",
    });

    const descriptionMarkdown = turndownService
      .turndown(descriptionHtml)
      .trim();

    console.log({
      url,
      companyId,
      title,
      experience_level,
      employmentType,
      description: descriptionMarkdown,
      location,
    });
    return {
      url,
      companyId,
      company: company.charAt(0).toUpperCase() + company.slice(1),
      company_name: company.charAt(0).toUpperCase() + company.slice(1),
      title,
      experience_level,
      employmentType,
      description: descriptionMarkdown,
      location,
    };
  }

  async processBoFALink(url) {
    const company = "Bank of America";
    const companyId = await this.getOrCreateCompany(
      company,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    );
    console.log(companyId);

    // return an object with title and description
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const title = $(".job-description-body__title").text().trim();
    const location = $(".locations__names").text().trim();
    const descriptionHtml = $(".job-description-body__internal").html();

    const turndownService = new TurndownService({
      headingStyle: "atx", // Use ATX-style headings (e.g., # Heading)
      bulletListMarker: "-", // Use dashes for bullet lists
      codeBlockStyle: "fenced", // Use fenced code blocks
      emDelimiter: "*", // Use asterisks for emphasis
      strongDelimiter: "**", // Use double asterisks for strong emphasis
    });

    const descriptionMarkdown = turndownService
      .turndown(descriptionHtml)
      .trim();

    console.log({
      url,
      companyId,
      title,
      company_name: company,
      description: descriptionMarkdown,
      location,
    });
    return {
      url,
      companyId,
      title,
      company_name: company,
      description: descriptionMarkdown,
      location,
    };
  }

  convertWorkdayLink(url) {
    try {
      // Parse the URL
      const parsedUrl = new URL(url);

      // Extract the company name and wd number
      const hostParts = parsedUrl.hostname.split(".");
      const company = hostParts[0];
      const wdNumber = hostParts[1].replace("wd", "");

      // Construct the standardized URL
      const standardizedUrl = `https://${company}.wd${wdNumber}.myworkdayjobs.com/wday/cxs/${company}/Careers/jobs`;

      return standardizedUrl;
    } catch (error) {
      console.error("Error converting Workday link:", error.message);
      return null;
    }
  }

  async grabSmartRecruiterLinks(url) {
    console.log(`Grabbing SmartRecruiters links for ${url}`);
    const companyMatch = url.match(
      /https:\/\/careers\.smartrecruiters\.com\/([^/]+)/,
    );
    if (!companyMatch) {
      console.error("Invalid SmartRecruiters URL:", url);
      return [];
    }

    const company = companyMatch[1];
    const baseApiUrl = `https://careers.smartrecruiters.com/${company}/api/more`;
    let page = 1;
    let allJobs = [];
    let hasMorePages = true;

    while (hasMorePages) {
      try {
        const response = await axios.get(`${baseApiUrl}?page=${page}`);
        const data = response.data;
        const $ = cheerio.load(data);

        if (data.length === 0) {
          hasMorePages = false;
        } else {
          $("a").each((index, element) => {
            const href = $(element).attr("href");
            if (href && href.includes("job")) {
              const fullUrl = new URL(href, url).href;
              const title = $(element).find("h4").text().trim();
              allJobs.push({ link: fullUrl, title: title });
            }
          });
          page++;
        }
      } catch (error) {
        console.error(
          `Error fetching SmartRecruiters jobs for page ${page}:`,
          error,
        );
        hasMorePages = false;
      }
    }

    console.log(allJobs);
    console.log(
      `Collected ${allJobs.length} jobs from SmartRecruiters for ${company}`,
    );
    return allJobs;
  }

  async processC3AILink(url) {
    let browser;
    try {
      // Define the company
      const company = "C3.ai";
      const companyId = await this.getOrCreateCompany(
        company,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      );
      console.log(`Company ID: ${companyId}`);

      browser = await puppeteer.launch(BROWSER_CONFIG);
      const page = await browser.newPage();

      // Optional: Set a user-agent to mimic a real browser
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) " +
          "Chrome/113.0.0.0 Safari/537.36",
      );

      // Navigate to the URL and wait until the network is idle
      console.log(`Navigating to ${url}...`);
      await page.goto(url);

      // Introduce an explicit delay of 3 seconds to allow dynamic content to load
      console.log("Waiting for 3 seconds to ensure dynamic content loads...");
      await this.delay(3000);

      // Use Locators to wait for elements
      const titleLocator = page.locator(".app-title");
      await titleLocator.waitHand;
      const title = await titleLocator.textContent();
      console.log(`Title: ${title.trim()}`);

      const locationLocator = page.locator(".location");
      await locationLocator.wait();
      const location = await locationLocator.textContent();
      console.log(`Location: ${location.trim()}`);

      // Locate the description element
      const descriptionLocator = page.locator(
        "div.page > div.section > div.layoutArea > div.column > div.page > div.section > div.layoutArea > div.column",
      );
      await descriptionLocator.wait();
      const descriptionHtml = await descriptionLocator.evaluate(
        (el) => el.innerHTML,
      );

      if (!descriptionHtml) {
        console.log("No description found, skipping...");
        return { skipped: true, reason: "No description found" };
      }

      if (!this.isTechJob(title.trim())) {
        console.log("Not a tech job, skipping...");
        return { skipped: true, reason: "Not a tech job" };
      }

      // Convert HTML to Markdown
      const turndownService = new TurndownService({
        headingStyle: "atx",
        bulletListMarker: "-",
        codeBlockStyle: "fenced",
        emDelimiter: "*",
        strongDelimiter: "**",
      });

      const descriptionMarkdown = turndownService
        .turndown(descriptionHtml)
        .trim();
      console.log("Description converted to Markdown.");

      // Return the extracted data
      return {
        url,
        companyId,
        title: title.trim(),
        description: descriptionMarkdown,
        location: location.trim(),
      };
    } catch (error) {
      console.error(`Error processing URL ${url}:`, error);
      return { skipped: true, reason: "Error occurred" };
    } finally {
      if (browser) {
        await browser.close();
        console.log("Browser closed.");
      }
    }
  }

  async processWorkDayJobLink(url) {
    try {
      // Convert the original URL to the API URL
      const apiInfo = this.convertToWorkdayApiUrl(url);
      const apiUrl = apiInfo.link;
      const company = apiInfo.company;
      const tenant = apiInfo.tenant;
      const jobBoardUrl = `${company}.wd${apiInfo.wdNumber}.myworkdayjobs.com/${tenant}`;

      // Make the request to the Workday API
      const response = await axios.get(apiUrl);
      const data = response.data;
      console.log("Workday API data:", data);

      // Extract relevant information
      const jobPostingInfo = data.jobPostingInfo;
      const title = jobPostingInfo.title;
      const location = jobPostingInfo.location;
      const postedDate = jobPostingInfo.postedOn;
      const startDate = jobPostingInfo.startDate;
      const descriptionHtml = jobPostingInfo.jobDescription;
      // const hiringOrganization = data.hiringOrganization;

      const companyId = await this.getOrCreateCompany(
        company,
        "",
        "",
        jobBoardUrl,
        "",
        "",
        "",
        "",
        "",
      );
      // Convert HTML description to Markdown
      const turndownService = new TurndownService();
      const descriptionMarkdown = turndownService.turndown(descriptionHtml);

      // Construct the job data object
      const jobData = {
        title,
        companyId,
        company,
        company_name: company,
        location,
        description: descriptionMarkdown,
        url: jobPostingInfo.externalUrl || url,
      };

      return jobData;
    } catch (error) {
      console.error("Error processing Workday job link:", error);
      throw error;
    }
  }

  async processAbbVieLink(url) {
    const company = "AbbVie";
    const companyId = await this.getOrCreateCompany(
      company,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    );
    console.log(companyId);

    // return an object with title and description
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const title = $(".header__text").text().trim();
    const location = $(".attrax-job-information-widget__freetext-field-value")
      .text()
      .trim();
    const descriptionHtml = $(".description-widget").html();

    const turndownService = new TurndownService({
      headingStyle: "atx", // Use ATX-style headings (e.g., # Heading)
      bulletListMarker: "-", // Use dashes for bullet lists
      codeBlockStyle: "fenced", // Use fenced code blocks
      emDelimiter: "*", // Use asterisks for emphasis
      strongDelimiter: "**", // Use double asterisks for strong emphasis
    });

    const descriptionMarkdown = turndownService
      .turndown(descriptionHtml)
      .trim();

    return {
      url,
      companyId,
      title,
      company_name: company,
      description: descriptionMarkdown,
      location,
    };
  }

  async processSmartRecruiterJob(url) {
    const response = await this.makeRequest(url);
    const data = response.data;
    const $ = cheerio.load(data);

    const company =
      $('meta[property="og:site_name"]').attr("content") || url.split("/")[3];
    const companyUrl = `https://jobs.smartrecruiters.com/${company}`;
    const companyId = await this.getOrCreateCompany(
      company,
      "",
      "",
      companyUrl,
      "",
      "",
      "",
      "",
      "",
    );

    const title =
      $("h1.job-title").text().trim() || $(".app-title").text().trim();
    const location =
      $('meta[name="twitter:data1"]').attr("value") ||
      $('li[itemprop="jobLocation"]').text().trim();
    const descriptionHtml =
      $('div[itemprop="description"]').html() ||
      $("div.job__description").html() ||
      $("div#content").html();

    const turndownService = new TurndownService({
      headingStyle: "atx", // Use ATX-style headings (e.g., # Heading)
      bulletListMarker: "-", // Use dashes for bullet lists
      codeBlockStyle: "fenced", // Use fenced code blocks
      emDelimiter: "*", // Use asterisks for emphasis
      strongDelimiter: "**", // Use double asterisks for strong emphasis
    });

    let descriptionMarkdown;
    if (descriptionHtml) {
      descriptionMarkdown = turndownService.turndown(descriptionHtml).trim();
    } else {
      descriptionMarkdown = "No description provided";
    }

    console.log({
      url,
      companyId,
      title,
      company,
      company_name: company,
      description: descriptionMarkdown,
      location,
    });
    return {
      url,
      companyId,
      title,
      company,
      company_name: company,
      description: descriptionMarkdown,
      location,
    };
  }

  async processMicrosoftJob(url) {
    try {
      // Extract job ID from the URL
      const jobIdMatch = url.match(/\/job\/(\d+)/);
      if (!jobIdMatch) {
        console.error("Could not extract job ID from URL:", url);
        return null;
      }
      const jobId = jobIdMatch[1];

      // Construct the API URL
      const apiUrl = `https://gcsservices.careers.microsoft.com/search/api/v1/job/${jobId}?lang=en_us`;

      // Make the request to the Microsoft API
      const response = await axios.get(apiUrl);
      const jobData = response.data.operationResult.result;

      // Extract relevant information from the API response
      const extractedData = {
        title: jobData.title,
        company_name: "Microsoft",
        company: "Microsoft",
        location:
          this.formatLocation(jobData.primaryWorkLocation) +
          "; " +
          jobData.workLocations
            .map((loc) => this.formatLocation(loc))
            .join("; "),
        description: this.stripHtmlTags(jobData.description),
        PreferredQualifications: this.stripHtmlTags(jobData.qualifications),
        Responsibilities: this.stripHtmlTags(jobData.responsibilities),
        skills: jobData.skills ? jobData.skills.join(", ") : "",
        experience_level: this.determineExperienceLevel(jobData.title),
        employmentType: jobData.employmentType,
        category: jobData.category,
        subcategory: jobData.subcategory,
        roleType: jobData.roleType,
        travelPercentage: jobData.travelPercentage,
        postedDate: jobData.posted.external,
        workSiteFlexibility: jobData.workSiteFlexibility,
        jobStatus: jobData.jobStatus,
        additionalLocations: jobData.workLocations
          .map((loc) => this.formatLocation(loc))
          .join("; "),
        url: url,
      };

      // Get or create company
      const companyId = await this.getOrCreateCompany(
        "Microsoft",
        "",
        "",
        "https://careers.microsoft.com",
        "Technology",
        "10,000+",
        "MSFT",
        "/src/microsoftlogo.png",
        "1975-04-04",
      );

      return { ...extractedData, companyId };
    } catch (error) {
      console.error("Error processing Microsoft job:", error);
      return null;
    }
  }

  async processAppleJob(url) {
    const response = await this.makeRequest(url);
    const data = response.data;
    const $ = cheerio.load(data);

    // title #jdPostingTitle
    // description #jd-job-summary and #jd-description and #jd-posting-supplement-footer-0
    // location #job-location-name
    // PreferredQualifications #jd-preferred-qualifications
    // EqualOpportunityEmployerInfo #jd-eeo-statement
    // MinimumQualifications #jd-education-experience
    // HoursPerWeek #jobWeeklyHours

    const title = $("#jdPostingTitle")
      .text()
      .trim()
      .replace("US-", "")
      .replace("CA-", "");
    const description =
      $("#jd-job-summary").text().trim() +
      $("#jd-description").text().trim() +
      $("#jd-posting-supplement-footer-0").text().trim() +
      $("#jd-key-qualifications").text().trim() +
      $("#jd-education-experience").text().trim();
    const location = $("#job-location-name").text().trim();
    const preferredQualifications = $("#jd-preferred-qualifications")
      .text()
      .trim();
    const equalOpportunityEmployerInfo = $("#jd-eeo-statement").text().trim();
    const hoursPerWeek = $("#jobWeeklyHours").text().trim();
    let sourcePostingDate = $("#jobPostDate").text().trim(); // e.g., "Aug 15, 2024"
    const date = new Date(sourcePostingDate);

    if (isNaN(date)) {
      console.error("Invalid date format:", sourcePostingDate);
    } else {
      console.log("Parsed Date:", date);
    }

    const company = "Apple";
    const companyId = await this.getOrCreateCompany(
      company,
      "",
      "",
      "https://jobs.apple.com",
      "Technology",
      "10,000+",
      "AAPL",
      "/src/applelogo.png",
      "1976-04-01",
    );

    return {
      url,
      companyId,
      title,
      company,
      company_name: company,
      description,
      location,
      preferredQualifications,
      equalOpportunityEmployerInfo,
      hoursPerWeek,
      sourcePostingDate,
    };

    // const company = 'Apple';
    // const companyId = await this.getOrCreateCompany(company, '', '', 'https://jobs.apple.com', 'Technology', '10,000+', 'AAPL', '/src/applelogo.png', '1976-04-01');
  }

  async grabWorkDayLinks(url) {
    const browser = await puppeteer.launch(BROWSER_CONFIG);
    const page = await browser.newPage();

    this.updateProgress({
      phase: "Grabbing Workday links",
      totalJobs: 0,
      processedJobs: 0,
      currentAction: "Grabbing Workday links",
    });
    // Enable request interception
    await page.setRequestInterception(true);

    let allJobs = [];
    let interceptedData = null;
    let postData = null;

    page.on("request", (request) => {
      if (request.resourceType() === 'image' || request.resourceType() === 'stylesheet' || request.resourceType() === 'font') {
        request.abort();
      } else if (request.url().includes("/jobs") && request.method() === "POST") {
        postData = request.postData();
        request.continue();
      } else {
        request.continue();
      }
    });

    page.on("response", async (response) => {
      if (
        response.url().includes("/jobs") &&
        response.request().method() === "POST"
      ) {
        const requestUrl = response.request().url();
        console.log(requestUrl);
        try {
          const data = await response.json();
          if (data && data.jobPostings) {
            interceptedData = data;
            interceptedData.url = requestUrl;
          }
        } catch (error) {
          console.error("Error parsing response:", error);
        }
      }
    });

    try {
      // Navigate to the page
      await page.goto(url, { waitUntil: "networkidle0" });

      // Wait for the job postings data to be intercepted
      while (!interceptedData) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Process the intercepted data
      let total = interceptedData.total;
      allJobs = interceptedData.jobPostings.map((job) => ({
        ...job,
        externalPath: `${url.replace("/jobs", "")}${job.externalPath}`,
      }));

      this.updateProgress({
        phase: "Grabbing Workday links",
        totalJobs: total,
        processedJobs: allJobs.length,
        currentAction: "Grabbing Workday links",
      });

      console.log(`Fetched ${allJobs.length} out of ${total} jobs`);

      this.updateProgress({
        phase: "Grabbing Workday links",
        totalJobs: total,
        processedJobs: allJobs.length,
        currentAction: "Grabbing Workday links",
      });

      // Continue fetching if there are more jobs
      while (allJobs.length < total) {
        const offset = allJobs.length;
        const limit = Math.min(20, total - allJobs.length); // Assuming 20 is the default limit

        // Update the postData with new offset and limit
        const updatedPostData = JSON.parse(postData);
        updatedPostData.offset = offset;
        updatedPostData.limit = limit;

        // Add a random delay between 2 to 5 seconds
        const delay = Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000;
        await new Promise((resolve) => setTimeout(resolve, delay));

        this.updateProgress({
          phase: "Grabbing Workday links",
          totalJobs: total,
          processedJobs: allJobs.length,
          currentAction: "Grabbing Workday links",
        });

        // Make a new POST request
        const response = await axios.post(
          interceptedData.url,
          updatedPostData,
          {
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            },
            timeout: 30000
          }
        );

        const newData = response.data;
        const newJobs = newData.jobPostings.map((job) => ({
          ...job,
          externalPath: `${url.replace("/jobs", "")}${job.externalPath}`,
        }));

        allJobs = allJobs.concat(newJobs);
        console.log(`Fetched ${allJobs.length} out of ${total} jobs`);

        this.updateProgress({
          phase: "Grabbing Workday links",
          totalJobs: total,
          processedJobs: allJobs.length,
          currentAction: "Grabbing Workday links",
        });
      }

      return allJobs;
    } catch (error) {
      console.error("Error fetching job data:", error.message);
      return null;
    } finally {
      await browser.close();

      this.updateProgress({
        phase: "Grabbing Workday links",
        totalJobs: 0,
        processedJobs: 0,
        currentAction: "Grabbing Workday links",
      });
    }
  }

  // Helper function to convert the original URL to the API URL
  convertToWorkdayApiUrl(originalUrl) {
    const url = new URL(originalUrl);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const company = url.hostname.split(".")[0];
    const wdNumber = url.hostname.split(".")[1].replace("wd", "");
    const tenant = pathParts[1];

    const response = {
      company,
      tenant,
      link: `https://${company}.wd${wdNumber}.myworkdayjobs.com/wday/cxs/${company}/${tenant}/job/${pathParts.slice(3).join("/")}`,
    };
    return response;
  }

  // Helper function to determine experience level based on job title
  determineExperienceLevel(title) {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes("senior") || lowerTitle.includes("sr.")) {
      return "Senior";
    } else if (lowerTitle.includes("junior") || lowerTitle.includes("jr.")) {
      return "Junior";
    } else if (lowerTitle.includes("lead") || lowerTitle.includes("manager")) {
      return "Lead";
    } else if (lowerTitle.includes("intern")) {
      return "Internship";
    } else {
      return "Mid Level";
    }
  }

  // Helper function to format location
  formatLocation(location) {
    return `${location.city}, ${location.state}, ${location.country}`.trim();
  }

  // Helper function to strip HTML tags
  stripHtmlTags(html) {
    return html.replace(/<[^>]*>/g, "").trim();
  }

  async processGenericJob(data) {
    // use gemini to extract the data
  }

  // Define a dictionary of job processing rules for different websites
  jobProcessingRules = {
    "pfizer.com": {

      selectors: {
        title: "h1.posting-title",
        location: "div.locations",
        description: "div.posting-description",
        additional_information: "div.locations",
      },
      company: {
        name: "Pfizer",
        jobBoardUrl: "https://www.pfizer.com/about/careers/search-results?region%5B0%5D=United%20States%20of%20America"
      },
    },

    "careerpuck.com": {
      selectors: {
        title: "h1 > .role",
        description: ".job-description",
        location: '[data-testing="job-title-header"] > .JobPagePublic__Location'
      }, 
      company: {
        name: (url) => decodeURIComponent(url.split("/")[4]),
        jobBoardUrl: (company) => `https://app.careerpuck.com/job-board/${encodeURIComponent(company)}`,
      },
    },


    "stripe.com": {
      selectors: {
        title: ".JobsDetail__header h1.Copy__title",
        location:
          '.JobDetailCardProperty:contains("Office locations") p:last-child',
        description: ".RowLayout",
        additional_information: "div.JobsDetailCard",
      },
      company: {
        name: "Stripe",
        jobBoardUrl: "https://stripe.com/jobs/search?skip=0",
      },
    },

    "epicgames.com": {
      selectors: {
        title: "h1.heading",
        location:
          'div[class*="sc-"] span[class*="sc-"] strong:contains("Location") + p',
        description: ".copy-wrapper .raw-copy",
      },
      company: {
        name: "Epic Games",
        jobBoardUrl: "https://www.epicgames.com/site/en-US/careers/jobs",
      },
    },
    "wiz.io": {
      selectors: {
        title: "div h1.text-4xl",
        location: "div h3.mt-4",
        description: "article.prose",
      },
      company: {
        name: "Wiz",
        jobBoardUrl: "https://wiz.io/careers",
      },
    },
    "careers.tiktok.com": {
      selectors: {
        title: 'span[data-test="jobTitle"]',
        location: ".infoText__EbiXW:first",
        type: ".infoText__EbiXW:eq(1)",
        department: ".infoText-category__bhDhu",
        description: ".block-content",
      },
      company: {
        name: "TikTok",
        jobBoardUrl: "https://careers.tiktok.com/search",
      },
    },
    "ashbyhq.com": {
      selectors: {
        title: "h1.ashby-job-posting-heading",
        location: 'div._section_101oc_37:contains("Location") p',
        type: 'div._section_101oc_37:contains("Type") p',
        department: 'div._section_101oc_37:contains("Department") p',
        compensation: 'div._section_101oc_37:contains("Compensation") div p',
        description: "#overview>div",
      },
      company: {
        name: (url) => decodeURIComponent(url.split("/")[3]),
        jobBoardUrl: (company) => `https://jobs.ashbyhq.com/${encodeURIComponent(company)}`,
      },
    },
  };

  async processJobWithRules(url, rules) {
    const response = await this.makeRequest(url);
    const data = response.data;
    const $ = cheerio.load(data);

    const result = {};
    for (const [key, selector] of Object.entries(rules.selectors)) {
      result[key] = $(selector).text().trim();
      if (key === "location" && result[key].length > 200) {
        result[key] = result[key].substring(0, 200);
      }
      if (key === "description" || key === "additional_information") {
        result[key] = $(selector).text().trim();
      }
    }

    const company =
      typeof rules.company.name === "function"
        ? rules.company.name(url)
        : rules.company.name;
    const jobBoardUrl =
      typeof rules.company.jobBoardUrl === "function"
        ? rules.company.jobBoardUrl(company)
        : rules.company.jobBoardUrl;

    const companyId = await this.getOrCreateCompany(
      company,
      "",
      "",
      jobBoardUrl,
      "",
      "",
      "",
      "",
      "",
    );

    return {
      url,
      companyId,
      company,
      company_name: company,
      ...result,
      additional_information:
        result.additional_information ||
        `${result.type || ""} ${result.department || ""} ${result.compensation || ""}`.trim(),
    };
  }

  async processStripeLink(url) {
    return this.processJobWithRules(url, this.jobProcessingRules["stripe.com"]);
  }

  async processPfizerLink(url) {
    if (url.includes("about/careers/job/")) {
      return this.processJobWithRules(url, this.jobProcessingRules["pfizer.com"]);
    }
  }

  async processEpicGamesJob(url) {
    return this.processJobWithRules(
      url,
      this.jobProcessingRules["epicgames.com"],
    );
  }

  async processCareerPuckJob(url) {
    return this.processJobWithRules(
      url,
      this.jobProcessingRules["careerpuck.com"],
    );
  }

  async processTiktokJobLink(url) {
    return this.processJobWithRules(
      url,
      this.jobProcessingRules["careers.tiktok.com"],
    );
  }

  async processWizJobLink(url) {
    return this.processJobWithRules(url, this.jobProcessingRules["wiz.io"]);
  }

  async processAshByHqLink(url) {
    return this.processJobWithRules(
      url,
      this.jobProcessingRules["ashbyhq.com"],
    );
  }

  isJobLink(url) {
    for (const [company, patterns] of Object.entries(this.companyJobUrls)) {
      if (url.includes(company)) {
        return patterns.some((pattern) => url.includes(pattern));
      }
    }

    // Check if the URL contains 'job', 'jid', or 'career'
    const keywords = ['job', 'jid', 'career', 'apply', 'vacancy', 'position', 'employment', 'work'];
    const containsKeyword = keywords.some(keyword => url.includes(keyword));
    
    if (containsKeyword) {
      return true;
    }

    console.log("No patterns found for:", url);
    return false;
  }

  async processEightFoldLink(url) {
    const response = await this.usePuppeteerFallbackNoIntercept(url);
    const data = response.data;
    const $ = cheerio.load(data);

    const title = $("h1.position-title").text().trim();
    const location = $(".col-md-12 p.position-location").text().trim();
    const descriptionHtml = $(".col-md-12 .position-job-description").html();
    
    const company_name = url.split('/')[2].split('.')[0];

    const turndownService = new TurndownService({
      headingStyle: "atx", // Use ATX-style headings (e.g., # Heading)
      bulletListMarker: "-", // Use dashes for bullet lists
      codeBlockStyle: "fenced", // Use fenced code blocks
      emDelimiter: "*", // Use asterisks for emphasis
      strongDelimiter: "**", // Use double asterisks for strong emphasis
    });

    const descriptionMarkdown = turndownService
      .turndown(descriptionHtml)
      .trim();

    return {
      url,
      title,
      company: company_name,
      location,
      description: descriptionMarkdown,
    };
  }


  async processJobLink(link) {
    if (this.currentJobLinks.has(link)) {
      return {skipped: true, reason: "Already processed"};
    
    }

    if (typeof link !== "object" && typeof link !== "string") {
      console.error("Invalid link type:", typeof link);
      return { error: "Invalid link type" };
    }

    const url = typeof link === "object" && link.url ? link.url : link;

    if (typeof url !== "string" || !url.startsWith("http")) {
      console.error("Invalid URL:", url);
      return { error: "Invalid URL" };
    }

    const isJobLink = this.isJobLink(url);
    if (!isJobLink) {
      return { skipped: true, reason: "Not a job link" };
    }

    const jobProcessors = [
      {
        keyword: "greenhouse.io",
        processor: this.processGreenhouseJobLink.bind(this),
      },
      {
        keyword: "bankofamerica.com",
        processor: this.processBoFALink.bind(this),
      },
      { keyword: "ashbyhq.com", processor: this.processAshByHqLink.bind(this) },
      { keyword: "stripe.com", processor: this.processStripeLink.bind(this) },
      { keyword: "pfizer.com", processor: this.processPfizerLink.bind(this) },
      { keyword: "abbvie.com", processor: this.processAbbVieLink.bind(this) },
      { keyword: "c3.ai", processor: this.processC3AILink.bind(this) },
      { keyword: "eightfold", processor: this.processEightFoldLink.bind(this) },
      { keyword: "wiz.io", processor: this.processWizJobLink.bind(this) },
      { keyword: "lever.co", processor: this.processLeverJobLink.bind(this) },
      { keyword: "jobvite.com", processor: this.processJobViteLink.bind(this) },
      {
        keyword: "careers.tiktok.com",
        processor: this.processTiktokJobLink.bind(this),
      },
      {
        keyword: "myworkdayjobs.com",
        processor: this.processWorkDayJobLink.bind(this),
      },
      {
        keyword: "linkedin.com",
        processor: async (url) => {
          const response = await this.makeRequest(url);
          return this.processLinkedInJob(response.data);
        },
      },
      {
        keyword: "smartrecruiters.com",
        processor: this.processSmartRecruiterJob.bind(this),
      },
      {
        keyword: "microsoft.com",
        processor: this.processMicrosoftJob.bind(this),
      },
      { keyword: "apple.com", processor: this.processAppleJob.bind(this) },
      {
        keyword: "epicgames.com",
        processor: this.processEpicGamesJob.bind(this),
      },
      {
        keyword: "careerpuck.com",
        processor: this.processCareerPuckJob.bind(this),
      },
    ];

    for (const { keyword, processor } of jobProcessors) {
      if (url.includes(keyword)) {
        return await processor(url);
      }
    }
/*
    const response = await this.makeRequest(url);
    console.log(response.data);
    return await this.useGeminiAPI(url, response.data);
    */
  }

  async getBrowserInstance() {
    if (!this.browser) {
      this.browser = await puppeteer.launch(BROWSER_CONFIG);
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
      "Software Engineer",
      "Data Scientist",
      "Product Manager",
      "DevOps Engineer",
      "Frontend Developer",
      "Backend Developer",
      "Full Stack Developer",
      "Machine Learning Engineer",
      "Cloud Architect",
      "Cybersecurity Analyst",
      "UX Designer",
      "Mobile Developer",
      "AI Engineer",
      "Blockchain Developer",
      "QA Engineer",
      "Data Engineer",
      "Systems Architect",
      "Network Engineer",
      "Database Administrator",
      "IT Project Manager",
    ];
  }

  async useGeminiAPI(link, textContent) {
    const model = this.genAI.getGenerativeModel({
      model: "gemini-1.5-flash-8b",
    });
    const prompt = this.generatePrompt(link, textContent);
    const result = await model.generateContent(prompt);
    let response = await result.response;
    response = response.text();
    response = response.replace(/```json\n/, "").replace(/\n```/g, "");
    try {
      const jsonResponse = JSON.parse(response);
      return jsonResponse;
    } catch (error) {
      console.error("Error parsing JSON:", error);
      return response;
    }
  }

  async useChatGPTAPI_CompanyInfo(link, textContent) {
    const industriesEnum = [
      "Agriculture",
      "Automotive",
      "Aviation",
      "Biotechnology",
      "Chemicals",
      "Construction",
      "Consulting",
      "Education",
      "Energy",
      "Entertainment",
      "Finance",
      "Food and Beverage",
      "Healthcare",
      "Hospitality and Tourism",
      "Information Technology",
      "Insurance",
      "Legal",
      "Manufacturing",
      "Media and Communications",
      "Nonprofit",
      "Pharmaceuticals",
      "Real Estate",
      "Retail",
      "Telecommunications",
      "Transportation and Logistics",
      "Utilities",
      "Veterinary Sciences",
      "Mining",
      "Environmental Services",
      "Public Sector",
      "Defense",
      "Fashion",
      "Gaming",
      "Healthcare Technology",
      "Renewable Energy",
      "E-commerce",
      "Cybersecurity",
      "Data Analytics",
      "Artificial Intelligence",
      "Other",
    ];

    const companyResponse = z.object({
      name: z.string(),
      description: z.string(),
      industry: z.string(z.enum(industriesEnum)),
      location: z.string(),
      size: z.string().nullable(),
      stock_symbol: z.string().nullable(),
      logo: z.string().nullable(),
      founded: z.string().nullable(),
    });

    const maxCharacters = 200000;
    const truncatedTextContent =
      textContent.length > maxCharacters
        ? textContent.slice(0, maxCharacters)
        : textContent;

    const prompt = `
          ${truncatedTextContent}
          `;
    try {
      const completion = await this.openai.beta.chat.completions.parse({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
            From the job posting data at ${link}, please extract or provide the following information about the company:
            - name
            - description
            - industry
          - location (where the city is based out of: city, state)
          - size (estimated number of employees)
          - stock_symbol (nullable)
          - logo (usually default to the format of /src/<company-name>logo.png, do not include space in the company logo)
          - full date company was founded (datetime format, string)
          Provide the extracted information in JSON format.`,
          },
          { role: "user", content: prompt },
        ],
        response_format: zodResponseFormat(companyResponse, "companyResponse"),
      });

      const message = completion.choices[0]?.message;
      return message.parsed;
    } catch (error) {
      console.error("OpenAI API Error:", error.message);
      throw error;
    }
  }

  async verifyAndUpdateCompanyData() {
    const companies = await jobQueries.getCompaniesWithJobPostings(5);

    this.updateProgress({
      phase: "Verifying and updating company data",
      totalCompanies: companies.length,
      processedCompanies: 0,
    });

    for (const [index, company] of companies.entries()) {
      if (company.id === 8) {
        this.updateProgress({
          currentAction: "Skipping company with id 8: " + company.name,
        });
        console.log(`Skipping company with id 8: ${company.name}`);
        continue;
      }

      this.updateProgress({
        company: company.name,
        processedCompanies: index + 1,
        currentAction: "Verifying company data",
      });

      const missingFields = this.checkMissingFields(company);

      if (missingFields.length > 4) {
        this.updateProgress({
          currentAction: "Updating company data for " + company.name,
        });

        const prompt = this.generateCompanyPrompt({ name: company.name });
        this.updateProgress({
          currentAction: "Generating prompt for " + company.name,
        });
        let updatedData;

        try {
          if (this.useGemini) {
            updatedData = await this.useGeminiAPI(company.name, prompt);
          } else {
            updatedData = await this.useChatGPTAPI_CompanyInfo(
              company.name,
              prompt,
            );
          }

          // Merge existing data with updated data
          const mergedData = { ...company, ...updatedData };
          console.log("Merged data:", mergedData);

          // Update company in the database
          await jobQueries.forceUpdateCompany(company.id, mergedData);

          this.updateProgress({
            currentAction: "Updated company data for " + company.name,
          });
          console.log(`Updated company data for ${company.name}`);
        } catch (error) {
          this.updateProgress({
            currentAction: "Error updating data for " + company.name,
          });
          console.error(`Error updating data for ${company.name}:`, error);
        }
      } else {
        console.log(`Company data for ${company.name} is complete`);
      }
    }

    this.updateProgress({ phase: "Company data verification completed" });
  }

  checkMissingFields(company) {
    const requiredFields = [
      "name",
      "location",
      "description",
      "industry",
      "founded",
      "size",
      "stock_symbol",
      "company_stage",
      "company_recent_news_sentiment",
      "company_sentiment",
      "company_issues",
      "company_engineer_choice",
      "company_website",
      "twitter_username",
      "company_linkedin_page",
    ];

    return requiredFields.filter((field) => !company[field]);
  }

  generateJobSystemPrompt() {
    return `
    Analyze the information for the job posting given and sort the data such that you can extract the information:
      JobPosting = {
        title: string,
        location: string, // if there are multiple locations, separate them with a | character, format each date as 'City, State', max of 200 characters
        description: string, // write about what the ideal candidate for the job posting is like? who's the person they're looking for?
        experienceLevel: enum, // 'internship', 'junior', 'senior', 'lead', 'manager', 'vp', 'director' only, ensure that the experience level is correct based on the title
        salary: int, // convert to yearly salary if given in hourly or anything else, NULL IF NOTHING DO NOT MAKE UP A SALARY
        salary_max: int, // NULL IF NO HIGHER VALUE GIVEN FOR SALARY
        additional_information: string,
        skills_string: string, // write the technicals, soft skills, and tools that are required for this job, separate each skill with a comma, max 200 characters
        benefits: string, // separate each benefit with a comma and format them like 'Healthcare: Yes, Dental: Yes, Vision: Yes, etc'
        PreferredQualifications: string, // what the company has said that they want for this job
        MinimumQualifications: string, // the type of degree required and any certifications or qualifications absolutely required, like security clearance
        Responsibilities: string,
        accepted_college_majors: string, // write a list of college majors that would be accepted for this job, separate each major with a comma, if not given, write the ones that might be accepted for this job
        Requirements: string, // Each requirement formatted as "X years experience in Y" or "Certification/Degree Z required"
        NiceToHave: string, // Each nice-to-have formatted as "X years experience in Y" or "Knowledge of Z"
        Schedule: string, // NULL IF NOTHING
        HoursPerWeek: int, // assume 40 hours a week if not given, 20 for part time
        H1BVisaSponsorship: boolean,
        EqualOpportunityEmployerInfo: string,
        Relocation: boolean,
        IsRemote: boolean,
      }
  
      For Requirements and NiceToHave fields:
      - Always specify years of experience when mentioned (e.g., "2 years experience in React")
      - Include specific certifications or degrees (e.g., "Bachelor's in Computer Science required")
      - Convert all time periods to years (e.g., "18 months Python experience" becomes "1.5 years Python experience")
      - Include level of expertise if specified (e.g., "Expert level knowledge in AWS")
      - List each requirement as a separate array item
  
      Return the sorted information in JSON format.`;
  }

  async useChatGPTAPI_JobInfo(link, textContent) {
    const experienceLevelEnum = [
      "Internship",
      "Entry Level",
      "Junior",
      "Senior",
      "Lead",
      "Manager",
      "Director",
      "VP",
      "Other",
    ];

    const collegeMajorsEnum = [
      // Arts & Sciences
      "Biology",
      "Chemistry",
      "Physics",
      "Mathematics",
      "Psychology",
      "English",
      "History",
      "Political Science",
      "Sociology",
      "Economics",
      "Communications",
      "Philosophy",
      "Art",
      "Music",
      "Theater",
      "Geography",
      "Anthropology",
      "Business Administration",
      "Finance",
      "Marketing",
      "Accounting",
      "Management",
      "Mechanical Engineering",
      "Electrical Engineering",
      "Civil Engineering",
      "Chemical Engineering",
      "Elementary Education",
      "Secondary Education",
      "Nursing",
      "Public Health",
      "Pre-Medicine",
      "Computer Science",
      "Information Technology",
      "Criminal Justice",
      "Architecture",
      "Journalism"
    ];

    const jobResponse = z.object({
      title: z.string(),
      location: z.string(),
      salary: z.number(),
      salary_max: z.number(),
      experienceLevel: z.enum(experienceLevelEnum).optional(),
      description: z.string(),
      benefits: z.string().optional(),
      additional_information: z.string().optional(),
      accepted_college_majors: z
        .string(z.array(z.enum(collegeMajorsEnum)))
        .optional(),
      PreferredQualifications: z.string().optional(),
      MinimumQualifications: z.string().optional(),
      Responsibilities: z.string().optional(),
      Requirements: z.string().optional(),
      NiceToHave: z.string().optional(),
      skills_string: z.string().optional(),
      Schedule: z.string().optional(),
      HoursPerWeek: z.number().optional(),
      H1BVisaSponsorship: z.boolean().optional(),
      IsRemote: z.boolean().optional(),
      EqualOpportunityEmployerInfo: z.string().optional(),
      Relocation: z.boolean().optional(),
    });

    const maxCharacters = 200000;
    const truncatedTextContent =
      textContent.length > maxCharacters
        ? textContent.slice(0, maxCharacters)
        : textContent;

    const prompt = this.generatePrompt2(truncatedTextContent);
    const systemPrompt = this.generateJobSystemPrompt();

    try {
      const completion = await this.openai.beta.chat.completions.parse({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          { role: "user", content: prompt },
        ],
        response_format: zodResponseFormat(jobResponse, "jobResponse"),
      });

      const message = completion.choices[0]?.message;
      const jobPosting = message.parsed;

      return jobPosting;
    } catch (error) {
      console.error("OpenAI API Error:", error.message);
      throw error;
    }
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
      experience_evel: z.string(),
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
      Relocation: z.boolean(),
    });

    const maxCharacters = 200000;
    const truncatedTextContent =
      textContent.length > maxCharacters
        ? textContent.slice(0, maxCharacters)
        : textContent;

    const prompt = this.generatePrompt(link, truncatedTextContent);

    try {
      const completion = await this.openai.beta.chat.completions.parse({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that extracts job information from text.",
          },
          { role: "user", content: prompt },
        ],
        response_format: zodResponseFormat(jobResponse, "jobResponse"),
      });

      const message = completion.choices[0]?.message;
      const jobPosting = message.parsed;

      if (this.isTechJob(jobPosting.title)) {
        return jobPosting;
      } else {
        console.log(`Skipping non-tech job: ${jobPosting.title}`);
        return {
          skipped: true,
          title: jobPosting.title,
          reason: "Non-tech job",
        };
      }
    } catch (error) {
      console.error("OpenAI API Error:", error.message);
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
    this.updateProgress({ currentAction: "Generating prompt" });

    const prompt = `
      IF ANY OF THE INFORMATION IS NOT AVAILABLE, PLEASE RETURN NULL FOR THAT INFORMATION.
      DO NOT TRIM ANY INFORMATION JUST RETURN THE ENTIRE INFORMATION GATHERED FOR EACH FIELD. DONT JUST SAY ITS IN THE HTML.
      ${textContent}
      Please extract the following information from this job posting data using the following JSON schema:
      JobPosting = {
        title: string, // the title of the job posting
        url: string, // the url of the job posting
        company_name: string, // name of the company
        location: string, // location of the job posting 
        description: string, // description of the job posting
        IsRemote: boolean,
      }
      Provide the extracted information in JSON format.
      Job posting link: ${link}

      Return: <JobPosting>
    `;

    return prompt;
  }

  generatePrompt2(textContent) {
    this.updateProgress({ currentAction: "Generating prompt" });

    const prompt = `
    Please extract the the information from the job posting and verify the data is correct and complete.
    ${textContent}
    `;

    return prompt;
  }

  async updateJob(jobId, jobInfo) {
    await jobQueries.updateJob(jobId, jobInfo);
  }

  async processJobInfo(jobInfo) {
    const response = await this.useChatGPTAPI_JobInfo(
      jobInfo.link,
      JSON.stringify(jobInfo),
    );
    return response;
  }

  async processJobPosting(jobId) {
    const jobPosting = await jobQueries.findById(jobId);
    const improvedJobPostings = await this.processJobInfo(jobPosting);

    await jobQueries.setJobRawDescription(jobId);
    await jobQueries.updateJob(jobId, improvedJobPostings);
    await jobQueries.setJobAsProcessed(jobId);
    return improvedJobPostings;
  }

  validateAndCleanJobData(data) {
    this.updateProgress({ currentAction: "Validating and cleaning job data" });
    return {
      title: data.title || "",
      company_name: data.company_name || "",
      company_description: data.company_description || "",
      company_location: data.company_location || "",
      company_job_board_url: data.company_job_board_url || "",
      company_industry: data.company_industry || "",
      company_size: data.company_size || "",
      company_stock_symbol: data.company_stock_symbol || "",
      company_logo: data.company_logo || "",
      company_founded: data.company_founded || null,
      location: data.location || "",
      salary: parseInt(data.salary) || 0,
      salary_max: parseInt(data.salary_max) || 0,
      experience_level: data.experience_level || "",
      skills: Array.isArray(data.skills)
        ? data.skills.join(",")
        : typeof data.skills === "string"
          ? data.skills
          : "",
      tags: Array.isArray(data.tags)
        ? data.tags.join(",")
        : typeof data.tags === "string"
          ? data.tags
          : "",
      description: data.description || "",
      benefits: Array.isArray(data.benefits)
        ? data.benefits.join(",")
        : typeof data.benefits === "string"
          ? data.benefits
          : "",
      additional_information: data.additional_information || "",
      PreferredQualifications: data.PreferredQualifications || "",
      MinimumQualifications: data.MinimumQualifications || "",
      Responsibilities: data.Responsibilities || "",
      Requirements: data.Requirements || "",
      NiceToHave: data.NiceToHave || "",
      Schedule: data.Schedule || "",
      HoursPerWeek: parseInt(data.HoursPerWeek) || 0,
      H1BVisaSponsorship: data.H1BVisaSponsorship === true ? 1 : 0,
      IsRemote: data.IsRemote === true ? 1 : 0,
      EqualOpportunityEmployerInfo: data.EqualOpportunityEmployerInfo || "",
      Relocation: data.Relocation === true ? 1 : 0,
    };
  }

  async cleanJobInfo(jobInfo) {
    // function to prompt gpt using the data gathered from linkedin posting
    const prompt = this.generatePrompt(
      jobInfo.applicationLink,
      JSON.stringify(jobInfo),
    );
    const response = await this.useChatGPTAPI(jobInfo.applicationLink, prompt);
    const validated = this.validateAndCleanJobData(response);
    return validated;
  }

  async searchTechJobOnLinkedIn(jobTitle, location = "United States") {
    const linkedInSearchUrl = `https://www.linkedin.com/jobs/search?keywords=${jobTitle.split(" ").join("%20")}&location=${location.split(" ").join("%20")}&geoId=&trk=public_jobs_jobs-search-bar_search-submit&original_referer=`;
    const browser = await puppeteer.launch(BROWSER_CONFIG);
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    );

    await page.goto(linkedInSearchUrl, { waitUntil: "networkidle2" });

    // Function to scroll the page
    const scrollPage = async () => {
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for 1 second after each scroll
    };

    // Scroll 4-6 times with random intervals
    const scrollTimes = Math.floor(Math.random() * 3) + 4; // Random number between 4 and 6
    for (let i = 0; i < scrollTimes; i++) {
      await scrollPage();
      await new Promise((resolve) =>
        setTimeout(resolve, Math.random() * 500 + 500),
      ); // Random wait between 500ms and 1000ms
    }

    // Wait for new job listings to load after scrolling
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const jobs = await page.evaluate(() => {
      const jobElements = document.querySelectorAll(".base-card");
      const jobPostings = [];

      jobElements.forEach((element) => {
        const titleElement = element.querySelector(".base-search-card__title");
        const companyElement = element.querySelector(
          ".base-search-card__subtitle",
        );
        const locationElement = element.querySelector(
          ".job-search-card__location",
        );
        const dateElement = element.querySelector(".job-search-card__listdate");
        const linkElement = element.querySelector("a.base-card__full-link");

        jobPostings.push({
          link: linkElement ? linkElement.href : null,
          title: titleElement ? titleElement.textContent.trim() : null,
          company: companyElement ? companyElement.textContent.trim() : null,
          location: locationElement ? locationElement.textContent.trim() : null,
          date: dateElement ? dateElement.textContent.trim() : null,
        });
      });

      return jobPostings;
    });

    await browser.close();
    return jobs;
  }

  async getJobInfoFromLinkedIn(linkedInUrl) {
    const browser = await puppeteer.launch(BROWSER_CONFIG);
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    );
    await page.goto(linkedInUrl, { waitUntil: "networkidle2" });

    await page.waitForSelector("#main-content", { timeout: 10000 });

    const jobInfo = await page.evaluate(async () => {
      const titleElement = document.querySelector(".top-card-layout__title");
      const companyElement = document.querySelector(".topcard__org-name-link");
      const locationElement = document.querySelector(
        ".topcard__flavor--bullet",
      );
      const descriptionElement = document.querySelector(".description__text");
      const additionalInfoElement = document.querySelector(
        ".description__job-criteria-list",
      );

      // Function to click the apply button and get the application link
      const getApplicationLink = async () => {
        const applyButton = document.querySelector(
          'button.sign-up-modal__outlet[data-tracking-control-name="public_jobs_apply-link-offsite_sign-up-modal"]',
        );
        console.log(applyButton);
        if (applyButton) {
          applyButton.click();
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for popup to appear
          const linkElement = document.querySelector(
            ".sign-up-modal__company_webiste a",
          );
          console.log(linkElement);
          return linkElement ? linkElement.href : null;
        }
        return null;
      };

      const getSimilarJobs = () => {
        const similarJobs = [];
        const similarJobElements = document.querySelectorAll(
          ".similar-jobs__list .base-card",
        );
        similarJobElements.forEach((element) => {
          const title = element
            .querySelector(".base-main-card__title")
            ?.textContent.trim();
          const company = element
            .querySelector(".base-main-card__subtitle")
            ?.textContent.trim();
          const location = element
            .querySelector(".main-job-card__location")
            ?.textContent.trim();
          const salary = element
            .querySelector(".main-job-card__salary-info")
            ?.textContent.trim();
          const link = element.querySelector("a.base-card__full-link")?.href;
          const postedTime = element
            .querySelector(".main-job-card__listdate")
            ?.textContent.trim();
          similarJobs.push({
            title,
            company,
            location,
            salary,
            link,
            postedTime,
          });
        });
        return similarJobs;
      };

      const getPeopleAlsoViewed = () => {
        const peopleAlsoViewed = [];
        const peopleAlsoViewedElements = document.querySelectorAll(
          ".people-also-viewed__list .base-card",
        );
        peopleAlsoViewedElements.forEach((element) => {
          const title = element
            .querySelector(".base-aside-card__title")
            ?.textContent.trim();
          const company = element
            .querySelector(".base-aside-card__subtitle")
            ?.textContent.trim();
          const location = element
            .querySelector(".aside-job-card__location")
            ?.textContent.trim();
          const salary = element
            .querySelector(".aside-job-card__salary-info")
            ?.textContent.trim();
          const link = element.querySelector("a.base-card__full-link")?.href;
          peopleAlsoViewed.push({ title, company, location, salary, link });
        });
        return peopleAlsoViewed;
      };

      const applicationLink = await getApplicationLink();

      // Clean up the description
      const cleanDescription = (description) => {
        if (!description) return null;
        // Remove "Show more" and "Show less" texts and surrounding whitespace
        return description.replace(/\s*Show (more|less)\s*/g, "").trim();
      };

      return {
        title: titleElement ? titleElement.textContent.trim() : null,
        company: companyElement ? companyElement.textContent.trim() : null,
        location: locationElement ? locationElement.textContent.trim() : null,
        description: cleanDescription(
          descriptionElement ? descriptionElement.textContent : null,
        ),
        additional: additionalInfoElement
          ? additionalInfoElement.textContent.trim()
          : null,
        applicationLink,
        similarJobs: getSimilarJobs(),
        peopleAlsoViewed: getPeopleAlsoViewed(),
      };
    });

    // Resolve the external link
    if (jobInfo.applicationLink) {
      jobInfo.applicationLink = await this.getRedirectedUrl(
        jobInfo.applicationLink,
      );
    }

    await browser.close();
    return jobInfo;
  }

  async getRedirectedUrl(url) {
    const browser = await puppeteer.launch(BROWSER_CONFIG);

    try {
      const page = await browser.newPage();

      // Set a user agent
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      );

      // Enable request interception
      await page.setRequestInterception(true);

      // Abort all resource requests except for document
      page.on("request", (request) => {
        if (request.resourceType() !== "document") {
          request.abort();
        } else {
          request.continue();
          2;
        }
      });

      // Navigate to the URL and wait for the network to be idle
      await page.goto(url, { waitUntil: "networkidle0" });

      // Get the final URL after all redirects
      const finalUrl = page.url();

      return finalUrl;
    } catch (error) {
      console.error("Error occurred while getting redirected URL:", error);
      return url; // Return original URL if there's an error
    } finally {
      await browser.close();
    }
  }

  async getOrCreateCompany(
    companyName,
    companyDescription,
    companyLocation,
    companyJobBoardUrl,
    companyIndustry,
    companySize,
    companyStockSymbol,
    companyLogo,
    companyFounded,
  ) {
    try {
      // First, try to get the company by name
      let company = await jobQueries.getCompanyByName(companyName);
  
      if (company) {
        console.log(`Found existing company: ${companyName}`);
        
        // Check if we need to update the logo
        if (companyLogo && (!company.logo || await this.isLogoInvalid(company.logo))) {
          console.log(`Updating logo for company: ${companyName}`);
          company = await jobQueries.updateCompanyLogo(company.id, companyLogo);
        }
        
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
          companyFounded,
        );
  
        return newCompany.id;
      }
    } catch (error) {
      console.error(`Error in getOrCreateCompany for ${companyName}:`, error);
      throw error;
    }
  }
  
  // Helper method to check if a logo URL is invalid
  async isLogoInvalid(logoUrl) {
    if (!logoUrl) return true;
    
    try {
      const response = await fetch(logoUrl, { method: 'HEAD' });
      return !response.ok;
    } catch (error) {
      console.warn(`Error checking logo URL ${logoUrl}:`, error);
      return true;
    }
  }
  
  // Add this method to your jobQueries object
  async updateCompanyLogo(companyId, newLogo) {
    try {
      const result = await jobQueries.updateCompanyLogo(companyId, newLogo);
      return result.rows[0];
    } catch (error) {
      console.error(`Error updating company logo for ID ${companyId}:`, error);
      throw error;
    }
  }

  async createJobPosting(jobData, companyId, link) {
    this.updateProgress({ currentAction: "Creating job posting" });

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
      jobData.employmentType,
      jobData.sourcePostingDate,
    ];

    const sanitizeField = (field) => {
      if (typeof field === "string") {
        return sanitizeHtml(field, {
          allowedTags: [], // Disallow all HTML tags
          allowedAttributes: {}, // Disallow all HTML attributes
          // Optionally, you can allow specific tags or attributes
        });
      }
      return field;
    };

    const missingFieldsCount = fields.filter((field) => !field).length;
    const isProcessed = missingFieldsCount > 6 ? "0" : "1";

    await jobQueries.createJobPosting(
      sanitizeField(jobData.title),
      jobData.salary || 0,
      jobData.experience_level || "",
      jobData.location || "",
      new Date(),
      companyId || null,
      link || "",
      null, // expiration_date
      jobData.tags ? jobData.tags.split(",") : [],
      sanitizeField(jobData.description) || "",
      jobData.salary_max || null,
      "1", // recruiter_id (add this line)
      jobData.skills ? jobData.skills.split(",") : [],
      jobData.benefits ? jobData.benefits.split(",") : [],
      jobData.additional_information || "",
      jobData.PreferredQualifications || "",
      jobData.MinimumQualifications || "",
      jobData.Responsibilities || "",
      jobData.Requirements || "",
      jobData.NiceToHave || "",
      jobData.Schedule || "",
      jobData.HoursPerWeek || 0,
      jobData.H1BVisaSponsorship || 0,
      jobData.IsRemote || 0,
      jobData.EqualOpportunityEmployerInfo || "",
      jobData.Relocation || 0,
      isProcessed,
      jobData.employmentType || "",
      jobData.sourcePostingDate || "",
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
      this.updateProgress({
        currentAction: "Processing job link for " + link.url,
      });
      const jobData = await this.processJobLinkWithRetry(link);
      console.log(jobData);
      if (jobData && !jobData.error && !jobData.skipped) {
        this.updateProgress({
          currentAction: "Creating job posting for " + jobData.title,
        });
        console.log("Creating job posting:", jobData.title);
        if (this.isTechJob(jobData.title)) {
          this.updateProgress({
            currentAction: "Creating job posting for " + jobData.title,
          });
          return this.createJobPosting(jobData, companyId, link.url || link);
        }
      }
    }
  }

  async processLinkedInJob(jobData) {
    this.updateProgress({
      currentAction: "Processing LinkedIn job for " + jobData.link,
    });
    try {
      const $ = cheerio.load(jobData);

      let extractedData = {
        title:
          $(".job-details-jobs-unified-top-card__job-title").text().trim() ||
          $(".top-card-layout__title").text().trim() ||
          $("h1").text().trim(),
        company_name:
          $(".job-details-jobs-unified-top-card__company-name").text().trim() ||
          $(".topcard__org-name-link").text().trim() ||
          $(".topcard__flavor--black-link").text().trim(),
        company:
          $(".job-details-jobs-unified-top-card__company-name").text().trim() ||
          $(".topcard__org-name-link").text().trim() ||
          $(".topcard__flavor--black-link").text().trim(),
        location: $("span.topcard__flavor.topcard__flavor--bullet")
          .text()
          .trim(),
        job_type: $(
          ".description__job-criteria-text description__job-criteria-text--criteria",
        )
          .text()
          .trim(),
        salary_range:
          $('.job-details-jobs-unified-top-card__job-insight:contains("$")')
            .text()
            .trim() ||
          $(".compensation__salary").text().trim() ||
          $(".salary").text().trim(),
        description: $(".show-more-less-html__markup").text().trim(),
        additional_information: $(
          ".description__job-criteria-text.description__job-criteria-text--criteria",
        )
          .text()
          .trim(),
      };

      console.log(extractedData);

      // convert salary range to salary and salary_max '$110,000.00/yr - $120,000.00/yr', to 110000, 120000
      if (extractedData.salary_range) {
        const [min, max] = extractedData.salary_range.split(" - ");
        extractedData.salary = min.replace("$", "").replace(",", "");
        extractedData.salary_max = max.replace("$", "").replace(",", "");

        if (extractedData.additional_information) {
          extractedData.additional_information += extractedData.salary_range;
        }
      }

      // Check if it's a tech job
      return extractedData;
    } catch (error) {
      console.error(`Error processing LinkedIn job ${jobData.link}:`, error);
      throw error;
    }
  }

  async searchAdditionalJobBoards(companyName) {
    const jobBoards = [];
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(companyName + " careers")}`;

    try {
      const response = await this.makeRequest(searchUrl);
      const $ = cheerio.load(response.data);

      $("a").each((index, element) => {
        const href = $(element).attr("href");
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
      $("a").each((index, element) => {
        const href = $(element).attr("href");
        const text = $(element).text().toLowerCase();
        if (href && (text.includes("career") || text.includes("job"))) {
          jobBoards.push(href);
        }
      });
    } catch (error) {
      console.error(
        `Error searching additional job boards for ${companyName}:`,
        error,
      );
    }

    return [...new Set(jobBoards)]; // Remove duplicates
  }

  async updateJobPostings() {
    const companies = await jobQueries.getCompaniesWithJobBoard();

    for (const company of companies) {
      const jobBoardUrl = company.job_board_url;
      await this.addToCompanyLinkQueue(jobBoardUrl);
    }

    this.updateProgress({
      phase: "Processing job boards",
      totalCompanies: companies.length,
    });
  }
  async crawl(startUrl) {
    const unprocessedLinks = new Set([startUrl]);
    const processedLinks = new Set();
    const maxRetries = 3;
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const startTime = Date.now();
    const timeLimit = 60 * 60 * 1000; // 1 hour in milliseconds

    try {
      while (unprocessedLinks.size > 0) {
        if (Date.now() - startTime > timeLimit) {
          console.log("Time limit reached. Stopping the crawl process.");
          break;
        }

        const link = unprocessedLinks.values().next().value;
        unprocessedLinks.delete(link);
        processedLinks.add(link);

        let retries = 0;
        while (retries < maxRetries) {
          try {
            // Collect job links
            const response = await this.collectJobLinksFromLink(link);
            if (response && response.links) {
              for (const newLink of response.links) {
                if (
                  !processedLinks.has(newLink.url) &&
                  !unprocessedLinks.has(newLink.url)
                ) {
                  unprocessedLinks.add(newLink.url);
                }
              }
            }

            // add to job link queue
            if (response && response.jobLinks) {
              for (const jobLink of response.jobLinks) {
                await this.addToJobLinkQueue(jobLink);
              }
            }

            break; // Success, exit retry loop
          } catch (error) {
            console.error(`Error processing ${link}: ${error.message}`);
            retries++;
            if (retries >= maxRetries) {
              console.error(
                `Max retries reached for ${link}. Moving to next link.`,
              );
            } else {
              await delay(1000 * retries); // Exponential backoff
            }
          }
        }

        // Implement rate limiting
        await delay(1000); // Wait 1 second between requests
      }
    } catch (error) {
      console.error(`Crawl process terminated due to error: ${error.message}`);
    } finally {
      console.log(
        `Crawl complete. Processed ${processedLinks.size} links in ${(Date.now() - startTime) / 1000} seconds.`,
      );
    }
  }
  async crawLinkedIn() {
    const jobTitles = [
      "Software Engineer",
      "Data Analyst",
      "Web Developer",
      "System Architect",
      "Network Security Specialist",
      "Database Administrator",
      "Mobile App Developer",
      "Project Manager",
      "QA Engineer",
      "Java Developer",
      "Python Developer",
      "JavaScript Developer",
      "Game Developer",
      "Blockchain Developer",
      "DevOps Engineer",
      "Cloud Architect",
      "UI/UX Designer",
      "Machine Learning Engineer",
      "Full Stack Developer",
      "Frontend Developer",
      "Backend Developer",
    ];

    const cities = [
      "New York, NY",
      "San Francisco, CA",
      "Chicago, IL",
      "Austin, TX",
      "Seattle, WA",
      "Boston, MA",
      "Los Angeles, CA",
      "Atlanta, GA",
    ];
    console.log("Starting LinkedIn job search");

    const randomJobTitle =
      jobTitles[Math.floor(Math.random() * jobTitles.length)];
    const randomCity = cities[Math.floor(Math.random() * cities.length)];

    const encodedJobTitle = encodeURIComponent(randomJobTitle);
    const encodedCity = encodeURIComponent(randomCity);

    const searchUrl = `https://www.linkedin.com/jobs/search?keywords=${encodedJobTitle}&location=${encodedCity}`;

    await this.crawl(searchUrl);
  }

  async crawlYCombinator() {
    const ycLink = "https://www.ycombinator.com/jobs";
    await this.crawl(ycLink);
  }

  async start() {
    try {
      await this.init();

      /*
      try {
        await this.updateJobPostings();
      } catch (error) {
        console.error("Error in updateJobPostings:", error);
      }

      try {
        await this.collectJobLinksFromSimplify();
      } catch (error) {
        console.error("Error in collectJobLinksFromSimplify:", error);
      }

      this.updateProgress({ phase: 'Cleaning job postings' });
      try {
        await this.removeDuplicateJobs();
      } catch (error) {
        console.error('Error in removeDuplicateJobs:', error);
      }
      
      try {
      await this.verifyAndUpdateCompanyData();
      } catch (error) {
        console.error('error attempting to verify company data');
        }
      try {
        await this.crawlYCombinator();
      } catch (error) {
        console.error("Error in crawlYCombinator:", error);
      }
        */

      this.updateProgress({ phase: "Completed" });
    } catch (error) {
      // await notificationQueries.createDevNotification('error', '', 'Error in start:', error);
      console.error("Error in start:", error);
    }
  }
}

module.exports = JobProcessor;
