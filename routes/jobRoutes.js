const { BlobServiceClient } = require('@azure/storage-blob');
const express = require('express');
const router = express.Router();
const jobQueries = require('../queries/jobQueries');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const AZURE_STORAGE_CONNECTION_STRING =
  process.env.AZURE_STORAGE_CONNECTION_STRING;

const {
  checkAuthenticated,
  checkNotAuthenticated,
} = require('../middleware/authMiddleware');
const cacheMiddleware = require('../middleware/cache');
const rateLimit = require('express-rate-limit');
const viewLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 3,
  handler: (req, res, next) => {
    req.rateLimit = {
      exceeded: true,
    };
    next();
  },
  keyGenerator: (req) => `${req.ip}_${req.params.jobId}`,
  skip: (req) => {
    const eightHoursAgo = Date.now() - 8 * 60 * 60 * 1000;
    return req.rateLimit.resetTime && req.rateLimit.resetTime < eightHoursAgo;
  },
});

router.get('/', async (req, res) => {
  // const recentJobs = await jobQueries.getRecentJobCount();
  res.render('jobs.ejs', { user: req.user, recentJobs: [] });
});

router.get('/create', checkAuthenticated, async (req, res) => {
  try {
    const skills = await jobQueries.getSkills();
    res.render('create-job.ejs', { skills, user: req.user });
  } catch (err) {
    console.error('Error fetching job postings:', err);
    res.status(500).send('Error fetching job postings');
  }
});

router.get('/company/create', checkAuthenticated, async (req, res) => {
  try {
    res.render('create-company.ejs', { user: req.user });
  } catch (err) {
    console.error('Error fetching job postings:', err);
    res.status(500).send('Error fetching job postings');
  }
});

router.get('/company/:name', async (req, res) => {
  try {
    const companyName = decodeURIComponent(req.params.name);
    const company = await jobQueries.getCompanyByName(companyName);
    const jobs = [];
    const jobsCount = await jobQueries.getJobCountByCompany(companyName);
    res.render('company_profile.ejs', {
      company,
      jobs,
      user: req.user,
      jobsCount,
    });
  } catch (err) {
    console.error('Error fetching job postings:', err);
  }
});

router.get('/company/:name/edit', checkAuthenticated, async (req, res) => {
  try {
    const companyName = req.params.name;
    const company = await jobQueries.getCompanyByName(companyName);
    res.render('edit-company.ejs', { company, user: req.user });
  } catch (err) {
    console.error('Error fetching company details:', err);
    res.status(500).send('Error fetching company details');
  }
});

router.post('/company/:name/edit', 
  checkAuthenticated,
  upload.single('logo'),
  async (req, res) => {
  try {
    const file = req.file;
    const companyName = req.params.name;
    const company = await jobQueries.getCompanyByName(companyName);
    let {
      name,
      location,
      description,
      industry,
      founded,
      size,
      stock_symbol,
      job_board_url,
    } = req.body;
    let pictureUrl;

    if (file) {
      const blobServiceClient = BlobServiceClient.fromConnectionString(
        AZURE_STORAGE_CONNECTION_STRING
      );
      const containerClient =
        blobServiceClient.getContainerClient('coreavatars');
      const blobName = 'company-profiles/' + companyName + '/' + file.originalname;
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      const containerName = 'coreavatars';
      await blockBlobClient.uploadFile(file.path); // Uploads the file to Azure Blob Storage
      pictureUrl = `https://${blobServiceClient.accountName}.blob.core.windows.net/${containerName}/${blobName}`;
    }

    await jobQueries.updateCompany(
      company.id,
      name || undefined,
      location || undefined,
      description || undefined,
      pictureUrl || undefined,
      undefined,
      industry || undefined,
      founded || undefined,
      size || undefined,
      stock_symbol || undefined,
      job_board_url || undefined
    );

    res.redirect(`/jobs/company/${name}`);
  } catch (err) {
    console.error('Error updating company details:', err);
    res.status(500).send('Error updating company details');
  }
});

router.post('/update-experiences', checkAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    let experiences = req.body.experiences;

    if (!Array.isArray(experiences)) {
      experiences = [experiences];
    }

    console.log('Incoming experiences:', experiences);

    // Clear existing job experiences and tags for the user
    await jobQueries.clearUserJobExperienceTags(userId);
    await jobQueries.clearUserJobExperience(userId);

    // Process each job experience
    for (const experience of experiences) {
      if (!experience) {
        console.warn('Skipping undefined experience');
        continue;
      }

      const {
        title,
        employmentType,
        companyName,
        location,
        isCurrent,
        startDate,
        endDate,
        description,
        tags,
      } = experience;

      // Add new job experience (assuming the function also handles updating if the ID exists)
      await jobQueries.addJobExperience(
        userId,
        title,
        employmentType,
        companyName,
        location,
        isCurrent,
        startDate,
        endDate,
        description,
        tags
      );
    }

    res.status(200).send('Job experiences updated successfully');
  } catch (err) {
    console.error('Error updating job experiences:', err);
    res.status(500).send('Error updating job experiences');
  }
});

