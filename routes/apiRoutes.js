const express = require("express");
const router = express.Router();
const userQueries = require("../queries/userQueries");
const multer = require("multer");
const { checkAuthenticated } = require("../middleware/authMiddleware");
const storage = multer.diskStorage({
  destination: "./public/uploads/",
  filename: function (req, file, cb) {
    cb(null, "profile-" + Date.now() + ".jpg");
  },
});
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const cheerio = require("cheerio");
const githubService = require("../services/githubService");
const cacheMiddleware = require("../middleware/cache");
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 1200 }); // TTL is 20 minutes
const utilFunctions = require("../utils/utilFunctions");
const upload = multer({ storage });
const marked = require("marked");
const postQueries = require("../queries/postQueries");
const jobQueries = require("../queries/jobQueries");
const sql = require("mssql");
const axios = require("axios");
const communityQueries = require("../queries/communityQueries");
const linkFunctions = require("../utils/linkFunctions");

const renderer = new marked.Renderer();
renderer.image = function (href, title, text) {
  // Return HTML string with the image and its alt text as a caption below
  return `
      <div class="image-container">
          <img src="${href}" alt="${text}">
          <p class="alt-text">${text}</p>
      </div>
  `;
};
marked.setOptions({
  renderer: renderer,
});

router.get("/getUsername/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const user = await userQueries.findById(id);
    if (user) {
      res.json(user.username);
    } else {
      res.status(404).send("User not found");
    }
  } catch (err) {
    res.status(500).send("Server error");
  }
});

router.get("/job-postings", async (req, res) => {
  try {
    const jobPostings = await jobQueries.getJobs();
    res.json(jobPostings);
  } catch (err) {
    console.error("Error fetching job postings:", err);
    res.status(500).send("Error fetching job postings");
  }
});

router.get("/leetcode-experience/:username", async (req, res) => {
  try {
    const username = req.params.username;
    const query = `
      query getUserProfile($username: String!) {
        allQuestionsCount {
          difficulty
          count
        }
        matchedUser(username: $username) {
          username
          submitStats {
            acSubmissionNum {
              difficulty
              count
            }
          }
        }
      }
    `;
    const variables = { username };
    const { data } = await axios.post(
      "https://leetcode.com/graphql",
      {
        query,
        variables,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36",
        },
      }
    );

    const userStats = data.data.matchedUser.submitStats.acSubmissionNum;
    const easySolved = userStats.find(
      (stat) => stat.difficulty === "Easy"
    ).count;
    const mediumSolved = userStats.find(
      (stat) => stat.difficulty === "Medium"
    ).count;
    const hardSolved = userStats.find(
      (stat) => stat.difficulty === "Hard"
    ).count;

    res.json({
      easySolved,
      mediumSolved,
      hardSolved,
    });
  } catch (err) {
    console.error("Error fetching LeetCode data:", err);
    res.status(500).send("Error fetching LeetCode data");
  }
});

router.get(
  "/github-commit-graph/:username",
  cacheMiddleware(2400),
  async (req, res) => {
    try {
      const username = req.params.username;
      const user = await userQueries.findByGitHubUsername(username);

      if (!user || !user.githubAccessToken) {
        return res
          .status(404)
          .json({ error: "User not found or access token not available" });
      }

      const accessToken = user.githubAccessToken;
      const apiUrl = `https://api.github.com/search/commits`;
      const headers = {
        "User-Agent": "CORE",
        Authorization: `Bearer ${accessToken}`,
      };

      const commitGraph = {};
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const oneYearAgoDate = oneYearAgo.toISOString().split("T")[0];
      let page = 1;
      const commitsPerPage = 100;
      let commitCount = 0;

      while (true) {
        const response = await axios.get(apiUrl, {
          headers,
          params: {
            q: `author:${username} committer-date:>=${oneYearAgoDate}`,
            sort: "committer-date",
            order: "desc",
            per_page: commitsPerPage,
            page: page,
          },
        });

        if (response.status !== 200) {
          throw new Error(`GitHub API returned status code ${response.status}`);
        }

        const commits = response.data.items;
        commitCount += commits.length;
        commits.forEach((commit) => {
          const date = commit.commit.committer.date.split("T")[0];
          commitGraph[date] = (commitGraph[date] || 0) + 1;
        });

        if (commits.length < commitsPerPage) {
          break;
        }
        page++;
      }

      //console.log(commitGraph);
      res.json({ username, commitGraph, commitCount });
    } catch (error) {
      console.error("Error fetching GitHub commit graph:", error);
      console.error("Error details:", error.response?.data);
      res.status(500).json({ error: "Failed to fetch GitHub commit graph" });
    }
  }
);

