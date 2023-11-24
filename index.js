const express = require("express");
const path = require("path");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const lusca = require("lusca");
const fs = require("fs");
const appConfig = require("./config/appConfig");
const userRoutes = require("./routes/userRoutes");
const sessionMiddleware = require("./middleware/session");

const app = express();
const port = appConfig.port;

// Read the navbar.html file
const navbar = fs.readFileSync(
  path.join(__dirname, "public", "navbar.html"),
  "utf8"
);

// Apply rate limiting as an early middleware to all requests
app.use(rateLimit(appConfig.rateLimitSettings));

// Apply compression to all responses
app.use(compression());

// Parse URL-encoded bodies and JSON bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session middleware
app.use(sessionMiddleware);

// Static file middleware with cache control
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: appConfig.staticFilesMaxAge,
  })
);

// Use lusca CSRF protection middleware
app.use(lusca.csrf());

// User specific routes
app.use("/user", userRoutes);

// Catch all route for serving front-end application
app.get("*", (req, res) => {
  // Read the content of the specific page
  const pagePath = path.join(
    __dirname,
    "public",
    req.path === "/" ? "core.html" : req.path
  );
  if (fs.existsSync(pagePath) && path.extname(pagePath) === ".html") {
    const content = fs.readFileSync(pagePath, "utf8");

    // Replace a placeholder in your HTML file with the navbar content
    const pageWithNavbar = content.replace(
      "<!-- Navbar Placeholder -->",
      navbar
    );
    res.send(pageWithNavbar);
  } else {
    // If the file doesn't exist or isn't an HTML file, send the default file
    res.sendFile(path.join(__dirname, "public", "core.html"));
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
