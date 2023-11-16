const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

// /user/##### for these routes

router.post("/login", userController.login);
router.post("/register", userController.register);
router.get("/check-session", userController.checkSession);

module.exports = router;
