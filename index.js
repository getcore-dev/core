const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();
const port = 8080;
const session = require("express-session");

app.set("view engine", "ejs");

function isDevelopment() {
  return process.env.NODE_ENV === "development";
}

app.use(
  session({
    secret: "xSLjAGWG3Q4pVVnrdQRrMzXgWsSfkOR7",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: !isDevelopment(),
      maxAge: 1000 * 60 * 60 * 24, // 24 hours for example
      httpOnly: true, // Mitigate XSS risks by preventing client-side script from accessing the cookie
      sameSite: "lax", // Can be 'strict', 'lax', or 'none'
    },
  })
);
app.use((req, res, next) => {
  res.locals.username = req.session.username || null;
  next();
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
//app.use("/user", require("./routes/userRoutes"));

// API endpoint to check session and return username
app.get("/api/session", (req, res) => {
  if (req.session.userId) {
    res.json({ isLoggedIn: true, username: req.session.username });
  } else {
    res.json({ isLoggedIn: false, username: null });
  }
});

app.get("/learning/arrays", (req, res) => {
  const arrayExample = ["Element 1", "Element 2", "Element 3", "Element 4"];
  res.render("learning-arrays", {
    username: req.session.username,
    arrayExample: arrayExample,
  });
});

// Static file serving for other file types (CSS, JS, images, etc.)
app.get("/", (req, res) => {
  console.log(req.session.id);
  res.render("communities", {
    pagePath: "communities", // Assuming you want to use this in your navbar for highlighting the current page or similar
  });
});

app.get("/openings/1", (req, res) => {
  console.log(req.session.id);
  res.render("job1", {
    pagePath: "openings/1", // Assuming you want to use this in your navbar for highlighting the current page or similar
  });
});

app.get("/about", (req, res) => {
  res.render("about", {
    username: req.session.username,
  });
});

app.get("/practice", (req, res) => {
  res.render("practice", {
    username: req.session.username,
  });
});

app.get("/learning", (req, res) => {
  res.render("learning", {
    username: req.session.username,
  });
});

app.get("/support", (req, res) => {
  res.render("support", {
    username: req.session.username,
  });
});

app.get("/openings", (req, res) => {
  res.render("jobs", {
    username: req.session.username,
  });
});

app.get("/community", (req, res) => {
  res.render("communities", {
    username: req.session.username,
  });
});

app.get("/login", (req, res) => {
  res.render("login", {
    username: req.session.username,
  });
});

app.get("/register", (req, res) => {
  res.render("register", {
    username: req.session.username,
  });
});

app.use(express.static(path.join(__dirname, "public")));

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
