const express = require('express');
const router = express.Router();
const userQueries = require('../queries/userQueries');
const updateQueries = require('../queries/updateQueries');
const multer = require('multer');
const { checkAuthenticated } = require('../middleware/authMiddleware');
const storage = multer.diskStorage({
  destination: './public/uploads/',
  filename: function (req, file, cb) {
    cb(null, 'profile-' + Date.now() + '.jpg');
  },
});
const User = require('../models/User.js');
const JobProcessor = require('../services/jobBoardService');
const jobProcessor = new JobProcessor();
const environment = require('../config/environment');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(environment.geminiKey);
const cheerio = require('cheerio');
const githubService = require('../services/githubService');
const cacheMiddleware = require('../middleware/cache');
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 1200 }); // TTL is 20 minutes
const utilFunctions = require('../utils/utilFunctions');
const upload = multer({ storage });
const marked = require('marked');
const postQueries = require('../queries/postQueries');
const jobQueries = require('../queries/jobQueries');
const sql = require('mssql');
const axios = require('axios');
const communityQueries = require('../queries/communityQueries');
const linkFunctions = require('../utils/linkFunctions');
const commentQueries = require('../queries/commentQueries');
const { default: rateLimit } = require('express-rate-limit');
const notificationQueries = require('../queries/notificationQueries.js');

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

router.get('/getUsername/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const user = await userQueries.findById(id);
    if (user) {
      res.json(user.username);
    } else {
      res.status(404).send('User not found');
    }
  } catch (err) {
    res.status(500).send('Server error');
  }
});

router.get('/available-username/:username', async (req, res) => {
  const username = req.params.username;
  try {
    const user = await userQueries.findByUsername(username);
    if (user) {
      res.json({ available: false });
    } else {
      res.json({ available: true });
    }
  } catch (err) {
    res.status(500).send('Server error');
  }
});

router.get('/job-postings', async (req, res) => {
  try {
    const jobPostings = await jobQueries.getJobs();
    res.json(jobPostings);
  } catch (err) {
    console.error('Error fetching job postings:', err);
    res.status(500).send('Error fetching job postings');
  }
});

router.get('/leetcode-experience/:username', async (req, res) => {
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
      'https://leetcode.com/graphql',
      {
        query,
        variables,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
        },
      }
    );

    const userStats = data.data.matchedUser.submitStats.acSubmissionNum;
    const easySolved = userStats.find(
      (stat) => stat.difficulty === 'Easy'
    ).count;
    const mediumSolved = userStats.find(
      (stat) => stat.difficulty === 'Medium'
    ).count;
    const hardSolved = userStats.find(
      (stat) => stat.difficulty === 'Hard'
    ).count;

    res.json({
      easySolved,
      mediumSolved,
      hardSolved,
    });
  } catch (err) {
    console.error('Error fetching LeetCode data:', err);
    res.status(500).send('Error fetching LeetCode data');
  }
});

router.get('/get-skill/:skillName', async (req, res) => {
  try {
    const skillName = req.params.skillName;
    const skill = await jobQueries.getSkill(skillName);
    res.json(skill);
  } catch (err) {
    console.error('Error fetching skill:', err);
    res.status(500).send('Error fetching skill');
  }
});

router.get('/updates', cacheMiddleware(1600), async (req, res) => {
  try {
    const updates = await updateQueries.getUpdates();
    res.json({'updates': updates});
  } catch (err) {
    console.error('Error fetching updates:', err);
    res.status(500).send('Error fetching updates');
  }
});

router.get('/updates/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const update = await updateQueries.getUpdateById(id);
    const comments = await updateQueries.getUpdateComments(id);
    update.comments = comments;
    res.json(update);
  } catch (err) {
    console.error('Error fetching update:', err);
    res.status(500).send('Error fetching update');
  }
});

