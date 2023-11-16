const pool = require("../config/database");
const bcrypt = require("bcrypt");

exports.checkSession = (req, res) => {
  if (req.session && req.session.userId) {
    const username = getUsernameFromSession(req.session.userId);
    res.send({ username });
  } else {
    res.send({ username: null });
  }
};

exports.login = async (req, res) => {
  console.log(req.body);
  try {
    const { username, password } = req.body;
    const query = "SELECT * FROM users WHERE username = ?";

    pool.query(query, [username], async (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Internal server error");
      }

      if (results.length === 0) {
        return res.status(401).send("Incorrect username or password");
      }

      const user = results[0];

      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return res.status(401).send("Incorrect username or password");
      }

      // what to do if user logs in successfully
      req.session.userId = user.userId;
      res.redirect("/core.html");
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
};

exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const query =
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";

    pool.query(query, [username, email, hashedPassword], (err, results) => {
      if (err) {
        // handle if username or email already exists
        console.error(err);
        return res.status(500).send("Username or email already exists");
      }

      return res.status(200).send("Successfully registered");
      // what to do if user logs in successfully
      //res.redirect("/login");
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
};
