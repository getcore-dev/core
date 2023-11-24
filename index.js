const express = require("express");
const path = require("path");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

const appConfig = require("./config/appConfig"); // Separate file for configurations
const userRoutes = require("./routes/userRoutes");
const sessionMiddleware = require("./middleware/session");
const { isValidPath } = require("./utils/pathValidator"); // Utility for path validation

const app = express();
const port = appConfig.port; // Use value from config file

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
