const express = require("express");
const router = express.Router();
const userQueries = require("../queries/userQueries");
const multer = require("multer");
const { checkAuthenticated } = require("../middleware/authMiddleware");
const storage = multer.diskStorage({
  destination: "./public/uploads/",
  filename: function (req, file, cb) {
    cb(null, "profile-" + Date.now() + ".jpg");
  },
});
const upload = multer({ storage });

router.get("/getUsername/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const user = await userQueries.findById(id);
    if (user) {
      res.json(user.username);
    } else {
      res.status(404).send("User not found");
    }
  } catch (err) {
    res.status(500).send("Server error");
  }
});

router.post(
  "/upload-profile-picture",
  checkAuthenticated,
  upload.single("file"),
  async (req, res) => {
    try {
      if (req.file.size > 1000000) {
        return res.status(400).send("File size too large");
      }
      const userId = req.user.userId;
      const filePath = req.file.path;
      await userQueries.updateProfilePicture(userId, filePath);
      res.redirect("back");
    } catch (err) {
      console.error(err);
      res.status(500).send("Server error");
    }
  }
);

module.exports = router;
