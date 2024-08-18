const express = require('express');
const router = express.Router();
const passport = require('passport');
const bcrypt = require('bcrypt');
const sql = require('mssql');
const {
  checkAuthenticated,
  checkNotAuthenticated,
} = require('../middleware/authMiddleware');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const userQueries = require('../queries/userQueries');
const notificationQueries = require('../queries/notificationQueries');

// Set up nodemailer transporter
const transporter = nodemailer.createTransport({
  host: 'smtp.mail.me.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.ICLOUD_EMAIL,
    pass: process.env.ICLOUD_EMAIL_PASS,
  },
});

// GitHub authentication route
router.get('/auth/github', passport.authenticate('github'));

router.get(
  '/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  (req, res) => {
    const redirectUrl = req.session.returnTo || '/';
    delete req.session.returnTo;
    res.redirect(redirectUrl);
  }
);

// Register route

// Password reset request route
router.post('/reset-password', async (req, res) => {
  const { email } = req.body;

  try {
    const result = await sql.query`SELECT * FROM users WHERE email = ${email}`;
    const user = result.recordset[0];

    if (!user) {
      req.flash('error', 'No account with that email address exists.');
      return res.redirect('/forgot-password');
    }

    const resetToken = uuidv4();
    const resetTokenExpires = new Date(Date.now() + 3600000); // Token expires in 1 hour

    await sql.query`UPDATE users SET reset_password_token = ${resetToken}, reset_password_expires = ${resetTokenExpires} WHERE id = ${user.id}`;

    // Send reset email
    const resetUrl = `http://${req.headers.host}/reset-password/${resetToken}`;
    const mailOptions = {
      from: '"CORE Support" <support@getcore.dev>',
      to: user.email,
      subject: 'Password Reset',
      html: `<p>You requested a password reset. Click the link below to reset your password:</p><a href="${resetUrl}">Reset Password</a>`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return console.log(error);
      }
      console.log('Password reset email sent: ' + info.response);
    });

    req.flash('success', 'An email has been sent with further instructions.');
    res.redirect('/forgot-password');
  } catch (error) {
    console.error('Error requesting password reset:', error);
    req.flash('error', 'An error occurred. Please try again later.');
    res.redirect('/forgot-password');
  }
});

// Password reset form route
router.get('/reset-password/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const result =
      await sql.query`SELECT * FROM users WHERE reset_password_token = ${token} AND reset_password_expires > ${new Date()}`;
    const user = result.recordset[0];

    if (!user) {
      req.flash('error', 'Password reset token is invalid or has expired.');
      return res.redirect('/forgot-password');
    }

    res.render('reset-password.ejs', {
      token,
      errorMessages: req.flash('error'),
    });
  } catch (error) {
    console.error('Error displaying password reset form:', error);
    req.flash('error', 'An error occurred. Please try again later.');
    res.redirect('/forgot-password');
  }
});

router.post('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    req.flash('error', 'Passwords do not match.');
    return res.redirect(`/reset-password/${token}`);
  }

  try {
    const result =
      await sql.query`SELECT * FROM users WHERE reset_password_token = ${token} AND reset_password_expires > ${new Date()}`;
    const user = result.recordset[0];

    if (!user) {
      req.flash('error', 'Password reset token is invalid or has expired.');
      return res.redirect('/forgot-password');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await sql.query`UPDATE users SET password = ${hashedPassword}, reset_password_token = NULL, reset_password_expires = NULL WHERE id = ${user.id}`;

    req.flash('success', 'Password reset successful. You can now log in.');
    res.redirect('/login');
  } catch (error) {
    console.error('Error resetting password:', error);
    req.flash('error', 'An error occurred. Please try again later.');
    await notificationQueries.createAdminNotification(
      'PASSWORD_RESET_ERROR',
      null,
      req.user.id || null,
      new Date(),
      error);
    res.redirect(`/reset-password/${token}`);
  }
});

router.get('/forgot-password', (req, res) => {
  res.render('forgot-password.ejs', {
    errorMessages: req.flash('error'),
    successMessages: req.flash('success'),
  });
});

// Handle reset form submission
router.get('/reset-password/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const result =
      await sql.query`SELECT * FROM users WHERE reset_password_token = ${token} AND reset_password_expires > ${new Date()}`;
    const user = result.recordset[0];

    if (!user) {
      req.flash('error', 'Password reset token is invalid or has expired.');
      return res.redirect('/forgot-password');
    }

    res.render('reset-password.ejs', {
      token,
      errorMessages: req.flash('error'),
    });
  } catch (error) {
    console.error('Error displaying password reset form:', error);
    req.flash('error', 'An error occurred. Please try again later.');
    res.redirect('/forgot-password');
  }
});

router.get('/recruiter', checkNotAuthenticated, async (req, res) => {
  res.render('recruiter-register.ejs', { user: req.user });
});

router.get('/register', checkNotAuthenticated, async (req, res) => {
  res.render('register.ejs', { user: req.user, errorMessages: req.flash('error'), successMessages: req.flash('success') });
});

