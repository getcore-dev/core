const express = require("express");
const router = express.Router();
const userQueries = require("../queries/userQueries");

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

router.post("/upload-profile-picture", async (req, res) => {
  try {
    const { userId, imageUrl } = req.body;
    await userQueries.addProfilePicture(userId, imageUrl);
    res.json({ message: "Profile picture updated" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Other API routes can be added here as needed.

module.exports = router;
