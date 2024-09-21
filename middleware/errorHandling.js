function errorHandler(error, req, res, next) {
  res.locals.currentPath = req.path || '/';
  res.locals.error = req.flash('error');
  res.locals.success = req.flash('success');
  res.locals.user = req.user || null;
  console.error(error);
  const errorCode = error.status || 500;
  const errorMessage = error.message || 'Internal Server Error';

  res
    .status(errorCode)
    .render('error.ejs', {
      user: req.user,
      error: { message: errorMessage, status: errorCode },
    });
}

module.exports = errorHandler;
