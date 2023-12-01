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

    // Step 1: Replace direct query with User model method
    const user = await User.findByUsername(username);

    // Step 2: Check if the user was found
    if (!user) {
      return res.status(401).send("Incorrect username or password");
    }

    // Step 3: Compare the provided password with the stored password hash
    const isMatch = await bcrypt.compare(password, user.password_hash);

    // Step 4: Check if the password is correct
    if (!isMatch) {
      return res.status(401).send("Incorrect username or password");
    }

    // Step 5: Store user information in the session
    req.session.userId = user.user_id;
    req.session.username = user.username;
    console.log(
      `User #${req.session.userId} ${req.session.username} has logged in`
    );

    console.log(`Session ID: ${req.session.id}`);

    // Step 6: Save the session and redirect as needed
    req.session.save((err) => {
      if (err) {
        return res.status(500).send("Error while saving session information");
      }
      console.log(req.session.id);
      return res.redirect("/");
    });
  } catch (error) {
    // Step 7: Handle any unexpected errors
    console.error("Error in login route:", error);
    res.status(500).send("Internal Server Error");
  }
};

exports.register = async (req, res) => {
  try {
    const { username, email, password, zipcode } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    // Step 1: Replace direct query with User.create method
    const newUser = await User.create({
      username,
      email,
      password_hash: hashedPassword,
      zip_code: zipcode,
    });

    // Step 2: Store the new user's ID and username in the session
    req.session.userId = newUser.user_id;
    req.session.username = username;

    // Step 3: Redirect to the home page or dashboard as needed
    res.redirect("/");
  } catch (error) {
    // Step 4: Handle specific error cases
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).send("Username or email already exists");
    }

    // Step 5: Handle any unexpected errors
    console.error("Error in register route:", error);
    res.status(500).send("Internal Server Error");
  }
};
