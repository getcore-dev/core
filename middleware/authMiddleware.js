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

module.exports = { checkAuthenticated, checkNotAuthenticated };
