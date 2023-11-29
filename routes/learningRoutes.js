const express = require("express");
const router = express.Router();

router.get("/learning/arrays", (req, res) => {
  const arrayExample = ["Element 1", "Element 2", "Element 3", "Element 4"];
  res.render("learning-arrays", {
    username: req.session.username,
    arrayExample: arrayExample,
  });
});

module.exports = router;