router.get('/updates/:updateId/pr-info', cacheMiddleware(1600), async (req, res) => {
  try {
    const updateId = req.params.updateId;
    
    // Fetch the update data (assuming you have a function for this)
    const update = await updateQueries.getUpdateById(updateId);
    
    if (!update || !update.pull_request_url) {
      return res.status(404).json({ error: 'Update not found or no pull request URL' });
    }

    // Fetch the pull request info
    const prInfo = await utilFunctions.getPullRequestInfo(update.pull_request_url);

    res.json(prInfo);
  } catch (error) {
    console.error('Error fetching pull request info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get(
  '/github-commit-graph/:username',
  cacheMiddleware(2400),
  async (req, res) => {
    try {
      const { Octokit } = await import('@octokit/rest');

      const username = req.params.username;
      const user = await userQueries.findByGitHubUsername(username);

      if (!user || !user.githubAccessToken) {
        return res
          .status(404)
          .json({ error: 'User not found or access token not available' });
      }

      const accessToken = user.githubAccessToken;
      const octokit = new Octokit({
        auth: accessToken,
        userAgent: 'CORE',
      });

      const commitGraph = {};
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const oneYearAgoDate = oneYearAgo.toISOString().split('T')[0];
      let page = 1;
      const commitsPerPage = 100;
      let commitCount = 0;
      const maxResults = 1000;

      while (commitCount < maxResults) {
        const { data } = await octokit.search.commits({
          q: `author:${username} committer-date:>=${oneYearAgoDate}`,
          sort: 'committer-date',
          order: 'desc',
          per_page: commitsPerPage,
          page: page,
        });

        const commits = data.items;
        commitCount += commits.length;
        commits.forEach((commit) => {
          const date = commit.commit.committer.date.split('T')[0];
          commitGraph[date] = (commitGraph[date] || 0) + 1;
        });

        if (commits.length < commitsPerPage || page >= 10) {
          break;
        }
        page++;
      }

      res.json({ username, commitGraph, commitCount });
    } catch (error) {
      console.error('Error fetching GitHub commit graph:', error);
      res.status(500).json({ error: 'Failed to fetch GitHub commit graph' });
    }
  }
);

router.get(
  '/github-repos/:username',
  cacheMiddleware(2400),
  async (req, res) => {
    try {
      const username = req.params.username;
      const user = await userQueries.findByGitHubUsername(username);

      if (!user || !user.githubAccessToken) {
        return res
          .status(404)
          .json({ error: 'User not found or access token not available' });
      }

      const accessToken = user.githubAccessToken;
      const url = `https://api.github.com/users/${username}/repos`;
      const headers = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
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
      console.error('Error fetching GitHub repositories:', error);
      res.status(500).json({ error: 'Failed to fetch GitHub repositories' });
    }
  }
);

router.get('/companiesJobs', async (req, res) => {
  try {
    const companies = await jobQueries.getAllCompaniesAndJobCount();
    res.json(companies);
  } catch (err) {
    console.error('Error fetching companies:', err);
    res.status(500).send('Error fetching companies');
  }
});

router.get('/skills', async (req, res) => {
  try {
    const skills = await jobQueries.getSkills();
    res.json(skills);
  } catch (err) {
    console.error('Error fetching skills:', err);
    res.status(500).send('Error fetching skills');
  }
});

router.get('/community/:communityId/jobs', async (req, res) => {
  try {
    const communityId = req.params.communityId;
    const page = parseInt(req.query.page) || 1; // Get the page number from query parameters, default to 1
    const limit = parseInt(req.query.limit) || 10; // Get the number of items per page, default to 10

    // Fetch community tags by communityId
    const community = await communityQueries.getCommunity(communityId);

    if (!community) {
      return res.status(404).send('Community not found');
    }

    if (community.JobsEnabled === 'False') {
      return res.status(404).send('Jobs are not enabled for this community');
    }

    // Assume community.Tags is a CSV string
    const communityTags = community.Tags.split(',');

    if (!communityTags.length) {
      return res.status(404).send('No tags found for the given community');
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
    console.error('Error fetching job postings:', err);
    res.status(500).send('Error fetching job postings');
  }
});

router.get('/jobs/company/:companyName', async (req, res) => {
  try {
    const companyName = req.params.companyName;
    const company = await jobQueries.getCompanyIdByName(companyName);
    const companyId = company ? company.id : null;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const jobs = await jobQueries.getJobsByCompany(companyId, page, pageSize);
    res.json(jobs);
  } catch (err) {
    console.error('Error fetching jobs:', err);
    res.status(500).send('Error fetching jobs');
  }
});

router.post('/post/:postId/share', async (req, res) => {
  try {
    const postId = req.params.postId;
    const sharedPostId = await utilFunctions.sharePost(postId);
    res.json({ sharedPostId });
  } catch (err) {
    console.error('Error sharing post:', err);
    res.status(500).send('Error sharing post');
  }
});

router.post('/job/:jobId/apply', async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const appliedJobId = await utilFunctions.applyJob(jobId);
    res.json({ appliedJobId });
  } catch (err) {
    console.error('Error sharing job:', err);
    res.status(500).send('Error sharing post');
  }
});

router.post('/job/:jobId/share', async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const sharedJobId = await utilFunctions.shareJob(jobId);
    res.json({ sharedJobId });
  } catch (err) {
    console.error('Error sharing job:', err);
    res.status(500).send('Error sharing post');
  }
});
router.get('/randomJobs', cacheMiddleware(600), async (req, res) => {
  try {

    const jobPostings = await jobQueries.getRecent10Jobs();

    res.json({
      jobPostings,
    });
  } catch (err) {
    console.error('Error fetching job postings:', err);
    res.status(500).send('Error fetching job postings');
  }
});

