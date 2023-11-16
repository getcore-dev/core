const express = require("express");
const path = require("path");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const app = express();
const port = process.env.PORT || 8080; // Use the environment's port if provided.
const pool = require("./db");
const { get } = require("http");

// Middleware to parse JSON bodies of requests with Content-Type: application/json
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// session for the app to use to keep track of the user
app.use(
  session({
    secret: "secret",
    store: new MySQLStore({
      host: "127.0.0.1",
      user: "dev",
      password: "##",
      database: "core",
    }),
    resave: false,
    saveUninitialized: false,
    cookie: { secure: app.get("env") === "production" },
  })
);

app.get("/check-session", (req, res) => {
  if (req.session && req.session.userId) {
    const username = getUsernameFromSession(req.session.userId);
    res.send({ username });
  } else {
    res.send({ username: null });
  }
});

// login route for when user logs in
app.post("/login", async (req, res) => {
  //console.log(req.body);
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
});

app.post("/register", async (req, res) => {
  //console.log(req.body);
  try {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const timeStamp = currentTimestampInSQL();

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
});

app.use(express.static(path.join(__dirname, "public")));

// If you want to use a router for additional paths, you can include them here.
// For example, app.use('/api', apiRoutes);

// Catch-all for any request that doesn't match one above to send back `index.html`.
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "core.html"));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
