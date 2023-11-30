const User = require("../models/user"); // Update the path to the actual location of your User model
const bcrypt = require("bcrypt");

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

    // Replace direct query with User model method
    const user = await User.findByUsername(username);
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
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
};

exports.register = async (req, res) => {
  try {
    const { username, email, password, zipcode } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    // Replace direct query with User.create method
    const newUser = await User.create({
      username,
      email,
      password_hash: hashedPassword,
      zip_code: zipcode,
    });

    const newUserId = results.insertId;
    req.session.userId = newUserId;
    req.session.username = username;
    // Redirect to the home page or dashboard as needed
    res.redirect("/"); // Redirecting also sends a 200 OK by default
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).send("Username or email already exists");
    }
    console.error(error);
    res.status(500).send("Internal server error");
  }
};