router.get('/recentJobs', cacheMiddleware(600), async (req, res) => {
  try {
    const jobPostings = await jobQueries.getRecentJobs(1, 6);
    res.json({
      jobPostings,
    });
  } catch (err) {
    console.error('Error fetching job postings:', err);
    res.status(500).send('Error fetching job postings');
  }
});

router.get('/getTopTags', cacheMiddleware(3600), async (req, res) => {
  try {
    const tags = await jobQueries.getCountOfTopJobTags();
    res.json(tags);
  } catch (err) {
    console.error('Error fetching tags:', err);
    res.status(500).send('Error fetching tags');
  }
});


router.get('/getTopSkills', cacheMiddleware(3600), async (req, res) => {
  try {
    const skills = await jobQueries.getCountOfTopJobSkills();
    res.json(skills);
  } catch (err) {
    console.error('Error fetching skills:', err);
    res.status(500).send('Error fetching skills');
  }
});

router.get('/company/:name/comments', async (req, res) => {
  try {
    const companyName = req.params.name;
    const company = await jobQueries.getCompanyByName(companyName);
    const comments = await jobQueries.getCompanyComments(company.id);
    // get user most recent job experience
    res.json(comments);
  } catch (err) {
    console.error('Error fetching company comments:', err);
    res.status(500).send('Error fetching company comments');
  }
});



