const express = require("express");
const router = express.Router();
const sql = require("mssql");
const crypto = require("crypto");
const { checkAuthenticated } = require("../middleware/authMiddleware");
const commentQueries = require("../queries/commentQueries");
const utilFunctions = require("../utils/utilFunctions");

// Route to add a comment to a post
router.post("/posts/:postId/comments", checkAuthenticated, async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = req.user.id; // Assuming the user ID is stored in req.user
    const { comment } = req.body;

    await commentQueries.addComment(postId, userId, comment);

    res.redirect(`/posts/${postId}`);
  } catch (err) {
    console.error("Database insert error:", err);
    res.status(500).send("Error adding comment");
  }
});

// Route to reply to a comment
router.post(
  "/comments/:commentId/replies",
  checkAuthenticated,
  async (req, res) => {
    try {
      const parentCommentId = req.params.commentId;
      const userId = req.user.id; // Assuming the user ID is stored in req.user
      const { comment } = req.body;

      const replyId = `${Date.now().toString(36)}-${crypto
        .randomBytes(3)
        .toString("hex")}`;
      await sql.query`INSERT INTO comments (id, post_id, parent_comment_id, user_id, comment) VALUES (${replyId}, (SELECT post_id FROM comments WHERE id = ${parentCommentId}), ${parentCommentId}, ${userId}, ${comment})`;

      res.redirect("back");
    } catch (err) {
      console.error("Database insert error:", err);
      res.status(500).send("Error adding reply");
    }
  }
);

// Route to delete a comment
router.delete("/comment/:commentId", checkAuthenticated, async (req, res) => {
  const commentId = req.params.commentId;
  const userId = req.user.id; // Assuming the user ID is stored in req.user

  try {
    const comment = await commentQueries.getCommentById(commentId);
    if (comment.user_id !== userId) {
      return res
        .status(403)
        .send("You are not authorized to delete this comment");
    }

    await commentQueries.deleteCommentById(commentId);
    res.redirect("back");
  } catch (error) {
    console.error("Database delete error:", error);
    res.status(500).send("Error deleting comment");
  }
});

module.exports = router;