router.post(
  '/register',
  checkNotAuthenticated,
  [
    body('username')
      .trim()
      .isLength({ min: 5 })
      .withMessage('Username must be at least 5 characters long'),
    body('email')
      .trim()
      .isEmail()
      .normalizeEmail()
      .isLength({ max: 255 })
      .withMessage('Invalid email address')
      .custom(async (value) => {
        const result = await sql.query`SELECT * FROM users WHERE email = ${value}`;
        if (result.recordset.length > 0) {
          return Promise.reject('Email address is already in use');
        }
      }),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
    body('firstname').trim().escape(),
    body('lastname').trim().escape(),
  ],
  async (req, res, next) => {
    try {
      console.log('Registering user:', req.body);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).render('register.ejs', {
          errorMessages: errors.array().map((error) => error.msg),
          successMessages: req.flash('success'),
          user: req.user,
        });
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
        bio,
        verified,
        verification_token
      ) VALUES (
        ${userId},
        ${req.body.username.toLowerCase()},
        ${req.body.email},
        ${hashedPassword},
        '11111',
        ${req.body.firstname},
        ${req.body.lastname},
        ${new Date()},
        '/img/default-avatar.png',
        0,
        '',
        0,
        ${verificationToken}
      )`;

      const verificationUrl = `http://${req.headers.host}/verify-email?token=${verificationToken}`;
      const mailOptions = {
        from: '"CORE Support" <support@getcore.dev>',
        to: req.body.email,
        subject: 'Email Verification',
        html: `<p>Thank you for registering. Please click the link below to verify your email:</p><a href="${verificationUrl}">Verify Email</a>`,
      };

      process.nextTick(() => {
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.log('Error sending verification email:', error);
          } else {
            console.log('Verification email sent: ' + info.response);
          }
        });
      });

      req.flash(
        'success',
        'Registration successful! A verification email has been sent. Please check your inbox.'
      );
      await notificationQueries.createAdminNotification(
        'NEW_USER',
        null,
        userId,
        new Date()
      );
      res.redirect('/login');
    } catch (error) {
      console.error('Registration error:', error);
      req.flash(
        'error',
        'An error occurred during registration. Please try again later.'
      );
      res.status(500).render('register.ejs', { errorMessages: req.flash('error'), successMessages: req.flash('success'), user: req.user});
    }
  }
);

router.get('/verify-email', async (req, res) => {
  const token = req.query.token;
  try {
    const result =
      await sql.query`SELECT * FROM users WHERE verification_token = ${token}`;
    const user = result.recordset[0];
    if (!user) {
      return res.status(400).send('Invalid token.');
    }

    await sql.query`UPDATE users SET verifiedAccount = 1, verification_token = NULL WHERE id = ${user.id}`;
    res.send('Email verified successfully. You can now log in.');
  } catch (error) {
    res.status(500).send('An error occurred. Please try again later.');
  }
});

router.get('/login', checkNotAuthenticated, (req, res) => {
  res.render('login.ejs', {
    user: req.user,
    githubClientId: process.env.GITHUB_CLIENT_ID,
    errorMessages: req.flash('error'),
    successMessages: req.flash('success'),
  });
});

router.post('/login', checkNotAuthenticated, async (req, res, next) => {
  passport.authenticate('local', async (err, user, info) => {
    if (err) {
      console.error('Authentication error:', err);
      return next(err);
    }
    if (!user) {
      console.error('Authentication failed:', info.message);
      req.flash('error', info.message);
      return res.redirect('/login');
    }
    if (!user.verifiedAccount) {
      console.error('User email not verified');

      const verificationToken = uuidv4();

      try {
        await sql.query`
          UPDATE users 
          SET verification_token = ${verificationToken} 
          WHERE id = ${user.id}`;

        const verificationUrl = `http://${req.headers.host}/verify-email?token=${verificationToken}`;
        const mailOptions = {
          from: '"CORE Support" <support@getcore.dev>',
          to: user.email,
          subject: 'Email Verification',
          html: `<p>Your account has not been verified. Please click the link below to verify your email:</p><a href="${verificationUrl}">Verify Email</a>`,
        };

        // Send the email in the background
        process.nextTick(() => {
          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              notificationQueries.createAdminNotification(
                'EMAIL_VERIFICATION_ERROR',
                null,
                user.id,
                new Date(),
                error
              );
              console.log('Error sending verification email:', error);
              req.flash(
                'error',
                'Error sending verification email. Please try again later.'
              );
            } else {
              console.log('Verification email sent: ' + info.response);
              req.flash(
                'success',
                'A new verification email has been sent. Please check your inbox.'
              );
            }
          });
        });

        req.flash(
          'success',
          'A new verification email has been sent. Please check your inbox.'
        );
        return res.redirect('/login');
      } catch (updateError) {
        console.error('Error updating verification token:', updateError);
        req.flash('error', 'An error occurred. Please try again later.');
        return res.redirect('/login');
      }
    } else {
      req.logIn(user, async (err) => {
        if (err) {
          console.error('Login error:', err);
          await notificationQueries.createAdminNotification(
            'LOGIN_ERROR',
            null,
            user.id,
            new Date(),
            err
          );
          return next(err);
        }

        userQueries.updateLastLogin(user.id);
        const redirectUrl = req.session.returnTo || '/';
        delete req.session.returnTo;
        return res.redirect(redirectUrl);
      });
    }
  })(req, res, next);
});

// Logout route
router.delete('/logout', (req, res, next) => {
  req.logOut(function (err) {
    if (err) return next(err);
    res.redirect('/');
  });
});

module.exports = router;
