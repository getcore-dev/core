const express = require("express");
const path = require("path");
const MySQLStore = require("express-mysql-session")(session);
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const app = express();
const port = process.env.PORT || 8080; // Use the environment's port if provided.

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
});

app.use(
  session({
    secret: "secret",
    store: new MySQLStore({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: "session_test",
    }),
    resave: false,
    saveUninitialized: false,
    cookie: { secure: true },
  })
);

app.use(express.urlencoded({ extended: true }));

app.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const query =
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";
    connection.execute(
      query[(username, email, hashedPassword)],
      (err, results) => {
        if (err) {
          console.error(err);
          return res.status(500).send("Error registering new user");
        }
        // what to do if user logs in successfully
        res.redirect("/login");
      }
    );
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
