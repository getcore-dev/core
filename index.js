const express = require("express");
const path = require("path");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const lusca = require("lusca"); // Import lusca middleware
const fs = require("fs");
const appConfig = require("./config/appConfig");
const userRoutes = require("./routes/userRoutes");
const sessionMiddleware = require("./middleware/session");
const { isValidPath } = require("./utils/pathValidator");
const navbar = fs.readFileSync(
  path.join(__dirname, "/public", "navbar.html"),
  "utf8"
);
const app = express();
const port = appConfig.port;

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
app.use(lusca.csrf()); // Add this line to enable CSRF protection

// User specific routes
app.use("/user", userRoutes);

// Catch all route for serving front-end application
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "core.html"));
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
