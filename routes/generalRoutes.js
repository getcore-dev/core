const express = require("express");
const router = express.Router();
const sql = require("mssql");
const {
  checkAuthenticated,
  checkNotAuthenticated,
} = require("../middleware/authMiddleware");
const viewController = require("../controllers/viewController");
const userQueries = require("../queries/userQueries");
const utilFunctions = require("../utils/utilFunctions");

// Home page
router.get("/", viewController.renderHomePage);

router.get("/edits", checkAuthenticated, async (req, res) => {
  const userId = req.user.id;
  const missingFields = await utilFunctions.checkMissingFields(userId);
  res.render("edits.ejs", { user: req.user, missingFields });
});

router.post("/edits", checkAuthenticated, async (req, res) => {
  const userId = req.user.id;
  const updates = req.body;

  // Exclude the userId from updates to avoid updating it
  delete updates.id;
  console.log(userId, updates);
  try {
    for (let field in updates) {
      if (updates.hasOwnProperty(field)) {
        console.log(`Updating ${field} to ${updates[field]}`);
        await userQueries.updateField(userId, field, updates[field]);
      }
    }

    res.redirect("/"); // Redirect to home or a confirmation page
  } catch (err) {
    console.error("Error updating user fields:", err.message);
    res.status(500).send("Internal Server Error");
  }
});

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
