const { BlobServiceClient } = require('@azure/storage-blob');
const express = require('express');
const router = express.Router();
const jobQueries = require('../queries/jobQueries');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const jobBoardService = require('../services/jobBoardService');
const userJobService = require('../services/userJobService');

const AZURE_STORAGE_CONNECTION_STRING =
  process.env.AZURE_STORAGE_CONNECTION_STRING;
const marked = require('marked');
const {
  checkAuthenticated,
  checkNotAuthenticated,
} = require('../middleware/authMiddleware');
const userRecentQueries = require('../queries/userRecentQueries');
const cacheMiddleware = require('../middleware/cache');
const rateLimit = require('express-rate-limit');
const { user } = require('../config/dbConfig');
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

const experienceLevelRoutes = {
  '/internships': {
    level: 'Internship',
    mainFilter: 'Internships',
    needsJobCount: true
  },
  '/remote': {
    level: '',
    locations: ['Remote'],
    mainFilter: 'Remote Jobs',
    needsJobCount: true
  },
  '/hybrid': {
    locations: 'Hybrid',
    mainFilter: 'Hybrid Jobs',
    needsJobCount: true
  },
  '/pm': {
    level: 'Entry Level',
    title: 'Project Manager',
    mainFilter: 'Project Manager Positions',
    needsJobCount: true
  },
  '/grad': {
    level: 'Entry Level',
    mainFilter: 'Entry Level Positions',
    needsJobCount: true
  },
  '/vp': {
    level: 'VP',
    mainFilter: 'VP Positions',
    needsJobCount: true
  },
  '/junior': {
    level: 'Junior',
    mainFilter: 'Junior Positions',
    needsJobCount: true
  },
  '/senior': {
    level: 'Senior',
    mainFilter: 'Senior Positions',
    needsJobCount: true
  }
};

// Set up routes dynamically
Object.entries(experienceLevelRoutes).forEach(([path, config]) => {
  router.get(path, cacheMiddleware(300), async (req, res) => {
    const filters = parseFilters(req.query);
    if (config.level) filters.experienceLevels = [config.level];
    if (config.title) filters.titles = [config.title];
    if (config.locations) filters.locations = Array.isArray(config.locations) ? config.locations : [config.locations];

    // Only fetch job count if needed
    const jobCount = config.needsJobCount 
      ? await jobQueries.getJobCountByFilter(filters)
      : undefined;

    const userViewedJobs = req.user ? await userRecentQueries.getViewedJobs(req.user.id) : [];
    console.log('User viewed jobs:', userViewedJobs);

    res.render('specific-jobs.ejs', {
      user: req.user,
      mainFilter: config.mainFilter,
      filters: filters,
      jobCount,
      userViewedJobs,
      errorMessages: req.flash('error'),
      successMessages: req.flash('success')
    });
  });
});

router.get('/profile', checkAuthenticated, async (req, res) => {
  res.render('edit-jobs-profile.ejs', { user: req.user });
});

function parseFilters(query) {
  const filters = {};
  if (query.skill) filters.skills = Array.isArray(query.skill) ? query.skill : [query.skill];
  if (query.locations) filters.locations = Array.isArray(query.locations) ? query.locations : [query.locations];
  if (query.titles) filters.titles = Array.isArray(query.titles) ? query.titles : [query.titles];
  if (query.company) filters.companies = Array.isArray(query.company) ? query.company : [query.company];
  if (query.experienceLevel) filters.experienceLevels = Array.isArray(query.experienceLevel) ? query.experienceLevel : [query.experienceLevel];
  if (query.major) filters.majors = Array.isArray(query.major) ? query.major : [query.major];
  if (query.salary) filters.salary = parseInt(query.salary);
  console.log('Filters:', filters);
  return filters;
}

router.get('/', cacheMiddleware(2400), async (req, res) => {
  const filters = parseFilters(req.query);
  const userViewedJobs = req.user ? await userRecentQueries.getViewedJobs(req.user.id) : [];
  res.render('jobs.ejs', { 
    user: req.user, 
    filters: filters,
    userViewedJobs,
    errorMessages: req.flash('error'),
    successMessages: req.flash('success'),
  });
});

router.get('/process/:jobId', checkAuthenticated, async (req, res) => {
  const jobProcessor = new jobBoardService();
  const jobId = req.params.jobId;
  console.log('processing job', jobId);
  const improvedJobPostings = await jobProcessor.processJobPosting(jobId);
  res.json(improvedJobPostings);
});

router.get('/getMatch/:jobId', checkAuthenticated, async (req, res) => {
  const user = req.user;
  const jobId = req.params.jobId;
  const job = await jobQueries.findById(jobId);
  if (!job) {
    req.flash('error', 'Job not found');
    return res.redirect('/jobs');
  }

  const userProcessor = new userJobService();
  console.log(`finding match: job ${jobId} for user ${user.id}`);
  const matchInfo = await userProcessor.getMatchScore(job, user);
  res.json(matchInfo);
});


