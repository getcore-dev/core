const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const User = require("../models/user");
const passport = require('passport');

// /user/##### for these routes
router.use(express.static("public"));

router.get("/:username", async (req, res) => {
  try {
    const { username } = req.params;

    // Find the user by username using Sequelize
    const user = await User.findOne({
      where: { username },
      attributes: ["username", "email", "zip_code"], // Specify the attributes you want to retrieve
    });

    if (!user) {
      return res.status(404).send("User not found");
    }

    // Send back the user details. Be careful not to send back sensitive information like password hashes
    res.render("user_profile", {
      user,
      pagePath: "user", // Pass the current path to the template
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
});

router.post('/register', userController.register);

router.post('/login', passport.authenticate('local', {
  successRedirect: '/dashboard',
  failureRedirect: '/login',
  failureFlash: false // set to true if using connect-flash for flash messages
}));
// Route to get a user's profile by username

// TODO!!!!
//router.get("/logout", userController.logout);
//router.get("/users/:username", userController.getUser);
//router.get("/users/:username/posts", userController.getUserPosts);
//router.get("/users/:username/comments", userController.getUserComments);
//router.get("/users/:username/communities", userController.getUserCommunities);
//router.get("/users/:username/badges", userController.getUserBadges);
//router.get("/users/:username/achievements", userController.getUserAchievements);

module.exports = router;
