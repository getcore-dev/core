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
const cheerio = require("cheerio");

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
        commits.forEach((commit) => {
          const date = commit.commit.committer.date.split("T")[0];
          commitGraph[date] = (commitGraph[date] || 0) + 1;
        });

        if (commits.length < commitsPerPage) {
          break;
        }
        page++;
      }

      console.log(commitGraph);
      res.json({ username, commitGraph });
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

router.get("/jobs", async (req, res) => {
  try {
    const jobPostings = await jobQueries.getJobs();
    res.json(jobPostings);
  } catch (err) {
    console.error("Error fetching job postings:", err);
    res.status(500).send("Error fetching job postings");
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

router.post("/job-postings", async (req, res) => {
  try {
    const {
      title,
      company,
      company_description,
      location,
      salary,
      salary_max,
      experienceLevel,
      skills,
      tags,
      description,
      logo_url,
      link
    } = req.body;

    // Check if the company exists in the database
    let companyId = await jobQueries.getCompanyIdByName(company);

    if (!companyId) {
      companyId = await jobQueries.createCompany(
        company,
        logo_url,
        location,
        company_description
      );
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
      null,
      skills.split(",").map((skill) => skill.trim())
    );

    res
      .status(201)
      .json({ message: "Job posting created successfully", jobPostingId });
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
    const chatGPTModule = await import("chatgpt");

    if (link) {
      const api = new chatGPTModule.ChatGPTAPI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const headers = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
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
      - company_name (as simple as possible, not amazon inc, just Amazon. If it's a startup, use the startup name)
      - company_description (write a short paragraph about the company, where they're located, their mission, etc)
      - location (City, State(full name), Country)
      - salary (integer only, no currency symbol, no matter what format the salary in (hourly, monthly, weekly) convert to yearly salary)
      - salary_max (integer only, no currency symbol, no matter what format the salary in (hourly, monthly, weekly) convert to yearly salary)
      - experience_level ("Internship", "Entry Level", "Junior", "Mid Level", "Senior" or "Lead" only)
      - skills (6-10 skills, prefer single word skills, as a comma-separated list)
      - tags (at least 10 tags relevant to the job posting)
      - description (try to take up to 3 paragraphs from the original source)
      - company_logo (logo URL of the company, try to extract it from the HTML source or provide a relevant URL if available)
      - benefits (as a comma-separated list) 
      
      
      
      Provide the extracted information in JSON format.`;

      const response = await api.sendMessage(prompt);
      console.log("Raw response text:", response.text);

      // Remove triple backticks and any other non-JSON characters
      const cleanedResponse = response.text
        .replace(/^`{3}(json)?|`{3}$/g, "")
        .trim();

      console.log("Cleaned response:", cleanedResponse);

      let extractedData;
      try {
        extractedData = JSON.parse(cleanedResponse);
      } catch (error) {
        console.error("Error parsing JSON response:", error);
        res.status(500).json({
          error: "Failed to parse the JSON response from the ChatGPT API",
        });
        return;
      }

      console.log("Extracted data:", extractedData);

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

router.get("/communities", async (req, res) => {
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
    const posts = await utilFunctions.getPostsForCommunity(communityId);
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
    const user = req.user ? req.user : null;
    const sortBy = req.query.sortBy || "best";
    const posts = await utilFunctions.getPosts(sortBy, user ? user.id : null);
    res.json(posts);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.get("/trending-posts", async (req, res) => {
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
  try {
    let cachedData = cache.get(req.params.postId);
    if (cachedData) {
      return res.json(cachedData);
    }

    const comments = await utilFunctions.getComments(req.params.postId);

    cache.set(req.params.postId, comments);
    res.json(comments);
  } catch (err) {
    res.status(500).send(err.message);
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
