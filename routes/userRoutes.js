const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

// /user/##### for these routes

router.post("/login", userController.login);
router.post("/register", userController.register);
router.get("/check-session", userController.checkSession);

// TODO!!!!
//router.get("/logout", userController.logout);
//router.get("/users/:username", userController.getUser);
//router.get("/users/:username/posts", userController.getUserPosts);
//router.get("/users/:username/comments", userController.getUserComments);
//router.get("/users/:username/communities", userController.getUserCommunities);
//router.get("/users/:username/badges", userController.getUserBadges);
//router.get("/users/:username/achievements", userController.getUserAchievements);

module.exports = router;
