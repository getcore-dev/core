// middleware/turnstile.js
let fetch;
(async () => {
  fetch = (await import('node-fetch')).default;
})();

async function verifyTurnstileToken(req, res, next) {
  const token = req.body['cf-turnstile-response'];
  
  if (!token) {
    req.flash('error', 'Please complete the Turnstile challenge');
    return res.redirect('/register');
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', process.env.TURNSTILE_SECRET_KEY);
    formData.append('response', token);
    formData.append('remoteip', req.ip);

    const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    const result = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    const outcome = await result.json();

    if (outcome.success) {
      next();
    } else {
      console.error('Turnstile validation failed:', outcome);
      req.flash('error', 'Turnstile validation failed. Please try again.');
      return res.redirect('/register');
    }
  } catch (error) {
    console.error('Error verifying Turnstile:', error);
    req.flash('error', 'An error occurred during verification. Please try again.');
    return res.redirect('/register');
  }
}

module.exports = verifyTurnstileToken;