router.get(
  "/github-repos/:username",
  cacheMiddleware(2400),
  async (req, res) => {
    try {
      const username = req.params.username;
      const user = await userQueries.findByGitHubUsername(username);

      if (!user || !user.githubAccessToken) {
        return res
          .status(404)
          .json({ error: "User not found or access token not available" });
      }

      const accessToken = user.githubAccessToken;
      const url = `https://api.github.com/users/${username}/repos`;
      const headers = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
        Authorization: `Bearer ${accessToken}`,
      };
      const response = await axios.get(url, { headers, timeout: 5000 });
      const { data, status } = response;

      if (status !== 200) {
        throw new Error(`Request failed with status code ${status}`);
      }

      const repositories = data.map((repo) => ({
        name: repo.name,
        description: repo.description,
        url: repo.html_url,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        language: repo.language,
      }));

      res.json({ username, repositories });
    } catch (error) {
      console.error("Error fetching GitHub repositories:", error);
      res.status(500).json({ error: "Failed to fetch GitHub repositories" });
    }
  }
);

router.get("/skills", async (req, res) => {
  try {
    const skills = await jobQueries.getSkills();
    res.json(skills);
  } catch (err) {
    console.error("Error fetching skills:", err);
    res.status(500).send("Error fetching skills");
  }
});

router.get("/community/:communityId/jobs", async (req, res) => {
  try {
    const communityId = req.params.communityId;
    const page = parseInt(req.query.page) || 1; // Get the page number from query parameters, default to 1
    const limit = parseInt(req.query.limit) || 10; // Get the number of items per page, default to 10

    // Fetch community tags by communityId
    const community = await communityQueries.getCommunity(communityId);

    if (!community) {
      return res.status(404).send("Community not found");
    }

    if (community.JobsEnabled === "False") {
      return res.status(404).send("Jobs are not enabled for this community");
    }

    // Assume community.Tags is a CSV string
    const communityTags = community.Tags.split(",");

    if (!communityTags.length) {
      return res.status(404).send("No tags found for the given community");
    }

    // Fetch jobs matching the community tags
    const allJobs = await jobQueries.getJobsByTags(communityTags);

    if (!allJobs.length) {
      // return random jobs
      const randomJobs = await jobQueries.getRandomJobs(limit);
      return res.json({
        jobPostings: randomJobs,
        currentPage: page,
        totalPages: 1,
      });
    }

    // if theres less than 3 jobs, return jobs and some random jobs
    if (allJobs.length < 5) {
      const randomJobs = await jobQueries.getRandomJobs(limit);
      return res.json({
        jobPostings: allJobs.concat(randomJobs),
        currentPage: page,
        totalPages: 1,
      });
    }

    // Shuffle jobs array to randomize the order
    const shuffledJobs = allJobs.sort(() => 0.5 - Math.random());

    // Implement pagination on the shuffled jobs
    const offset = (page - 1) * limit;
    const paginatedJobs = shuffledJobs.slice(offset, offset + limit);

    res.json({
      jobPostings: paginatedJobs,
      currentPage: page,
      totalPages: Math.ceil(allJobs.length / limit),
    });
  } catch (err) {
    console.error("Error fetching job postings:", err);
    res.status(500).send("Error fetching job postings");
  }
});

router.get("/randomJobs", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const offset = (page - 1) * limit;

    const [jobPostings, totalCount] = await Promise.all([
      jobQueries.getRandomJobs(limit),
      jobQueries.getJobsCount(),
    ]);

    res.json({
      jobPostings,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (err) {
    console.error("Error fetching job postings:", err);
    res.status(500).send("Error fetching job postings");
  }
});

router.get("/jobs", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Get the page number from query parameters, default to 1
    const limit = parseInt(req.query.limit) || 10; // Get the number of items per page, default to 10
    const jobTitle = req.query.jobTitle;
    const jobLocation = req.query.jobLocation;
    const jobExperienceLevel = req.query.jobExperienceLevel;
    const jobSalary = req.query.jobSalary;

    const offset = (page - 1) * limit; // Calculate the offset based on page and limit

    const [jobPostings, totalCount] = await Promise.all([
      jobQueries.getJobsBySearch(
        jobTitle,
        jobLocation,
        jobExperienceLevel,
        jobSalary,
        limit,
        offset
      ),
      jobQueries.getJobsCount(),
    ]);

    res.json({
      jobPostings,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (err) {
    console.error("Error fetching job postings:", err);
    res.status(500).send("Error fetching job postings");
  }
});

router.get("/job-experience/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const jobExperience = await jobQueries.getUserJobExperience(userId);
    res.json(jobExperience);
  } catch (err) {
    console.error("Error fetching job experience:", err);
    res.status(500).send("Error fetching job experience");
  }
});

