const User = require('../models/User');
const bcrypt = require('bcrypt');
const passport = require('passport');

exports.login = (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return next(err); // will generate a 500 error
    }
    if (!user) {
      return res.redirect('/login?error=' + info.message); // Redirect with an error message
    }
    req.login(user, loginErr => {
      if (loginErr) {
        return next(loginErr);
      }
      return res.redirect('/dashboard'); // Redirect to the dashboard after successful login
    });
  })(req, res, next);
};

exports.register = async (req, res) => {
  try {
    const { username, email, password, zip_code } = req.body;

    const password_hash = await bcrypt.hash(password, 10);

    const newUser = new User(null, username, email, password_hash, zip_code);
    newUser.save(err => {
      if (err) {
        // Handle error, like duplicate username
        return res.status(500).send('Error registering new user.');
      }

      // Automatically log in the user after registration
      req.login(newUser, err => {
        if (err) {
          return res.status(500).send('Error logging in new user.');
        }
        return res.redirect('/communities'); // Redirect to the user's dashboard
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
};
