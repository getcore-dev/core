const User = require("../models/user.js");
const bcrypt = require("bcrypt");

exports.register = (req, res) => {
  const { username, email, password, country, zipcode } = req.body;
  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      return res.status(500).json({ error: err });
    }
    const newUser = new User(
      null,
      username,
      email,
      hashedPassword,
      country,
      zipcode
    );
    newUser.save((err, result) => {
      if (err) {
        res.status(500).json({ message: "User had an error registering" });
      }
      res.status(201).json({ message: "User registered successfully" });
    });
  });
};

exports.login = (req, res) => {
  const { username, password } = req.body;
  User.findByUsername(username, (err, user) => {
    if (err) {
      return res.status(500).json({ error: err });
    }
    if (!user) {
      return res.status(401).json({ message: "Invalid username or password" });
    }
    bcrypt.compare(password, user.password, (err, result) => {
      if (err) {
        return res.status(500).json({ error: err });
      }
      if (result) {
        // Passwords match, authenticate user
        // You might want to generate a JWT here
        res.status(200).json({ message: "Authentication successful" });
      } else {
        // Passwords don't match
        res.status(401).json({ message: "Invalid username or password" });
      }
    });
  });
};
