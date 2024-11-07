const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { checkNotAuthenticated, checkAuthenticated } = require('../middleware/authMiddleware');

// Rate limiters for different auth operations
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts, please try again later'
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3 // 3 attempts
});

// Secure token generation
function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Constant-time token comparison
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Password reset request with rate limiting
router.post('/reset-password', passwordResetLimiter, async (req, res) => {
  const { email } = req.body;
  
  try {
    const result = await sql.query`SELECT * FROM users WHERE email = ${email}`;
    const user = result.recordset[0];

    if (!user) {
      // Use same response time even when user doesn't exist
      await new Promise(resolve => setTimeout(resolve, 1000));
      req.flash('success', 'If an account exists, you will receive an email');
      return res.redirect('/forgot-password');
    }

    const resetToken = generateSecureToken();
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

    // Invalidate any existing tokens first
    await sql.query`
      UPDATE users 
      SET reset_password_token = ${resetToken},
          reset_password_expires = ${resetTokenExpires},
          reset_password_attempts = 0
      WHERE id = ${user.id}`;

    const resetUrl = `https://${req.headers.host}/reset-password/${resetToken}`;
    // Send email with resetUrl...
    
  } catch (error) {
    await notificationQueries.createAdminNotification(
      'PASSWORD_RESET_REQUEST_ERROR',
      null,
      null,
      new Date(),
      error
    );
    req.flash('error', 'An error occurred. Please try again later.');
    res.redirect('/forgot-password');
  }
});

// Login with rate limiting
router.post('/login', loginLimiter, checkNotAuthenticated, async (req, res, next) => {
  passport.authenticate('local', async (err, user, info) => {
    if (err) {
      console.error('Authentication error:', err);
      return next(err);
    }

    // Track failed attempts by IP
    if (!user) {
      const ip = req.ip;
      const attempts = failedAttempts.get(ip) || 0;
      failedAttempts.set(ip, attempts + 1);
      
      // Clear failed attempts after 1 hour
      setTimeout(() => {
        failedAttempts.delete(ip);
      }, 60 * 60 * 1000);

      req.flash('error', info.message);
      return res.redirect('/login');
    }

    // Successful login - clear failed attempts
    failedAttempts.delete(req.ip);

    req.logIn(user, async (err) => {
      if (err) return next(err);
      
      // Update last login with IP address for audit
      await userQueries.updateLastLogin(user.id, req.ip);
      
      // Regenerate session to prevent session fixation
      req.session.regenerate((err) => {
        if (err) return next(err);
        const redirectUrl = req.session.returnTo || '/';
        delete req.session.returnTo;
        res.redirect(redirectUrl);
      });
    });
  })(req, res, next);
});

// Email verification with expiration
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  
  try {
    // Add expiration check
    const result = await sql.query`
      SELECT * FROM users 
      WHERE verification_token = ${token}
      AND verification_expires > ${new Date()}`;
      
    const user = result.recordset[0];
    
    if (!user) {
      return res.status(400).send('Invalid or expired token.');
    }

    await sql.query`
      UPDATE users 
      SET verified_account = 1,
          verification_token = NULL,
          verification_expires = NULL 
      WHERE id = ${user.id}`;

    req.flash('success', 'Email verified successfully. You can now log in.');
    res.redirect('/login');
  } catch (error) {
    await notificationQueries.createAdminNotification(
      'EMAIL_VERIFICATION_ERROR',
      null,
      null,
      new Date(),
      error
    );
    res.status(500).send('An error occurred. Please try again later.');
  }
});

module.exports = router;