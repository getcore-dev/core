if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
const express = require("express");
const app = express();
const bcrypt = require("bcrypt");
const passport = require("passport");
const flash = require("express-flash");
const session = require("express-session");
const methodOverride = require("method-override");
const sql = require("mssql");
const port = process.env.PORT || 8080;

// Database configuration
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  server: process.env.DB_SERVER,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

const findByUsername = async (username) => {
  try {
    await sql.connect(dbConfig);
    const result =
      await sql.query`SELECT * FROM users WHERE username = ${username}`;
    return result.recordset[0];
  } catch (err) {
    console.error("Database query error:", err);
  }
};

const findById = async (id) => {
  try {
    await sql.connect(dbConfig);
    const result = await sql.query`SELECT * FROM users WHERE id = ${id}`;
    return result.recordset[0];
  } catch (err) {
    console.error("Database query error:", err);
  }
};

const initializePassport = require("./config/passport-config").initialize;
initializePassport(passport, findByUsername, findById, findByUsername);

app.set("view-engine", "ejs");
app.use(express.urlencoded({ extended: false }));
app.use(flash());
app.use(express.static("public"));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride("_method"));

function checkAuthenticated(req, res, next) {
  try {
    if (req.isAuthenticated()) {
      return next();
    }
    res.redirect("/login");
  } catch (error) {
    next(error);
  }
}

function checkNotAuthenticated(req, res, next) {
  try {
    if (req.isAuthenticated()) {
      return res.redirect("/");
    }
    next();
  } catch (error) {
    next(error);
  }
}

app.get("/", checkAuthenticated, (req, res) => {
  res.render("communities.ejs", { user: req.user });
});

app.get("/jobs", checkAuthenticated, (req, res) => {
  res.render("jobs.ejs", { user: req.user });
});

app.get("/login", checkNotAuthenticated, async (req, res) => {
  res.render("login.ejs", { user: req.user });
});

app.get("/register", checkNotAuthenticated, async (req, res) => {
  res.render("register.ejs", { user: req.user });
});

app.get("/learning", checkAuthenticated, async (req, res) => {
  res.render("learning.ejs", { user: req.user });
});

app.post(
  "/login",
  checkNotAuthenticated,
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: true,
  })
);

app.get("/profile/:username", async (req, res) => {
  try {
    const username = req.params.username;
    const user = await findByUsername(username);

    if (user) {
      res.render("user_profile.ejs", { user });
    } else {
      res.render("404.ejs", { user });
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/register", checkNotAuthenticated, async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    await sql.connect(dbConfig);
    await sql.query`INSERT INTO users (id, username, email, password, zipcode) VALUES (${Date.now().toString()}, ${
      req.body.username
    }, ${req.body.email}, ${hashedPassword}, ${req.body.zipcode})`;

    res.redirect("/login");
  } catch (error) {
    console.error("Database insert error:", error);
    res.redirect("/register");
  }
});

app.delete("/logout", (req, res, next) => {
  req.logOut(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/login");
  });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.render("404.ejs", { user: req.user });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
