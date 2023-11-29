const express = require("express");
const router = express.Router();

router.get("/session", (req, res) => {
  if (req.session.userId) {
    res.json({ isLoggedIn: true, username: req.session.username });
  } else {
    res.json({ isLoggedIn: false, username: null });
  }
});

module.exports = router;
