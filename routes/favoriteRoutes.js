const express = require("express");
const router = express.Router();
const favoritesQueries = require("../queries/favoritesQueries");
const { checkAuthenticated } = require("../middleware/authMiddleware");

router.get("/", checkAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const favorites = await favoritesQueries.getFavorites(userId);

    res.render("favorites.ejs", {
      favorites,
      user: req.user,
    });
  } catch (err) {
    console.error("Error getting favorites:", err);
    res.status(500).send("Error getting favorites");
  }
});

router.post("/:postId", checkAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.postId;
    await favoritesQueries.addToFavorites(userId, postId);
    res.json({
      success: true,
      message: "Post successfully added to favorites.",
    });
  } catch (err) {
    console.error("Error adding to favorites:", err);
    res
      .status(500)
      .json({ success: false, message: "Error adding to favorites" });
  }
});

router.delete("/:postId", checkAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.postId;
    await favoritesQueries.removeFromFavorites(userId, postId);
    res.redirect("/favorites");
  } catch (err) {
    console.error("Error removing from favorites:", err);
    res
      .status(500)
      .json({ success: false, message: "Error removing from favorites" });
  }
});

router.get("/:postId", checkAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.postId;
    const favorites = await favoritesQueries.getFavorites(userId);
    const isFavorited = favorites.some((favorite) => favorite.id === postId);
    res.json({ isFavorited });
  } catch (err) {
    console.error("Error checking if post is favorited:", err);
    res.status(500).json({ message: "Error checking if post is favorited" });
  }
});

module.exports = router;