router.get('/jobs', cacheMiddleware(2400), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const {
      titles,
      locations,
      experiencelevels,
      salary,
      skills,
      companies
    } = req.query;

    // Parse the query parameters
    const parsedTitles = titles ? JSON.parse(titles) : [];
    const parsedLocations = locations ? JSON.parse(locations) : [];
    const parsedExperienceLevels = experiencelevels ? JSON.parse(experiencelevels) : [];
    const parsedSalary = parseInt(salary) || 0;
    const parsedSkills = skills ? JSON.parse(skills) : [];
    const parsedCompanies = companies ? JSON.parse(companies) : [];

    const user = req.user;
    let userPreferences = {};

    // parsedCompanies = [ '{"id":"71","name":"Apple","logo":"/src/applelogo.png"}' ]
    if (parsedCompanies.length !== 0) {
      const jobPostings = await jobQueries.getJobsByCompanies(parsedCompanies, page, pageSize);
      return res.json({
        jobPostings,
        currentPage: page,
      });
    }
    /*
    if (user) {
      userPreferences = {
        jobPreferredTitle: user.jobPreferredTitle,
        jobPreferredSkills: user.jobPreferredSkills
          ? user.jobPreferredSkills.split(',').map(String)
          : [],
        jobPreferredLocation: user.jobPreferredLocation,
        jobExperienceLevel: user.jobExperienceLevel,
        jobPreferredIndustry: user.jobPreferredIndustry,
        jobPreferredSalary: user.jobPreferredSalary,
      };
    }
      */

    const isEmptySearch =
      parsedTitles.length === 0 &&
      parsedLocations.length === 0 &&
      parsedExperienceLevels.length === 0 &&
      parsedSalary === 0 &&
      parsedSkills.length === 0 &&
      parsedCompanies.length === 0;

    let allJobPostings;

    if (isEmptySearch && user && Object.keys(userPreferences).length > 0) {
      allJobPostings = await jobQueries.searchAllJobsFromLast30Days(
        userPreferences,
        page,
        pageSize
      );
    } else if (isEmptySearch) {
      allJobPostings = await jobQueries.getRecentJobs(page, pageSize);
    } else {
      allJobPostings = await jobQueries.searchAllJobsFromLast30Days(
        {
          titles: parsedTitles,
          locations: parsedLocations,
          experienceLevels: parsedExperienceLevels,
          salary: parsedSalary,
          skills: parsedSkills,
          companies: parsedCompanies
        },
        page,
        pageSize
      );
      console.log(allJobPostings);
    }

    res.json({
      jobPostings: allJobPostings,
      currentPage: page,
    });
  } catch (err) {
    console.error('Error fetching job postings:', err);
    res.status(500).send('Error fetching job postings');
  }
});


router.get('/job-experience/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const jobExperience = await jobQueries.getUserJobExperience(userId);
    res.json(jobExperience);
  } catch (err) {
    console.error('Error fetching job experience:', err);
    res.status(500).send('Error fetching job experience');
  }
});

router.get('/education-experience/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const jobExperience = await jobQueries.getUserEducationExperience(userId);
    res.json(jobExperience);
  } catch (err) {
    console.error('Error fetching job experience:', err);
    res.status(500).send('Error fetching job experience');
  }
});

router.get('/job-titles', async (req, res) => {
  try {
    const jobTitles = await jobQueries.getJobTitles();
    res.json(jobTitles);
  } catch (err) {
    console.error('Error fetching job titles:', err);
    res.status(500).send('Error fetching job titles');
  }
});

router.get('/jobs/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const jobPosting = await jobQueries.findById(id);
    res.json(jobPosting);
  } catch (err) {
    console.error('Error fetching job posting:', err);
    res.status(500).send('Error fetching job posting');
  }
});

router.get('/duplicate-jobs', async (req, res) => {
  try {
    const duplicateJobs = await jobQueries.getDuplicateJobPostings();
    res.json(duplicateJobs);
  } catch (err) {
    console.error('Error fetching duplicate jobs:', err);
    res.status(500).send('Error fetching duplicate jobs');
  }
});

router.get('/jobs/:id/similar', cacheMiddleware(2400), async (req, res) => {
  try {
    const id = req.params.id;
    const jobPosting = await jobQueries.findById(id);
    const similarJobs = await jobQueries.getSimilarJobs(jobPosting.id);
    res.json(similarJobs);
  } catch (err) {
    console.error('Error fetching similar jobs:', err);
    res.status(500).send('Error fetching similar jobs');
  }
});

router.get('/jobs/:id/similar-company', cacheMiddleware(2400), async (req, res) => {
  try {
    const id = req.params.id;
    const jobPosting = await jobQueries.findById(id);
    const similarJobs = await jobQueries.getSimilarJobsByCompany(
      jobPosting.company_id,
      jobPosting.id
    );
    res.json(similarJobs);
  } catch (err) {
    console.error('Error fetching similar jobs:', err);
    res.status(500).send('Error fetching similar jobs');
  }
});

