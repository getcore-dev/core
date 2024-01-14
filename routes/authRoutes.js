const express = require("express");
const router = express.Router();
const passport = require("passport");
const bcrypt = require("bcrypt");
const sql = require("mssql");
const userQueries = require("../queries/userQueries");
const {
  checkAuthenticated,
  checkNotAuthenticated,
} = require("../middleware/authMiddleware");

// Register route
router.get("/register", checkNotAuthenticated, async (req, res) => {
  res.render("register.ejs", { user: req.user });
});

router.get("/recruiter", checkNotAuthenticated, async (req, res) => {
  res.render("recruiter-register.ejs", { user: req.user });
});

router.post("/register", checkNotAuthenticated, async (req, res) => {
  try {
    // Validate and sanitize input data here

    // Generate a unique user ID
    const userId = uuidv4();

    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    await sql.query`INSERT INTO users (id, username, email, password, zipcode, firstname, lastname) VALUES (
      ${userId},
      ${req.body.username},
      ${req.body.email},
      ${hashedPassword},
      ${req.body.zipcode},
      ${req.body.firstname},
      ${req.body.lastname})`;

    // Optionally add a flash message for successful registration
    res.redirect("/login");
  } catch (error) {
    next(error);
    res.redirect("/register");
  }
});

// Login route
router.get("/login", checkNotAuthenticated, async (req, res) => {
  res.render("login.ejs", { user: req.user });
});

router.post("/login", checkNotAuthenticated, (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      req.flash("error", info.message);
      return res.redirect("/login");
    }
    req.logIn(user, (err) => {
      if (err) return next(err);
      return res.redirect("/");
    });
  })(req, res, next);
});

// Logout route
router.delete("/logout", (req, res, next) => {
  req.logOut(function (err) {
    if (err) return next(err);
    res.redirect("/");
  });
});

module.exports = router;
