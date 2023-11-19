const express = require("express");
const path = require("path");
const app = express();
const port = process.env.PORT || 8080;
const postRoutes = require("./routes/postRoutes);
const userRoutes = require("./routes/userRoutes");
const sessionMiddleware = require("./middleware/session");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(sessionMiddleware);

// if user then redirect to userRoutes file for redirects
app.use("/user", userRoutes); // Use the user routes

app.use("/post", postRoutes);

app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "core.html"));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
