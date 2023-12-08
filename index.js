const express = require("express");
const session = require("express-session");
const path = require("path");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcrypt");
const User = require("./models/user");
const app = express();
const port = process.env.PORT || 8080;

app.set("view engine", "ejs");
app.set("trust proxy", 1);

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "default_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
      sameSite: "lax",
    },
  })
);

// Passport setup
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await User.findByUsername(username);
      if (!user) {
        return done(null, false, { message: "Incorrect username." });
      }

      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return done(null, false, { message: "Incorrect password." });
      }

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id, (err, user) => {
    done(err, user);
  });
});

// Middleware to make username available to templates
app.use((req, res, next) => {
  res.locals.username = req.session.passport?.user || null;
  next();
});

// Body parser middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routes
app.use("/user", require("./routes/userRoutes"));
app.use("/learning", require("./routes/learningRoutes"));
app.use("/api", require("./routes/apiRoutes"));

// Homepage route
app.get("/", (req, res) => {
  res.render("communities", {
    pagePath: "communities",
    username: req.session.passport?.user,
  });
});

app.get("/post", (req, res) => {
  res.render("post", {
    pagePath: "communities/post/1 ",
    username: req.session.passport?.user,
  });
});

// Generic static page route helper
app.get("/:page", (req, res, next) => {
  try {
    const { page } = req.params;
    res.render(page, {
      username: req.session.passport?.user,
      pagePath: page,
    });
  } catch (error) {
    next(error);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

// Server start
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