router.get("/education-experience/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const jobExperience = await jobQueries.getUserEducationExperience(userId);
    res.json(jobExperience);
  } catch (err) {
    console.error("Error fetching job experience:", err);
    res.status(500).send("Error fetching job experience");
  }
});

router.get("/jobs/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const jobPosting = await jobQueries.findById(id);
    res.json(jobPosting);
  } catch (err) {
    console.error("Error fetching job posting:", err);
    res.status(500).send("Error fetching job posting");
  }
});

router.get("/jobs/:id/similar", async (req, res) => {
  try {
    const id = req.params.id;
    const jobPosting = await jobQueries.findById(id);
    const similarJobs = await jobQueries.getSimilarJobs(jobPosting.id);
    res.json(similarJobs);
  } catch (err) {
    console.error("Error fetching similar jobs:", err);
    res.status(500).send("Error fetching similar jobs");
  }
});

router.get("/jobs/:id/similar-company", async (req, res) => {
  try {
    const id = req.params.id;
    const jobPosting = await jobQueries.findById(id);
    const similarJobs = await jobQueries.getSimilarJobsByCompany(
      jobPosting.company_id,
      jobPosting.id
    );
    res.json(similarJobs);
  } catch (err) {
    console.error("Error fetching similar jobs:", err);
    res.status(500).send("Error fetching similar jobs");
  }
});

router.post("/job-postings", checkAuthenticated, async (req, res) => {
  try {
    const {
      title,
      company,
      location,
      salary,
      salary_max,
      experienceLevel,
      skills,
      tags,
      description,
      link,
      benefits,
      additional_information,
      preferredQualifications,
      minimumQualifications,
      responsibilities,
      requirements,
      niceToHave,
      schedule,
      hoursPerWeek,
      h1bVisaSponsorship,
      isRemote,
      equalOpportunityEmployerInfo,
      relocation,
    } = req.body;
    //console.log(req.body);

    // Check if the company exists in the database
    let companyObject = await jobQueries.getCompanyIdByName(company);
    //console.log(companyObject);
    let companyId = companyObject ? companyObject.id : null;
    //console.log(companyId);
    const user = req.user;

    if (!companyId) {
      //console.log(`Error creating company: ${company}`);
      return res.status(400).json({ error: "Company does not exist" });
    }

    const jobPostingId = await jobQueries.createJobPosting(
      title,
      salary,
      experienceLevel,
      location,
      new Date(),
      companyId,
      link,
      null,
      tags.split(",").map((tag) => tag.trim()),
      description,
      salary_max,
      user.recruiter_id,
      skills.split(",").map((skill) => skill.trim()),
      benefits,
      additional_information,
      preferredQualifications,
      minimumQualifications,
      responsibilities,
      requirements,
      niceToHave,
      schedule,
      hoursPerWeek,
      h1bVisaSponsorship,
      isRemote,
      equalOpportunityEmployerInfo,
      relocation
    );

    res.status(201).json({
      message: "Job posting created successfully",
      jobPostingId: jobPostingId.toString(),
    });
  } catch (error) {
    console.error("Error creating job posting:", error);
    res
      .status(500)
      .json({ error: "An error occurred while creating the job posting" });
  }
});

