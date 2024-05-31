const axios = require("axios");
const cheerio = require("cheerio");

const filterJobTitles = (jobTitle) => {
  const keywords = [
    "Software",
    "Engineer",
    "Developer",
    "Programmer",
    "Coder",
    "Data",
    "Machine Learning",
    "AI",
    "Backend",
    "Frontend",
    "Full Stack",
    "DevOps",
    "QA",
    "Security",
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
};

module.exports = linkFunctions;
