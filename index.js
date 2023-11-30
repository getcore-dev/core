const express = require("express");
const session = require("express-session");
const path = require("path");
const app = express();
//const fetch = require("node-fetch");
const port = process.env.PORT || 8080;
//const GITHUB_API_URL = "https://api.github.com/repos/brycemcole/CORE/commits"; // Replace with your repo details

app.set("view engine", "ejs");
app.set("trust proxy", 1); // Trust first proxy for session security

// Moved the static files to be served before the session to speed up loading static content
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "default_secret_key", // Use environment variable for secrets
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
      sameSite: "lax",
    },
  })
);

app.use((req, res, next) => {
  res.locals.username = req.session.username || null;
  next();
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routes modularization
app.use("/user", require("./routes/userRoutes"));
app.use("/learning", require("./routes/learningRoutes"));
app.use("/api", require("./routes/apiRoutes"));

// Homepage route
/*
app.get("/github-updates", async (req, res) => {
  try {
    const response = await fetch(GITHUB_API_URL);
    const data = await response.json();
    res.json(data); // Send the data to the frontend
  } catch (error) {
    res.status(500).json({ error: "Error fetching data from GitHub" });
  }
});
*/

app.get("/", (req, res) => {
  res.render("communities", {
    pagePath: "communities",
    username: req.session.username,
  });
});

// Generic static page route helper
app.get("/:page", (req, res, next) => {
  try {
    const { page } = req.params;
    res.render(page, {
      username: req.session.username,
      pagePath: page,
    });
  } catch (error) {
    next(error); // Pass errors to the error handler
  }
});

// API endpoint to check session and return username
app.get("/api/session", (req, res) => {
  const isLoggedIn = !!req.session.userId;
  res.json({ isLoggedIn, username: req.session.username || null });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
