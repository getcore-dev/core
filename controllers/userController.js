const User = require("../models/user"); // Update the path to the actual location of your User model
const bcrypt = require("bcrypt");
const express = require("express");
const router = express.Router();

exports.checkSession = (req, res) => {
  if (req.session && req.session.userId) {
    // Directly use the username from the session
    res.send({ username: req.session.username });
  } else {
    res.send({ username: null });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find the user by username using Sequelize
    const user = await User.findOne({ where: { username } });

    if (!user) {
      return res.status(401).send("Incorrect username or password");
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).send("Incorrect username or password");
    }

    req.session.userId = user.user_id; // Store the user's ID in the session
    req.session.username = user.username; // Store the username as well
    res.redirect("/core.html");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
};


exports.register = async (req, res) => {
  try {
    const { username, email, password, zipcode } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the user using Sequelize
    const newUser = await User.create({
      username,
      email,
      password_hash: hashedPassword,
      zip_code: zipcode,
    });

    // Set the session userId and username with the new user's ID and username
    req.session.userId = newUser.user_id; // Store the new user's ID in the session
    req.session.username = newUser.username; // Store the new username as well

    // Redirect to the home page or dashboard as needed
    res.redirect("/"); // Redirecting also sends a 200 OK by default
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).send("Username or email already exists");
    }
    console.error(error);
    res.status(500).send("Internal server error");
  }
};
