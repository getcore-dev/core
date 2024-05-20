const express = require("express");
const router = express.Router();
const favoritesQueries = require("../queries/favoritesQueries");
const { checkAuthenticated } = require("../middleware/authMiddleware");

router.get("/", checkAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    res.render("favorites.ejs", {
      user: req.user,
    });
  } catch (err) {
    console.error("Error getting favorites:", err);
    res.status(500).send("Error getting favorites");
  }
});

router.get("/posts", checkAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const favorites = await favoritesQueries.getFavoritePosts(userId);
    res.json({ favorites });
  } catch (err) {
    console.error("Error getting favorite posts:", err);
    res.status(500).json({ message: "Error getting favorite posts" });
  }
});

router.get("/all", checkAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const posts = await favoritesQueries.getFavoritePosts(userId);
    const jobs = await favoritesQueries.getFavoriteJobs(userId);
    const comments = await favoritesQueries.getFavoriteComments(userId);

    const favorites = {
      posts,
      jobs,
      comments,
    };
    res.json({ favorites });
  } catch (err) {
    console.error("Error getting favorite posts:", err);
    res.status(500).json({ message: "Error getting favorite posts" });
  }
});

router.get("/posts", checkAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const favorites = await favoritesQueries.getFavoritePosts(userId);
    res.json({ favorites });
  } catch (err) {
    console.error("Error getting favorite posts:", err);
    res.status(500).json({ message: "Error getting favorite posts" });
  }
});

router.get("/jobs", checkAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const favorites = await favoritesQueries.getFavoriteJobs(userId);
    res.json({ favorites });
  } catch (err) {
    console.error("Error getting favorite jobs:", err);
    res.status(500).json({ message: "Error getting favorite jobs" });
  }
});

router.get("/comments", checkAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const favorites = await favoritesQueries.getFavoriteComments(userId);
    res.json({ favorites });
  } catch (err) {
    console.error("Error getting favorite comments:", err);
    res.status(500).json({ message: "Error getting favorite comments" });
  }
});

router.post("/post/:postId", checkAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.postId;
    const post = await favoritesQueries.getFavoritePostByPostIdAndUserId(
      postId,
      userId
    );

    if (post) {
      await favoritesQueries.removeFromFavorites(userId, postId);
      res.json({
        success: true,
        message: "Post successfully removed from favorites.",
      });
    } else {
      await favoritesQueries.addToFavorites(userId, postId);
      res.json({
        success: true,
        message: "Post successfully added to favorites.",
      });
    }
  } catch (err) {
    console.error("Error adding to favorites:", err);
    res
      .status(500)
      .json({ success: false, message: "Error adding to favorites" });
  }
});

router.post(
  "/comment/:postId/:commentId",
  checkAuthenticated,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const postId = req.params.postId;
      const commentId = req.params.commentId;

      await favoritesQueries.addCommentToFavorites(userId, postId, commentId);
      res.redirect(`/posts/${postId}#${req.params.commentId}`);
    } catch (err) {
      console.error("Error adding to favorites:", err);
      res.status(500).send("Error adding to favorites");
    }
  }
);

router.post("/jobs/:jobId", checkAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const jobId = req.params.jobId;
    const job = await favoritesQueries.getFavoriteJobByJobIdAndUserId(
      jobId,
      userId
    );

    if (job) {
      await favoritesQueries.removeJobFromFavorites(userId, jobId);
      return res.json({
        success: true,
        message: "Job successfully removed from favorites.",
      });
    } else {
      await favoritesQueries.addJobToFavorites(userId, jobId);
      return res.json({
        success: true,
        message: "Job successfully added to favorites.",
      });
    }
  } catch (err) {
    console.error("Error adding job to favorites:", err);
    res
      .status(500)
      .json({ success: false, message: "Error adding job to favorites" });
  }
});

router.delete("/post/:postId", checkAuthenticated, async (req, res) => {
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
