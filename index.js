const express = require("express");
const session = require("express-session");
const winston = require('winston'); // logger
const app = express();
const port = process.env.PORT || 8080;

app.set("view engine", "ejs");
app.set("trust proxy", 1); // Trust first proxy for session security

// Configure Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'express-module' },
  transports: [
    new winston.transports.Console() // log errors and info to console
  ],
});

// Moved the static files to be served before the session to speed up loading static content
app.use(express.static(path.join(__dirname, "public")));

app.use(
    session({
      secret: process.env.SESSION_SECRET || "default_secret_key",
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

app.get("/", (req, res) => {
  res.render("communities", {
    pagePath: "communities",
    username: req.session.username,
  });
});

// Generic static page route helper
app.get("/:page", (req, res) => {
  try {
    const { page } = req.params;
    res.render(page, {
      username: req.session.username,
      pagePath: page,
    });
  } catch (error) {
    logger.error(error); // Log errors to the winston logger
  }
});

// API endpoint to check session and return username
app.get("/api/session", (req, res) => {
  const isLoggedIn = !!req.session.userId;
  res.json({ isLoggedIn, username: req.session.username || null });
});

app.use((err, req, res) => {
  logger.error(err.stack); // Log error stacks using the winston logger
  res.status(500).send("Something broke!");
});

app.listen(port, () => {
  logger.info(`Server running on http://localhost:${port}`); // Log server initialization using the winston logger
});