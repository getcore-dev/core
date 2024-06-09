const express = require("express");
const router = express.Router();
const passport = require("passport");
const bcrypt = require("bcrypt");
const sql = require("mssql");
const {
  checkAuthenticated,
  checkNotAuthenticated,
} = require("../middleware/authMiddleware");
const { body, validationResult } = require("express-validator");
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");
const userQueries = require("../queries/userQueries");

// Set up nodemailer transporter
const transporter = nodemailer.createTransport({
  host: "smtp.mail.me.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.ICLOUD_EMAIL,
    pass: process.env.ICLOUD_EMAIL_PASS,
  },
});

// GitHub authentication route
router.get("/auth/github", passport.authenticate("github"));

router.get(
  "/auth/github/callback",
  passport.authenticate("github", { failureRedirect: "/login" }),
  (req, res) => {
    const redirectUrl = req.session.returnTo || "/";
    delete req.session.returnTo;
    res.redirect(redirectUrl);
  }
);

// Register route
router.get("/register", checkNotAuthenticated, async (req, res) => {
  res.render("register.ejs", { user: req.user });
});

// Password reset request route
router.post("/reset-password", async (req, res) => {
  const { email } = req.body;

  try {
    const result = await sql.query`SELECT * FROM users WHERE email = ${email}`;
    const user = result.recordset[0];

    if (!user) {
      req.flash("error", "No account with that email address exists.");
      return res.redirect("/forgot-password");
    }

    const resetToken = uuidv4();
    const resetTokenExpires = new Date(Date.now() + 3600000); // Token expires in 1 hour

    await sql.query`UPDATE users SET reset_password_token = ${resetToken}, reset_password_expires = ${resetTokenExpires} WHERE id = ${user.id}`;

    // Send reset email
    const resetUrl = `http://${req.headers.host}/reset-password/${resetToken}`;
    const mailOptions = {
      from: '"CORE Support" <support@c-ore.dev>',
      to: user.email,
      subject: "Password Reset",
      html: `<p>You requested a password reset. Click the link below to reset your password:</p><a href="${resetUrl}">Reset Password</a>`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return console.log(error);
      }
      console.log("Password reset email sent: " + info.response);
    });

    req.flash("success", "An email has been sent with further instructions.");
    res.redirect("/forgot-password");
  } catch (error) {
    console.error("Error requesting password reset:", error);
    req.flash("error", "An error occurred. Please try again later.");
    res.redirect("/forgot-password");
  }
});

// Password reset form route
router.get("/reset-password/:token", async (req, res) => {
  const { token } = req.params;

  try {
    const result =
      await sql.query`SELECT * FROM users WHERE reset_password_token = ${token} AND reset_password_expires > ${new Date()}`;
    const user = result.recordset[0];

    if (!user) {
      req.flash("error", "Password reset token is invalid or has expired.");
      return res.redirect("/forgot-password");
    }

    res.render("reset-password.ejs", {
      token,
      errorMessages: req.flash("error"),
    });
  } catch (error) {
    console.error("Error displaying password reset form:", error);
    req.flash("error", "An error occurred. Please try again later.");
    res.redirect("/forgot-password");
  }
});

router.get("/forgot-password", (req, res) => {
  res.render("forgot-password.ejs", {
    errorMessages: req.flash("error"),
    successMessages: req.flash("success"),
  });
});

// Handle reset form submission
router.get("/reset-password/:token", async (req, res) => {
  const { token } = req.params;

  try {
    const result =
      await sql.query`SELECT * FROM users WHERE reset_password_token = ${token} AND reset_password_expires > ${new Date()}`;
    const user = result.recordset[0];

    if (!user) {
      req.flash("error", "Password reset token is invalid or has expired.");
      return res.redirect("/forgot-password");
    }

    res.render("reset-password.ejs", {
      token,
      errorMessages: req.flash("error"),
    });
  } catch (error) {
    console.error("Error displaying password reset form:", error);
    req.flash("error", "An error occurred. Please try again later.");
    res.redirect("/forgot-password");
  }
});

router.get("/recruiter", checkNotAuthenticated, async (req, res) => {
  res.render("recruiter-register.ejs", { user: req.user });
});

router.post(
  "/register",
  checkNotAuthenticated,
  [
    body("username")
      .trim()
      .isLength({ min: 5 })
      .withMessage("Username must be at least 5 characters long"),
    body("email")
      .trim()
      .isEmail()
      .normalizeEmail()
      .withMessage("Invalid email address"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
    body("firstname").trim().escape(),
    body("lastname").trim().escape(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).render("error.ejs", { errors: errors.array() });
      }

      const userId = uuidv4();
      const hashedPassword = await bcrypt.hash(req.body.password, 10);
      const verificationToken = uuidv4();

      await sql.query`INSERT INTO users (
        id,
        username,
        email,
        password,
        zipcode,
        firstname,
        lastname,
        created_at,
        avatar,
        isAdmin,
        points,
        bio,
        verified,
        verification_token
      ) VALUES (
        ${userId},
        ${req.body.username},
        ${req.body.email},
        ${hashedPassword},
        '11111',
        ${req.body.firstname},
        ${req.body.lastname},
        ${new Date()},
        '/img/default-avatar.png',
        0,
        0,
        '',
        0,
        ${verificationToken}
      )`;

      // Send verification email
      const verificationUrl = `http://${req.headers.host}/verify-email?token=${verificationToken}`;
      const mailOptions = {
        from: '"CORE Support" <support@c-ore.dev>',
        to: req.body.email,
        subject: "Email Verification",
        html: `<p>Thank you for registering. Please click the link below to verify your email:</p><a href="${verificationUrl}">Verify Email</a>`,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          return console.log(error);
        }
        console.log("Verification email sent: " + info.response);
      });

      res.redirect("/login");
    } catch (error) {
      next(error);
      res.redirect("/register");
    }
  }
);

// Verify email route
router.get("/verify-email", async (req, res) => {
  const token = req.query.token;
  try {
    const result =
      await sql.query`SELECT * FROM users WHERE verification_token = ${token}`;
    const user = result.recordset[0];
    if (!user) {
      return res.status(400).send("Invalid token.");
    }

    await sql.query`UPDATE users SET verifiedAccount = 1, verification_token = NULL WHERE id = ${user.id}`;
    res.send("Email verified successfully. You can now log in.");
  } catch (error) {
    res.status(500).send("An error occurred. Please try again later.");
  }
});

// Login route
router.get("/login", checkNotAuthenticated, async (req, res) => {
  res.render("login.ejs", {
    user: req.user,
    githubClientId: process.env.GITHUB_CLIENT_ID,
    errorMessages: req.flash("error"), // Pass error messages to the view
  });
});

router.post("/login", checkNotAuthenticated, async (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      console.error("Authentication error:", err);
      return next(err);
    }
    if (!user) {
      console.error("Authentication failed:", info.message);
      req.flash("error", info.message);
      return res.redirect("/login");
    }
    if (!user.verified) {
      // Assuming 'verified' is the correct field name in your user model
      console.error("User email not verified");
      req.flash("error", "Please verify your email before logging in.");
      return res.redirect("/login");
    }
    req.logIn(user, (err) => {
      if (err) {
        console.error("Login error:", err);
        return next(err);
      }
      userQueries.updateLastLogin(user.id); // Ensure userQueries.updateLastLogin is defined
      const redirectUrl = req.session.returnTo || "/";
      delete req.session.returnTo;
      return res.redirect(redirectUrl);
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
