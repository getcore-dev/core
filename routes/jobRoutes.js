const express = require("express");
const router = express.Router();
const jobQueries = require("../queries/jobQueries");
const {
  checkAuthenticated,
  checkNotAuthenticated,
} = require("../middleware/authMiddleware");

router.get("/create", checkAuthenticated, async (req, res) => {
  try {
    const skills = await jobQueries.getSkills();
    res.render("create-job.ejs", { skills, user: req.user });
  } catch (err) {
    console.error("Error fetching job postings:", err);
    res.status(500).send("Error fetching job postings");
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;

    res.render("job-posting.ejs", { job_id: id });
  } catch (err) {
    console.error("Error fetching job postings:", err);
    res.status(500).send("Error fetching job postings");
  }
});

module.exports = router;