router.post("/extract-job-details", async (req, res) => {
  try {
    const { link } = req.body;

    if (link) {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const headers = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.82 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Cache-Control": "max-age=0",
      };

      const linkResponse = await axios.get(link, { headers, timeout: 5000 });
      const { data } = linkResponse;

      // Remove HTML tags and scripts
      const cleanedData = data.replace(
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        ""
      );
      const textContent = cleanedData.replace(/<(?:.|\n)*?>/gm, "");

      const prompt = `Please extract the following information from this job posting data:  ${textContent}
      - title (e.g., Software Engineer, Data Analyst, do not include intern or seniority in the title)
      - company_name NVARCHAR(50) (as simple as possible, not amazon inc, just Amazon. If it's a startup, use the startup name)
      - company_description NVARCHAR(MAX)(write a short paragraph about the company, where they're located, their mission, etc)
      - company_industry (e.g., Technology, Healthcare, Finance, etc.)
      - company_size (e.g., 1-10, 11-50, 51-200, 201-500, 501-1000, 1001-5000, 5001-10000, 10001+)
      - company_stock_symbol (if public, otherwise leave blank)
      - company_logo (in the format of /src/<company-name>logo.png)
      - company_founded (year founded, if available, otherwise leave blank, format in SQL datetime format)
      - location (City, State(full name), Country(full name), if remote N/A)
      - salary (integer only, no currency symbol, no matter what format the salary in (hourly, monthly, weekly) convert to yearly salary)
      - salary_max (integer only, no currency symbol, no matter what format the salary in (hourly, monthly, weekly) convert to yearly salary)
      - experience_level ("Internship", "Entry Level", "Junior", "Mid Level", "Senior" or "Lead" only)
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
      Provide the extracted information in JSON format.`;

      console.log(prompt);

      const response = await model.generateContent(prompt);
      console.log("Raw response text:", response.text);

      // Remove triple backticks and any other non-JSON characters
      const cleanedResponse = response.text
        .replace(/^`{3}(json)?|`{3}$/g, "")
        .trim();

      //console.log("Cleaned response:", cleanedResponse);

      let extractedData;
      try {
        extractedData = JSON.parse(cleanedResponse);
      } catch (error) {
        console.error(
          `Failed to parse JSON response: ${cleanedResponse}` + error
        );
        res.status(500).json({
          error: "Failed to parse the JSON response from the ChatGPT API",
        });
        return;
      }

      //console.log("Extracted data:", extractedData);

      try {
        if (extractedData.company_name) {
          // Check if the company exists in the database
          let company = await jobQueries.getCompanyIdByName(
            extractedData.company_name
          );

          // create it if not
          if (!company) {
            company = await jobQueries.createCompany(
              extractedData.company_name,
              extractedData.company_logo,
              extractedData.location,
              extractedData.company_description,
              extractedData.company_industry,
              extractedData.company_size,
              extractedData.company_stock_symbol,
              extractedData.company_founded
            );
          }
        }
      } catch {
        //console.log(`Error creating company: ${extractedData.company_name}`);
      }

      res.json(extractedData);
    } else {
      res.status(400).json({ error: "Invalid job link" });
    }
  } catch (error) {
    console.error("Error extracting job details:", error);
    res
      .status(500)
      .json({ error: "An error occurred while extracting job details" });
  }
});

router.post("/auto-create-job-posting", async (req, res) => {
  try {
    const { link } = req.body;

    if (!link) {
      return res.status(400).json({ error: "Invalid job link" });
    }

    let jobLinks = [link];

    if (link.includes("greenhouse.io")) {
      jobLinks = await linkFunctions.scrapeGreenhouseJobs(link);
    } else if (link.includes("lever.co")) {
      jobLinks = await linkFunctions.scrapeLeverJobs(link);
    }
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    for (const jobLink of jobLinks) {
      await processJobLink(model, jobLink);
    }

    res.status(201).json({ message: "Job postings processed successfully" });
  } catch (error) {
    console.error("Error extracting job details:", error);
    res
      .status(500)
      .json({ error: "An error occurred while extracting job details" });
  }
});