router.post('/job-postings', checkAuthenticated, async (req, res) => {
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

    console.log({      title,
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
      relocation});
      
    let companyObject = await jobQueries.getCompanyIdByName(company);
    let companyId = companyObject ? companyObject.id : null;
    const user = req.user;

    if (!companyId) {
      companyId = await jobQueries.createCompany(company, null, location, null, null, null, null, null);
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
      tags.split(',').map((tag) => tag.trim()),
      description,
      salary_max,
      user.recruiter_id,
      skills.split(',').map((skill) => skill.trim()),
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
      message: 'Job posting created successfully',
      jobPostingId: jobPostingId.toString(),
    });
  } catch (error) {
    console.error('Error creating job posting:', error);
    res
      .status(500)
      .json({ error: 'An error occurred while creating the job posting' });
  }
});

router.post('/extract-job-details', async (req, res) => {
  try {
    const { link } = req.body;

    if (!link) {
      return res.status(400).json({ error: 'Invalid job link' });
    }

    const extractedData = await jobProcessor.processJobLink(link);

    if (extractedData.error) {
      return res.status(500).json({ error: extractedData.error });
    }

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
    } catch (error) {
      await notificationQueries.createAdminNotification(
        'JOB_EXTRACTION_ERROR',
        null,
        req.user.id || null,
        new Date(),
        'error',
      );
      console.log(
        `Error creating company: ${extractedData.company_name}`,
        error
      );
    }



    res.json(extractedData);
  } catch (error) {
    console.error('Error extracting job details:', error);
    res
      .status(500)
      .json({ error: 'An error occurred while extracting job details' });
  }
});

router.post('/auto-create-job-posting', async (req, res) => {
  try {
    const { link } = req.body;

    if (!link) {
      return res.status(400).json({ error: 'Invalid job link' });
    }

    let jobLinks = [link];

    if (link.includes('greenhouse.io')) {
      jobLinks = await linkFunctions.scrapeGreenhouseJobs(link);
    } else if (link.includes('lever.co')) {
      jobLinks = await linkFunctions.scrapeLeverJobs(link);
    }

    for (const jobLink of jobLinks) {
      const extractedData = await jobProcessor.processJobLink(jobLink);

      if (extractedData.error) {
        console.error(
          `Error processing job link ${jobLink}:`,
          extractedData.error
        );
        continue;
      }

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
          jobLink,
          null,
          extractedData.tags
            ? extractedData.tags.split(',').map((tag) => tag.trim())
            : [],
          extractedData.description,
          extractedData.salary_max,
          1,
          extractedData.skills
            ? extractedData.skills.split(',').map((skill) => skill.trim())
            : [],
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
          `Job posting created successfully for job link: ${jobLink}`
        );
      } catch (error) {
        console.error(
          `Error creating job posting for job link: ${jobLink}`,
          error
        );
      }
    }

    res.status(201).json({ message: 'Job postings processed successfully' });
  } catch (error) {
    console.error('Error processing job postings:', error);
    res
      .status(500)
      .json({ error: 'An error occurred while processing job postings' });
  }
});

router.get('/skills/jobs/:skill', async (req, res) => {
  try {
    const skill = req.params.skill;
    const skillId = await jobQueries.getSkillsId(skill);
    const page = req.query.page || 1;
    const pageSize = req.query.pageSize || 15;
    if (!skillId) {
      res.status(404).send('Skill not found');
    }
    const jobs = await jobQueries.getJobsBySkills(skillId, page, pageSize);
    res.json({jobs});
  } catch (err) {
    console.error('Error fetching job postings:', err);
    res.status(500).send('Error fetching job postings');
  }
});

router.get('/company-name-test/:name', async (req, res) => {
  try {
    const company = jobQueries.getCompanyIdByName(req.params.name);
    res.json(company);
  } catch (err) {
    console.error('Error fetching company:', err);
    res.status(500).send('Error fetching company');
  }
});

