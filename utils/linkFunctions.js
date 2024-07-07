const axios = require("axios");
const cheerio = require("cheerio");

const filterJobTitles = (jobTitle) => {
  const keywords = [
    "Software Engineer",
    "Developer",
    "Programmer",
    "ML Engineer",
    "AI Engineer",
    "Backend",
    "Frontend",
    "Software Developer",
    "Data Scientist",
    "Data Analyst",
    "Machine Learning",
    "Full Stack",
    "DevOps",
    "Security",
    "Product Manager",
    "Project Manager",
  ];
  return keywords.some((keyword) =>
    jobTitle.toLowerCase().includes(keyword.toLowerCase())
  );
};

const linkFunctions = {
  scrapeGreenhouseJobs: async (url) => {
    try {
      console.log(url);
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);
      const jobPostings = [];

      $(".opening").each((index, element) => {
        const jobTitle = $(element).find("a").text().trim();
        const jobLink = $(element).find("a").attr("href");

        if (filterJobTitles(jobTitle)) {
          jobPostings.push({
            title: jobTitle,
            link: "https://boards.greenhouse.io" + jobLink,
          });
        }
      });

      return jobPostings;
    } catch (error) {
      console.error("Error scraping Greenhouse:", error);
      return [];
    }
  },

  scrapeLeverJobs: async (url) => {
    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);
      const jobPostings = [];

      $(".posting").each((index, element) => {
        const jobTitle = $(element).find(".posting-title h5").text().trim();
        const jobLocation = $(element)
          .find(".posting-categories .sort-by-location")
          .text()
          .trim();
        const jobLink = $(element).find("a").attr("href");

        if (filterJobTitles(jobTitle)) {
          jobPostings.push({
            title: jobTitle,
            location: jobLocation,
            link: jobLink,
          });
        }
      });

      return jobPostings;
    } catch (error) {
      console.error("Error scraping Lever:", error);
      return [];
    }
  },

  scrapeWorkdayCareers: async (url) => {
    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);
      const jobPostings = [];

      $(".jobPost").each((index, element) => {
        const jobTitle = $(element).find(".jobTitle").text().trim();
        const jobLocation = $(element).find(".jobLocation").text().trim();
        const jobLink = $(element).find("a").attr("href");

        if (filterJobTitles(jobTitle)) {
          jobPostings.push({
            title: jobTitle,
            location: jobLocation,
            link: new URL(jobLink, url).href, // Ensure absolute URL
          });
        }
      });

      return jobPostings;
    } catch (error) {
      console.error("Error scraping Workday Careers:", error);
      return [];
    }
  },

  scrapeSmartRecruiters: async (url) => {
    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);
      const jobPostings = [];

      $(".job-item").each((index, element) => {
        const jobTitle = $(element).find(".job-title").text().trim();
        const jobLocation = $(element).find(".job-location").text().trim();
        const jobLink = $(element).find("a").attr("href");

        if (filterJobTitles(jobTitle)) {
          jobPostings.push({
            title: jobTitle,
            location: jobLocation,
            link: new URL(jobLink, url).href, // Ensure absolute URL
          });
        }
      });

      return jobPostings;
    } catch (error) {
      console.error("Error scraping SmartRecruiters:", error);
      return [];
    }
  },

  splitIntoChunks: async (text, chunkSize) => {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
      const end = start + chunkSize;
      chunks.push(text.slice(start, end));
      start = end;
    }
    return chunks;
  },

  detectJobBoard: (url) => {
    if (url.includes("greenhouse.io")) return "scrapeGreenhouseJobs";
    if (url.includes("lever.co")) return "scrapeLeverJobs";
    if (url.includes("myworkdayjobs.com")) return "scrapeWorkdayCareers";
    if (url.includes("smartrecruiters.com")) return "scrapeSmartRecruiters";
    return null;
  },

  scrapeJobs: async (url) => {
    const scrapeFunction = linkFunctions.detectJobBoard(url);
    if (scrapeFunction && linkFunctions[scrapeFunction]) {
      return await linkFunctions[scrapeFunction](url);
    } else {
      console.error("Unsupported job board:", url);
      return [];
    }
  },
};

module.exports = linkFunctions;