router.get('/swe', async (req, res) => {
  const filters = parseFilters(req.query);
  filters.titles = ['Software Engineer'];
  res.render('specific-jobs.ejs', { 
    user: req.user, 
    filters: filters,
    errorMessages: req.flash('error'),
    successMessages: req.flash('success'),
  });
});

router.get('/swe2', async (req, res) => {
  const filters = parseFilters(req.query);
  filters.titles = ['Software Engineer', 'Python', 'C++', 'Developer'];
  res.render('jobs.ejs', { 
    user: req.user, 
    filters: filters,
    errorMessages: req.flash('error'),
    successMessages: req.flash('success'),
  });
});

router.get('/applied', checkAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const appliedJobs = await jobQueries.getUserAppliedJobs(userId);
    res.render('applied-jobs.ejs', { user: req.user, appliedJobs });
  } catch (err) {
    console.error('Error fetching applied jobs:', err);
    res.status(500).send('Error fetching applied jobs');
  }
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


router.get('/create-company', async (req, res) => {
  try {
    res.render('create-company-link.ejs', { user: req.user });
  } catch (err) {
    console.error('Error fetching job postings:', err);
    res.status(500).send('Error fetching job postings');
  }
});

router.get('/create-company-queue', async (req, res) => {
  try {
    res.render('create-company-link-queue.ejs', { user: req.user });
  } catch (err) {
    console.error('Error fetching job postings:', err);
    res.status(500).send('Error fetching job postings');
  }
});

router.put('/update-job-status', checkAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const jobId = req.body.jobId;
    const status = req.body.status;
    if (status.trim().toLowerCase() === 'remove') {
      await jobQueries.removeJobApplication(userId, jobId);
    }
    await jobQueries.changeJobStatus(userId, jobId, status);
    res.status(200).send('Job status updated');
  } catch (err) {
    console.error('Error updating job status:', err);
    res.status(500).send('Error updating job status');
  }
});

router.get('/company/:name', async (req, res) => {
  try {
    const companyName = decodeURIComponent(req.params.name);
    const company = await jobQueries.getCompanyByName(companyName);
    if (!company) {
      return res.status(404).redirect('/jobs');
    }
    const jobs = [];
    const userViewedJobs = req.user ? await userRecentQueries.getViewedJobs(req.user.id) : [];
    const jobsCount = await jobQueries.getJobCountByCompany(companyName);
    res.render('company_profile.ejs', {
      company,
      userViewedJobs,
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
        alternate_names,
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
        alternate_names || undefined,
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
  
    console.log('Request body:', JSON.stringify(req.body, null, 2));
  
    if (!Array.isArray(experiences)) {
      console.warn('Experiences is not an array, attempting to convert');
      experiences = [experiences];
    }
  
    console.log('Incoming experiences:', JSON.stringify(experiences, null, 2));
    console.log('Number of experiences received:', experiences.length);
  
    // Clear existing job experiences and tags for the user
    await jobQueries.clearUserJobExperienceTags(userId);
    await jobQueries.clearUserJobExperience(userId);
  
    let processedCount = 0;
    let errorCount = 0;
  
    // Process each job experience
    for (const experience of experiences) {
      try {
        if (!experience) {
          console.warn('Skipping undefined experience');
          continue;
        }
  
        console.log('Processing experience:', JSON.stringify(experience, null, 2));
  
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
  
        // Add new job experience
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
  
        processedCount++;
      } catch (expErr) {
        console.error('Error processing individual experience:', expErr);
        errorCount++;
      }
    }
  
    console.log('Number of experiences processed successfully:', processedCount);
    console.log('Number of experiences that encountered errors:', errorCount);
  
    res.status(200).json({
      message: 'Job experiences update completed',
      processedCount,
      errorCount
    });
  } catch (err) {
    console.error('Error updating job experiences:', err);
    res.status(500).json({
      message: 'Error updating job experiences',
      error: err.message
    });
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
    await jobQueries.deleteJob(jobId);
    req.flash('success', 'Application submitted successfully!');
    res.redirect('/jobs');
  } catch (err) {
    console.error('Error deleting job:', err);
    res.redirect('/jobs?error=Error deleting job');
  }
});

router.get('/:jobId', viewLimiter, async (req, res) => {
  try {
    const jobId = req.params.jobId;

    if (!req.rateLimit || !req.rateLimit.exceeded) {
      await jobQueries.incrementJobViewCount(jobId);
    }

    let job = await jobQueries.findById(jobId);

    if (job.description) {
        job.description = marked.parse(job.description);
    }
    if (job.raw_description_no_format) {
        job.raw_description_no_format = marked.parse(job.raw_description_no_format);
    }

    if (!job) {
      console.log(`No job found with ID: ${jobId}`);
      return res.redirect('/jobs');
    }

    if (req.user) {
        await userRecentQueries.addViewedJob(job.id, job.company_id, req.user.id);
    }
    const userViewedJobs = req.user ? await userRecentQueries.getViewedJobs(req.user.id) : [];
    res.render('job-posting.ejs', {
      job_id: jobId,
      user: req.user,
      userViewedJobs,
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
