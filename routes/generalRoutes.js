const express = require("express");
const router = express.Router();
const sql = require("mssql");
const {
  checkAuthenticated,
  checkNotAuthenticated,
} = require("../middleware/authMiddleware");
const viewController = require("../controllers/viewController");

// Home page
router.get("/", viewController.renderHomePage);

// 404 page
router.get("/404", (req, res) => {
  const error = {
    status: 404,
    message: "Page not found",
  };
  res.render("error.ejs", { user: req.user, error });
});

router.get("/profile/:username", viewController.renderUserProfile);

// Jobs page
router.get("/jobs", (req, res) => {
  res.render("jobs.ejs", { user: req.user });
});

// Learning page
router.get("/learning", checkAuthenticated, (req, res) => {
  res.render("learning.ejs", { user: req.user });
});

// Post creation page
router.get("/post/create", checkAuthenticated, (req, res) => {
  res.render("create-post.ejs", { user: req.user });
});

// Individual post page
router.get("/post", async (req, res) => {
  res.render("post.ejs", { user: req.user });
});

// Error handling middleware
router.use((error, req, res, next) => {
  console.error(error);
  res
    .status(error.status || 500)
    .render("error.ejs", { user: req.user, error: error.message });
});

module.exports = router;