router.post(
  '/update-education-experiences',
  checkAuthenticated,
  async (req, res) => {
    try {
      const userId = req.user.id;
      let experiences = req.body.experiences;

      if (!Array.isArray(experiences)) {
        experiences = [experiences];
      }

      console.log('Incoming experiences:', experiences);

      // Clear existing job experiences and tags for the user
      await jobQueries.clearUserEducationExperience(userId);

      // Process each job experience
      for (const experience of experiences) {
        if (!experience) {
          console.warn('Skipping undefined experience');
          continue;
        }

        const {
          institutionName,
          degree,
          fieldOfStudy,
          isCurrent,
          startDate,
          endDate,
          description,
          grade,
          activities,
        } = experience;

        // Add new job experience (assuming the function also handles updating if the ID exists)
        await jobQueries.addEducationExperience(
          userId,
          institutionName,
          degree,
          fieldOfStudy,
          isCurrent,
          startDate,
          endDate,
          description,
          grade,
          activities
        );
      }

      res.status(200).send('Job experiences updated successfully');
    } catch (err) {
      console.error('Error updating job experiences:', err);
      res.status(500).send('Error updating job experiences');
    }
  }
);

router.get('/tags/:tag', async (req, res) => {
  try {
    const tag = req.params.tag;
    const tagId = await jobQueries.getTagId(tag);
    const page = req.query.page || 1;
    const pageSize = req.query.pageSize || 10;
    if (!tagId) {
      res.status(404).send('Tag not found');
    }
    const jobs = await jobQueries.getJobsByTag(tagId, page, pageSize);
    res.render('tag.ejs', { tag, jobs, user: req.user });
  } catch (err) {
    console.error('Error fetching job postings:', err);
    res.status(500).send('Error fetching job postings');
  }
});

router.post('/company/:name/comments', checkAuthenticated, async (req, res) => {
  try {
    const companyName = req.params.name;
    const company = await jobQueries.getCompanyByName(companyName);
    const comment = {
      company_id: company.id,
      user_id: req.user.id,
      content: req.body.content,
      parent_comment_id: req.body.parent_comment_id,
    };
    await jobQueries.addCompanyComment(comment);
    res.redirect(`/jobs/company/${companyName}`);
  }
  catch (err) {
    console.error('Error posting company comment:', err);
    res.status(500).send('Error posting company comment');
  }
});

  router.delete('/company/:name/comments/:commentId', checkAuthenticated, async (req, res) => {
    try {
      const commentId = req.params.commentId;
      await jobQueries.deleteCompanyComment(commentId);
      res.status(200).send('Comment deleted');
    } catch (err) {
      console.error('Error deleting company comment:', err);
      res.status(500).send('Error deleting company comment');
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

router.get('/location/:state', async (req, res) => {
  try {
    const state = req.params.state;
    const jobs = await jobQueries.getJobsByState(state);
    const jobCount = jobs ? jobs.length : 0;
    res.render('job-results.ejs', { state, jobs, user: req.user, jobCount });
  } catch (err) {
    console.error('Error fetching job postings:', err);
    res.status(500).send('Error fetching job postings');
  }
});

router.get('/getRecentJobs', cacheMiddleware(3600), async (req, res) => {
  try {
    const jobCount = await jobQueries.getRecentJobCount();
    res.json(jobCount);
  } catch (err) {
    console.error('Error fetching recent jobs:', err);
    res.json(0);
  }
});

router.get('/delete/:id', checkAuthenticated, async (req, res) => {
  try {
    const user = req.user;
    if (!user.isAdmin) {
      return res.status(401).send('Unauthorized');
    }
    const jobId = req.params.id;
    // delete the job and tags and skills associated with it
    await jobQueries.deleteJob(jobId);
    res.redirect('/jobs');
  } catch (err) {
    console.error('Error deleting job:', err);
    res.status(500).send('Error deleting job');
  }
});

router.get('/:jobId', viewLimiter, async (req, res) => {
  try {
    const jobId = req.params.jobId;

    if (!req.rateLimit || !req.rateLimit.exceeded) {
      await jobQueries.incrementJobViewCount(jobId);
    }

    const job = await jobQueries.findById(jobId);

    if (!job) {
      console.log(`No job found with ID: ${jobId}`);
      return res.redirect('/jobs');
    }

    res.render('job-posting.ejs', {
      job_id: jobId,
      user: req.user,
      job: job,
    });
  } catch (err) {
    console.error(
      `Error fetching job posting with ID ${req.params.jobId}:`,
      err
    );
    res.status(500).send('Error fetching job posting');
  }
});

module.exports = router;
