const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const passport = require("passport");

router.use(express.static("public"));

// TODO: Implement the following routes in your userController
//router.get("/logout", userController.logout);
//router.get("/users/:username/posts", userController.getUserPosts);
// ... other routes ...

// Middleware for handling requests to undefined routes in /user
router.use((req, res, next) => {
  res.status(404).send("Sorry, that route does not exist");
});

module.exports = router;