router.get('/similar-skills/:skill', async (req, res) => {
  try {
    const skill = req.params.skill;
    const skillId = await jobQueries.getSkillsId(skill);
    if (!skillId) {
      res.status(404).send('Skill not found');
    }
    const similarSkills = await jobQueries.getSimilarSkills(skillId);
    res.json(similarSkills);
  }
  catch (err) {
    console.error('Error fetching similar skills:', err);
    res.status(500).send('Error fetching similar skills');
  }
});

router.get('/posts/:postId/comments', async (req, res) => {
  try {
    const postId = req.params.postId;
    const comments = await utilFunctions.getComments(postId);
    res.json(comments);
  } catch (err) {
    console.error('Error fetching comments:', err);
    res.status(500).send('Error fetching comments');
  }
});

router.get('/get-current-user-count', cacheMiddleware(600), async (req, res) => {
  try {
    const userCount = await userQueries.getUserCount();
    res.json(userCount);
  } catch (err) {
    console.error('Error fetching user count:', err);
    res.status(500).send('Error fetching user count');
  }
});

router.get('/posts/:postId', rateLimit({ windowMs: 60000, max: 100 }), async (req, res) => {
  try {
    const postId = req.params.postId;
    const user = req.user ? req.user : null;
    const postData = await utilFunctions.getPostData(postId, user);
    if (!postData) {
      return res.status(404).send('Post not found');
    }

    if (postData.content) { 
      try {
        postData.content = marked(postData.content);
      } catch (error) {
        console.error('Error parsing markdown:', error);
      }
    }
    res.json(postData);
  } catch (err) {
    console.error('Error fetching post data:', err);
    res.status(500).send('Error fetching post data');
  }
});

router.get('/posts/:postId/getReaction', async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = req.query.userId; // Assuming userId is sent as a query parameter
    const reaction = await postQueries.getUserInteractions(postId, userId);
    return res.json(reaction);
  } catch (err) {
    console.error('Error fetching reaction:', err);
    res.status(500).send('Error fetching reaction');
  }
});

router.get('/communities', cacheMiddleware(2400), async (req, res) => {
  try {
    const user = req.user; 
    const communities = await utilFunctions.getAllCommunities(user);
    return res.json(communities);
  } catch (err) {
    console.error('Error fetching communities:', err);
    res.status(500).send('Error fetching communities');
  }
});

router.get('/recentCompanies', cacheMiddleware(2400), async (req, res) => {
  try {
    const companies = await jobQueries.getRecentCompanies();
    return res.json(companies);
  } catch (err) {
    console.error('Error fetching companies:', err);
    res.status(500).send('Error fetching companies');
  }
});

router.get('/companies', async (req, res) => {
  try {
    const companies = await jobQueries.getCompanies();
    res.json(companies);
  } catch (err) {
    console.error('Error fetching companies:', err);
    res.status(500).send('Error fetching companies');
  }
});

router.get('/communities/:communityId/posts', async (req, res) => {
  try {
    const communityId = req.params.communityId;
    const page = parseInt(req.query.page) || 1;
    const sortBy = req.query.sortBy || 'trending';
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
    res.status(500).send('Error fetching posts');
  }
});

router.get('/comments/:commentId/replies', async (req, res) => {
  try {
    const commentId = req.params.commentId;
    const replies = await utilFunctions.getRepliesForComment(commentId);
    res.json(replies);
  } catch (err) {
    console.error('Error fetching replies:', err);
    res.status(500).send('Error fetching replies');
  }
});

router.get('/tags', async (req, res) => {
  try {
    const tags = await utilFunctions.getAllTags();
    res.json(tags);
  } catch (err) {
    console.error('Error fetching tags:', err);
    res.status(500).send('Error fetching tags');
  }
});

router.get('/:postId/reactions/:userId', async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = req.params.userId;
    const reaction = await postQueries.getUserInteractions(postId, userId);
    return res.json(reaction);
  } catch (err) {
    console.error('Error fetching reaction:', err);
    res.status(500).send('Error fetching reaction');
  }
});

