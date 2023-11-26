const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();
const port = 8080;
const session = require("express-session");

// Read the navbar HTML content once when the server starts
const navbarHtml = fs.readFileSync(
  path.join(__dirname, "public", "navbar.html"),
  "utf8"
);

app.set("view engine", "ejs");

app.use(
  session({
    secret: "xSLjAGWG3Q4pVVnrdQRrMzXgWsSfkOR7",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: !isDevelopment() },
  })
);

function isDevelopment() {
  return process.env.NODE_ENV === "development";
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/user", require("./routes/userRoutes"));

// Middleware to add username to locals for template rendering
app.use((req, res, next) => {
  res.locals.username = req.session.username || null;
  next();
});

// Middleware to intercept HTML file requests and insert navbar with username
app.use((req, res, next) => {
  if (path.extname(req.path).toLowerCase() === ".html") {
    const pagePath = path.join(__dirname, "public", req.path);

    if (fs.existsSync(pagePath)) {
      fs.readFile(pagePath, "utf8", (err, data) => {
        if (err) {
          console.error(err);
          return res.status(500).send("Server error");
        }

        // Replace placeholder with actual navbar HTML
        let pageWithNavbar = data.replace(
          "<!-- Navbar Placeholder -->",
          navbarHtml
        );

        // Insert username into the navbar HTML if user is logged in
        if (req.session.username) {
          pageWithNavbar = pageWithNavbar.replace(
            /user<\/a>/g,
            `${req.session.username}</a>`
          );
        }

        res.send(pageWithNavbar);
      });
    } else {
      next(); // If the file doesn't exist, continue to the next handler (possibly a 404 handler)
    }
  } else {
    next();
  }
});

// API endpoint to check session and return username
app.get("/api/session", (req, res) => {
  if (req.session.userId) {
    res.json({ isLoggedIn: true, username: req.session.username });
  } else {
    res.json({ isLoggedIn: false, username: null });
  }
});

// Static file serving for other file types (CSS, JS, images, etc.)
app.get("/", (req, res) => {
  res.render("core", {
    navbarHtml: navbarHtml,
    username: req.session.username,
  });
});

app.get("/openings", (req, res) => {
  res.render("jobs", {
    navbarHtml: navbarHtml,
    username: req.session.username,
  });
});

app.get("/community", (req, res) => {
  res.render("communities", {
    navbarHtml: navbarHtml,
    username: req.session.username,
  });
});

app.get("/login", (req, res) => {
  res.render("login", {
    navbarHtml: navbarHtml,
    username: req.session.username,
  });
});

app.get("/register", (req, res) => {
  res.render("register", {
    navbarHtml: navbarHtml,
    username: req.session.username,
  });
});

app.use(express.static(path.join(__dirname, "public")));

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
