function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  // Save the original URL they were requesting:
  req.session.returnTo = req.originalUrl;
  return res.redirect("/login");
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