router.get('/get-latest-commit', cacheMiddleware(1200), async (req, res) => {
  try {
    const latestCommit = await githubService.getLatestCommit();
    res.json(latestCommit);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching latest commit' });
  }
});


router.get('/preview-comments/:postId', async (req, res) => {
  try {
    const postId = req.params.postId;
    const comments = await utilFunctions.getComments(postId);
    res.json(comments);
  } catch (err) {
    console.error('Error fetching comments:', err);
    res.status(500).send('Error fetching comments');
  }
});

router.get('/posts', async (req, res) => {
  try {
    const sortBy = req.query.sortBy || 'trending'; // Default to "trending"
    const userId = req.query.userId;
    const user = userQueries.findById(userId);
    const page = parseInt(req.query.page) || 1;
    const limit = 10; // Number of posts per page
    const offset = (page - 1) * limit;

    const posts = await utilFunctions.getPosts(
      sortBy,
      user,
      page,
      limit,
      offset
    );
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/trending-posts', cacheMiddleware(2400), async (req, res) => {
  try {
    const posts = await utilFunctions.getTrendingPosts();
    res.json(posts);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.get('/user-details/:userId', async (req, res) => {
  try {
    const userDetails = await utilFunctions.getUserDetails(req.params.userId);
    res.json(userDetails);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.get('/comments/:postId', async (req, res) => {
  const postId = req.params.postId;
  try {
    const { comments, totalComments } = await utilFunctions.getComments(postId);
    res.json({ comments, totalComments });
  } catch (err) {
    console.error('Error fetching comments:', err);
    res
      .status(500)
      .json({ error: 'An error occurred while fetching comments' });
  }
});

router.get('/tags/:postId', async (req, res) => {
  try {
    const tags = await utilFunctions.getTags(req.params.postId);
    res.json(tags);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.get('/communities/:communitiesId', async (req, res) => {
  try {
    const communities = await utilFunctions.getCommunities(
      req.params.communitiesId
    );

    res.json(communities);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.get('/link-preview/:link', cacheMiddleware(1200), async (req, res) => {
  try {
    const link = decodeURIComponent(decodeURIComponent(req.params.link));
    const linkPreview = await utilFunctions.getLinkPreview(link);
    res.json(linkPreview);
  } catch (err) {
    console.error('Error in link preview route:', err);
    res.status(500).send(err.message);
  }
});

router.get('/recentJobsCount', cacheMiddleware(2400), async (req, res) => {
  try {
    const count = await jobQueries.getRecentJobCount();
    res.json(count);
  } catch (err) {
    console.error('Error fetching companies count:', err);
    res.status(500).send('Error fetching companies count');
  }
});

router.get('/totalCompaniesCount', cacheMiddleware(2400), async (req, res) => {
  try {
    const count = await jobQueries.getCompaniesCount();
    res.json(count);
  } catch (err) {
    console.error('Error fetching companies count:', err);
    res.status(500).send('Error fetching companies count');
  }
});

router.get('/profile/jobs', checkAuthenticated, async (req, res) => {
  try {
    const userId = req.query.userId || req.user.userId;
    const preferences = await jobQueries.getUserJobPreferences(userId);
    res.json(preferences);
  } catch (err) {
    console.error('Error fetching user jobs:', err);
    res.status(500).send('Error fetching user jobs');
  }
});
router.get('/commits', async (req, res) => {
  try {
    const commits = await utilFunctions.fetchCommits();
    res.json(commits);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching commits' });
  }
});

router.post(
  '/upload-profile-picture',
  checkAuthenticated,
  upload.single('file'),
  async (req, res) => {
    try {
      if (req.file.size > 1000000) {
        return res.status(400).send('File size too large');
      }
      const userId = req.user.userId;
      const filePath = req.file.path;
      await userQueries.updateProfilePicture(userId, filePath);
      res.redirect('back');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
    }
  }
);

module.exports = router;
