const express = require("express");
const router = express.Router();
const jobQueries = require("../queries/jobQueries");
const {
  checkAuthenticated,
  checkNotAuthenticated,
} = require("../middleware/authMiddleware");
const cacheMiddleware = require("../middleware/cache");

router.get("/create", checkAuthenticated, async (req, res) => {
  try {
    const skills = await jobQueries.getSkills();
    res.render("create-job.ejs", { skills, user: req.user });
  } catch (err) {
    console.error("Error fetching job postings:", err);
    res.status(500).send("Error fetching job postings");
  }
});

router.get("/company/:id", async (req, res) => {
  try {
    const companyId = req.params.id;
    const company = await jobQueries.getCompanyById(companyId);
    const jobs = await jobQueries.getJobsByCompany(companyId);
    res.render("company_profile.ejs", { company, jobs, user: req.user });
  } catch (err) {
    console.error("Error fetching job postings:", err);
    res.status(500).send("Error fetching job postings");
  }
});

router.post("/update-experiences", checkAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    let experiences = req.body.experiences;

    if (!Array.isArray(experiences)) {
      experiences = [experiences];
    }

    console.log("Incoming experiences:", experiences);

    // Clear existing job experiences and tags for the user
    await jobQueries.clearUserJobExperienceTags(userId);
    await jobQueries.clearUserJobExperience(userId);

    // Process each job experience
    for (const experience of experiences) {
      if (!experience) {
        console.warn("Skipping undefined experience");
        continue;
      }

      const {
        title,
        employmentType,
        companyName,
        location,
        startDate,
        endDate,
        description,
      } = experience;

      // Add new job experience (assuming the function also handles updating if the ID exists)
      await jobQueries.addJobExperience(
        userId,
        title,
        employmentType,
        companyName,
        location,
        startDate,
        endDate,
        description
      );
    }

    res.status(200).send("Job experiences updated successfully");
  } catch (err) {
    console.error("Error updating job experiences:", err);
    res.status(500).send("Error updating job experiences");
  }
});

router.get("/tags/:tag", async (req, res) => {
  try {
    const tag = req.params.tag;
    const tagId = await jobQueries.getTagId(tag);
    if (!tagId) {
      res.status(404).send("Tag not found");
    }
    const jobs = await jobQueries.getJobsByTag(tagId);
    res.render("tag.ejs", { tag, jobs, user: req.user });
  } catch (err) {
    console.error("Error fetching job postings:", err);
    res.status(500).send("Error fetching job postings");
  }
});
router.get("/getTopTags", cacheMiddleware(3600), async (req, res) => {
  try {
    const tags = await jobQueries.getCountOfTopJobTags();
    res.json(tags);
  } catch (err) {
    console.error("Error fetching tags:", err);
    res.status(500).send("Error fetching tags");
  }
});

router.get("/getRecentJobs", cacheMiddleware(3600), async (req, res) => {
  try {
    const jobCount = await jobQueries.getRecentJobCount();
    res.json(jobCount);
  } catch (err) {
    console.error("Error fetching recent jobs:", err);
    res.json(0);
  }
});

router.get("/delete/:id", checkAuthenticated, async (req, res) => {
  try {
    const jobId = req.params.id;
    // delete the job and tags and skills associated with it
    await jobQueries.deleteJob(jobId);
    res.redirect("/jobs");
  } catch (err) {
    console.error("Error deleting job:", err);
    res.status(500).send("Error deleting job");
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;

    res.render("job-posting.ejs", { job_id: id, user: req.user });
  } catch (err) {
    console.error("Error fetching job postings:", err);
    res.status(500).send("Error fetching job postings");
  }
});

module.exports = router;
