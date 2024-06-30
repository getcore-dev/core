function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }

  // Save the original URL they were requesting:
  req.session.returnTo = req.originalUrl;

  // Check if this is an API request or a regular browser request
  if (req.xhr || req.headers.accept.indexOf("json") > -1) {
    // For API requests, send a JSON response
    return res.status(401).json({
      success: false,
      message: "You must be logged in to perform this action",
      redirect: "/login",
    });
  } else {
    // For regular browser requests, redirect to login page
    return res.redirect("/login");
  }
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect("/");
  }
  next();
}

function checkAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.isAdmin) {
    return next();
  }
  req.session.returnTo = req.originalUrl; // Optionally save the URL they were trying to access
  res
    .status(403)
    .send("Access Denied: You do not have permission to view this page.");
}

module.exports = { checkAuthenticated, checkNotAuthenticated, checkAdmin };
