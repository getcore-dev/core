function errorHandler(error, req, res, next) {
  console.error(error);
  const errorCode = error.status || 500;
  const errorMessage = error.message || "Internal Server Error";

  res
    .status(errorCode)
    .render("error.ejs", {
      user: req.user,
      error: { message: errorMessage, status: errorCode },
    });
}

module.exports = errorHandler;
