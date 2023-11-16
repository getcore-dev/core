const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const sessionConfig = require("../config/sessionConfig");

module.exports = session({
  secret: sessionConfig.secret,
  store: new MySQLStore(sessionConfig.options),
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === "production" },
});
