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
    // Extract user details from request body
    const { username, email, password } = req.body;

    // Input validation (basic example, consider using a library like Joi for more robust validation)
    if (!username || !email || !password) {
      return res.status(400).send('All fields are required');
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).send('User already exists with this email');
    }

    // Create the user (consider hashing the password before saving)
    const newUser = await User.create({ username, email, password });

    // successful registration
    res.status(201).send('User successfully registered');
  } catch (error) {
    console.error('Registration Error:', error);

    // Specific error handling
    if (error.name === 'SequelizeValidationError') {
      // Handle Sequelize validation errors (e.g., not null constraints, data types)
      return res.status(400).send('Validation error: ' + error.message);
    } else if (error.name === 'SequelizeUniqueConstraintError') {
      // Handle unique constraint errors (e.g., duplicate username or email)
      return res.status(409).send('Duplicate entry: ' + error.message);
    } else if (error.name === 'SequelizeDatabaseError') {
      // Handle general database errors (e.g., incorrect table names, syntax errors)
      return res.status(500).send('Database error: ' + error.message);
    }

    // For other types of errors, return a generic server error
    res.status(500).send('Internal Server Error');
  }
};

exports.getUserByUsername = async (req, res) => {
  try {
    const { username } = req.params;

    if (!username) {
      return res.status(400).send("Username is required");
    }

    const user = await User.findOne({
      where: { username },
      attributes: ["username", "email", "zip_code"],
    });

    if (!user) {
      return res.status(404).send("User not found");
    }

    res.render("user_profile", {
      user,
      pagePath: "user",
    });
  } catch (error) {
    console.error("Error in getUserByUsername:", error);

    if (error.name === 'SequelizeValidationError') {
      return res.status(400).send('Validation error: ' + error.message);
    } else if (error.name === 'SequelizeDatabaseError') {
      return res.status(500).send('Database error: ' + error.message);
    }

    res.status(500).send("Internal Server Error");
  }
};
