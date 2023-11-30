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
    const query =
      "SELECT user_id, username, password_hash FROM users WHERE username = ?";

    db.query(query, [username], async (error, results) => {
      if (error) {
        return res.status(500).send("Internal server error");
      }

      const user = results[0];
      if (!user) {
        return res.status(401).send("Incorrect username or password");
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).send("Incorrect username or password");
      }

      req.session.userId = user.user_id;
      req.session.username = user.username;
      console.log(
        `user #${req.session.userId} ${req.session.username} has logged in`
      );

      console.log(`Session ID: ${req.session.id}`); // Redirect to the home page or dashboard as needed

      req.session.save((err) => {
        if (err) {
          return res.send("err while saving session information");
        }
        console.log(req.session.id);
        return res.redirect("/");
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
};

exports.register = async (req, res) => {
  try {
    const { username, email, password, zipcode } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const insertQuery =
      "INSERT INTO users (username, email, password_hash, zip_code) VALUES (?, ?, ?, ?)";

    db.query(
      insertQuery,
      [username, email, hashedPassword, zipcode],
      (error, results) => {
        if (error) {
          if (error.code === "ER_DUP_ENTRY") {
            return res.status(400).send("Username or email already exists");
          }
          console.error(error);
          return res.status(500).send("Internal server error");
        }

        const newUserId = results.insertId;
        req.session.userId = newUserId;
        req.session.username = username;
        // Redirect to the home page or dashboard as needed
        res.redirect("/"); // Redirecting also sends a 200 OK by default
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
};
