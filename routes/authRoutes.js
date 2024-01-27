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
const { body, validationResult } = require("express-validator");
const { v4: uuidv4 } = require("uuid");

// Register route
router.get("/register", checkNotAuthenticated, async (req, res) => {
  res.render("register.ejs", { user: req.user });
});

router.get("/recruiter", checkNotAuthenticated, async (req, res) => {
  res.render("recruiter-register.ejs", { user: req.user });
});

router.post(
  "/register",
  checkNotAuthenticated,
  // Validation and sanitation rules
  [
    body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters long'),
    body('email').trim().isEmail().normalizeEmail().withMessage('Invalid email address'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('zipcode').trim().isPostalCode('any').withMessage('Invalid zip code'),
    body('firstname').trim().escape(),
    body('lastname').trim().escape()
  ],
  async (req, res, next) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        // Handle the errors appropriately
        // e.g., return or render the page with error messages
        return res.status(400).render('register', { errors: errors.array() });
      }

      // Continue with your existing code for user registration
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

      res.redirect("/login");
    } catch (error) {
      next(error);
      res.redirect("/register");
    }
  }
);

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
