if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
const users = [];
const express = require("express");
const app = express();
const bcrypt = require("bcrypt");
const passport = require("passport");
const flash = require("express-flash");
const session = require("express-session");
const methodOverride = require("method-override");
const findByUsername =
  require("./config/passport-config").getFindByUsernameFunction;

const initializePassport = require("./config/passport-config").initialize;
initializePassport(
  passport,
  (email) => users.find((user) => user.email === email),
  (id) => users.find((user) => user.id === id),
  (username) => users.find((user) => user.username === username)
);

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
  const username = req.params.username;

  const user = findByUsername(username);
  if (user) {
    res.render("user_profile.ejs", { user });
  } else {
    res.render("404.ejs", { user });
  }
});

app.post("/register", checkNotAuthenticated, async (req, res) => {
  try {
    if (users.length >= 200) {
      // Option 1: Send a response indicating user limit reached
      res.status(400).send("User limit reached. Cannot register more users.");
      return;

      // Option 2: Remove the oldest user before adding a new one
      // users.shift(); // Uncomment this line to enable this behavior
    }

    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    users.push({
      id: Date.now().toString(),
      username: req.body.username,
      email: req.body.email,
      password: hashedPassword,
      zipcode: req.body.zipcode,
    });
    res.redirect("/login");
  } catch {
    res.redirect("/register");
  }
  console.log(users);
});

app.delete("/logout", async (req, res) => {
  req.logOut(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/login");
  });
});

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect("/");
  }
  next();
}

app.listen(8080);