async function processJobLink(model, jobLink) {
  return new Promise(async (resolve) => {
    console.log(`Processing job link: ${jobLink.link}`);
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.82 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Cache-Control": "max-age=0",
    };

    try {
      const linkResponse = await axios.get(jobLink.link, {
        headers,
        timeout: 5000,
      });
      const { data } = linkResponse;

      const $ = cheerio.load(data);
      $("script, style").remove();
      const textContent = $("body").text().replace(/\s\s+/g, " ").trim();

      const prompt = `Please extract the following information from this job posting data: ${textContent}
      - title (e.g., Software Engineer, Data Analyst, do not include intern or seniority in the title)
      - company_name NVARCHAR(50) (as simple as possible, not amazon inc, just Amazon. If it's a startup, use the startup name)
      - company_description NVARCHAR(MAX)(write a short paragraph about the company, where they're located, their mission, etc)
      - company_industry (e.g., Technology, Healthcare, Finance, etc.)
      - company_size (e.g., 1-10, 11-50, 51-200, 201-500, 501-1000, 1001-5000, 5001-10000, 10001+)
      - company_stock_symbol (if public, otherwise leave blank)
      - company_logo (in the format of /src/<company-name>logo.png do not include space in the company logo)
      - company_founded (year founded, if available, otherwise leave blank, format in SQL datetime format)
      - location (City, State(full name), Country(full name), if remote N/A)
      - salary (integer only, no currency symbol, no matter what format the salary in (hourly, monthly, weekly) convert to yearly salary)
      - salary_max (integer only, no currency symbol, no matter what format the salary in (hourly, monthly, weekly) convert to yearly salary)
      - experience_level ("Internship", "Entry Level", "Junior", "Mid Level", "Senior" or "Lead" only)
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
      Provide the extracted information in JSON format.`;

      const result = await model.generateContent(prompt);
      let response = await result.response;
      response = response.text();
      console.log(response);

      const cleanedResponse =
        response.replace(/`+/g, "").match(/\{.*\}/s)?.[0] || "";

      let extractedData;
      try {
        extractedData = JSON.parse(cleanedResponse);
      } catch (error) {
        console.error(
          `Failed to parse JSON response: ${cleanedResponse}`,
          error
        );
        return resolve();
      }

      if (extractedData.error) {
        console.log(
          `Skipping job posting due to ChatGPT error: ${extractedData.error}`
        );
        return resolve();
      }

      const requiredFields = [
        "title",
        "company_name",
        "location",
        "salary",
        "experience_level",
        "skills",
        "tags",
        "description",
      ];
      const isComplete = requiredFields.every((field) =>
        extractedData.hasOwnProperty(field)
      );

      if (isComplete) {
        try {
          let company = await jobQueries.getCompanyIdByName(
            extractedData.company_name
          );
          if (!company) {
            company = await jobQueries.createCompany(
              extractedData.company_name,
              extractedData.company_logo,
              extractedData.location,
              extractedData.company_description,
              extractedData.company_industry,
              extractedData.company_size,
              extractedData.company_stock_symbol,
              extractedData.company_founded
            );
          }

          await jobQueries.createJobPosting(
            extractedData.title,
            extractedData.salary,
            extractedData.experience_level,
            extractedData.location,
            new Date(),
            company.id,
            jobLink.link,
            null,
            extractedData.tags.split(",").map((tag) => tag.trim()),
            extractedData.description,
            extractedData.salary_max,
            1,
            extractedData.skills.split(",").map((skill) => skill.trim()),
            extractedData.benefits,
            extractedData.additional_information,
            extractedData.PreferredQualifications,
            extractedData.MinimumQualifications,
            extractedData.Responsibilities,
            extractedData.Requirements,
            extractedData.NiceToHave,
            extractedData.Schedule,
            extractedData.HoursPerWeek,
            extractedData.H1BVisaSponsorship,
            extractedData.IsRemote,
            extractedData.EqualOpportunityEmployerInfo,
            extractedData.Relocation
          );

          console.log(
            `Job posting created successfully for job link: ${jobLink.link}`
          );
        } catch (error) {
          console.error("Error creating job posting:", error);
        }
      } else {
        console.log(
          `Job posting not created due to missing fields for job link: ${jobLink.link}`
        );
      }
    } catch (error) {
      console.error(
        `Error with ChatGPT API call for job link ${jobLink.link}:`,
        error
      );
    }

    // Introduce a delay of 1 second (1000 milliseconds)
    setTimeout(resolve, 1000);
  });
}

router.get("/posts/:postId/comments", async (req, res) => {
  try {
    const postId = req.params.postId;
    const comments = await utilFunctions.getComments(postId);
    res.json(comments);
  } catch (err) {
    console.error("Error fetching comments:", err);
    res.status(500).send("Error fetching comments");
  }
});

router.get("/posts/:postId", async (req, res) => {
  try {
    const postId = req.params.postId;
    const user = req.user ? req.user : null;
    const postData = await utilFunctions.getPostData(postId, user);
    postData.content = marked(postData.content);
    res.json(postData);
  } catch (err) {
    console.error("Error fetching post data:", err);
    res.status(500).send("Error fetching post data");
  }
});

router.get("/posts/:postId/getReaction", async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = req.query.userId; // Assuming userId is sent as a query parameter
    const reaction = await postQueries.getUserInteractions(postId, userId);
    return res.json(reaction);
  } catch (err) {
    console.error("Error fetching reaction:", err);
    res.status(500).send("Error fetching reaction");
  }
});

router.get("/communities", cacheMiddleware(2400), async (req, res) => {
  try {
    const user = req.user; // Assuming the user object is attached to the request by middleware
    const communities = await utilFunctions.getAllCommunities(user);
    return res.json(communities);
  } catch (err) {
    console.error("Error fetching communities:", err);
    res.status(500).send("Error fetching communities");
  }
});

router.get("/companies", async (req, res) => {
  try {
    const companies = await jobQueries.getCompanies();
    res.json(companies);
  } catch (err) {
    console.error("Error fetching companies:", err);
    res.status(500).send("Error fetching companies");
  }
});

router.get("/communities/:communityId/posts", async (req, res) => {
  try {
    const communityId = req.params.communityId;
    const page = parseInt(req.query.page) || 1;
    const sortBy = req.query.sortBy || "trending";
    const userId = req.query.userId;
    const limit = 10; // Number of posts per page
    const offset = (page - 1) * limit;
    const posts = await utilFunctions.getPostsForCommunity(
      communityId,
      sortBy,
      userId,
      page,
      limit,
      offset
    );
    res.json(posts);
  } catch (err) {
    res.status(500).send("Error fetching posts");
  }
});

router.get("/comments/:commentId/replies", async (req, res) => {
  try {
    const commentId = req.params.commentId;
    const replies = await utilFunctions.getRepliesForComment(commentId);
    res.json(replies);
  } catch (err) {
    console.error("Error fetching replies:", err);
    res.status(500).send("Error fetching replies");
  }
});

router.get("/tags", async (req, res) => {
  try {
    const tags = await utilFunctions.getAllTags();
    res.json(tags);
  } catch (err) {
    console.error("Error fetching tags:", err);
    res.status(500).send("Error fetching tags");
  }
});

router.get("/:postId/reactions/:userId", async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = req.params.userId;
    const reaction = await postQueries.getUserInteractions(postId, userId);
    return res.json(reaction);
  } catch (err) {
    console.error("Error fetching reaction:", err);
    res.status(500).send("Error fetching reaction");
  }
});

router.get("/get-latest-commit", cacheMiddleware(1200), async (req, res) => {
  try {
    const latestCommit = await githubService.getLatestCommit();
    res.json(latestCommit);
  } catch (error) {
    res.status(500).json({ message: "Error fetching latest commit" });
  }
});

router.get("/posts", async (req, res) => {
  try {
    const sortBy = req.query.sortBy || "trending";
    const userId = req.query.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = 10; // Number of posts per page
    const offset = (page - 1) * limit;

    const posts = await utilFunctions.getPosts(
      sortBy,
      userId,
      page,
      limit,
      offset
    );
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/trending-posts", cacheMiddleware(2400), async (req, res) => {
  try {
    const posts = await utilFunctions.getTrendingPosts();
    res.json(posts);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.get("/user-details/:userId", async (req, res) => {
  try {
    const userDetails = await utilFunctions.getUserDetails(req.params.userId);
    res.json(userDetails);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.get("/comments/:postId", async (req, res) => {
  const postId = req.params.postId;
  try {
    const { comments, totalComments } = await utilFunctions.getComments(postId);
    res.json({ comments, totalComments });
  } catch (err) {
    console.error("Error fetching comments:", err);
    res
      .status(500)
      .json({ error: "An error occurred while fetching comments" });
  }
});

router.get("/tags/:postId", async (req, res) => {
  try {
    const tags = await utilFunctions.getTags(req.params.postId);
    res.json(tags);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.get("/communities/:communitiesId", async (req, res) => {
  try {
    const communities = await utilFunctions.getCommunities(
      req.params.communitiesId
    );

    res.json(communities);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.get("/link-preview/:link", cacheMiddleware(1200), async (req, res) => {
  try {
    const link = decodeURIComponent(decodeURIComponent(req.params.link));
    const linkPreview = await utilFunctions.getLinkPreview(link);
    res.json(linkPreview);
  } catch (err) {
    console.error("Error in link preview route:", err);
    res.status(500).send(err.message);
  }
});

router.get("/commits", async (req, res) => {
  try {
    const commits = await utilFunctions.fetchCommits();
    res.json(commits);
  } catch (error) {
    res.status(500).json({ message: "Error fetching commits" });
  }
});

router.post(
  "/upload-profile-picture",
  checkAuthenticated,
  upload.single("file"),
  async (req, res) => {
    try {
      if (req.file.size > 1000000) {
        return res.status(400).send("File size too large");
      }
      const userId = req.user.userId;
      const filePath = req.file.path;
      await userQueries.updateProfilePicture(userId, filePath);
      res.redirect("back");
    } catch (err) {
      console.error(err);
      res.status(500).send("Server error");
    }
  }
);

module.exports = router;
