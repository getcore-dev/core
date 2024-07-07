const express = require('express');
const router = express.Router();
const sql = require('mssql');
const crypto = require('crypto');
const { checkAuthenticated } = require('../middleware/authMiddleware');
const commentQueries = require('../queries/commentQueries');
const utilFunctions = require('../utils/utilFunctions');
const postQueries = require('../queries/postQueries');

// Route to add a comment to a post
router.post('/posts/:postId/comments', checkAuthenticated, async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = req.user.id; // Assuming the user ID is stored in req.user
    const { comment } = req.body;

    await commentQueries.addComment(postId, userId, comment);

    res.redirect(`/posts/${postId}`);
  } catch (err) {
    console.error('Database insert error:', err);
    res.status(500).send('Error adding comment');
  }
});

router.post(
  '/comment/:commentId/toggle-pin',
  checkAuthenticated,
  async (req, res) => {
    try {
      const commentId = req.params.commentId;
      const userId = req.user.id; // Assuming the user ID is stored in req.user

      const comment = await commentQueries.getCommentById(commentId);
      const post = await postQueries.getPostById(comment.post_id);

      if (post.user_id !== userId) {
        return res
          .status(403)
          .send('You are not authorized to pin/unpin this comment');
      }

      await commentQueries.togglePinComment(commentId);
      res.redirect('back');
    } catch (err) {
      console.error('Database error:', err);
      res.status(500).send('Error processing pin');
    }
  }
);

router.post(
  '/react/posts/:postId/comment/:commentId',
  checkAuthenticated,
  async (req, res) => {
    try {
      const postId = req.params.postId;
      const commentId = req.params.commentId;
      const user = req.user;
      const action = req.body.action.toUpperCase(); // Convert action to uppercase for consistency

      const userId = user ? user.id : null;

      const validActions = ['LOVE', 'LIKE', 'CURIOUS', 'DISLIKE'];

      if (!validActions.includes(action)) {
        res.status(400).send('Invalid action');
        return;
      }

      if (!userId) {
        res.status(401).send('You must be logged in to react to a comment');
        return;
      }

      const interactionResult = await commentQueries.interactWithComment(
        postId,
        commentId,
        userId,
        action
      );

      res.json({
        message: `Comment ${action.toLowerCase()}ed successfully`,
        ...interactionResult,
      });
    } catch (err) {
      console.error('Database error:', err);
      res.status(500).send('Error processing reaction');
    }
  }
);
router.post(
  '/posts/:postId/comment/:commentId/react',
  checkAuthenticated,
  async (req, res) => {
    try {
      const postId = req.params.postId;
      const commentId = req.params.commentId;
      const userId = req.user.id;
      const action = req.body.action.toUpperCase(); // Convert action to uppercase for consistency

      // Valid reactions
      const validActions = ['LOVE', 'LIKE', 'CURIOUS', 'DISLIKE'];

      if (!validActions.includes(action)) {
        res.status(400).send('Invalid action');
        return;
      }

      const newScore = await commentQueries.interactWithComment(
        postId,
        commentId,
        userId,
        action
      );

      if (newScore === 0) {
        res.json({ message: 'Action unchanged', newScore });
      } else {
        res.json({
          message: `Comment ${action.toLowerCase()}ed successfully`,
          newScore,
        });
      }
    } catch (err) {
      console.error('Database error:', err);
      res.status(500).send('Error processing reaction');
    }
  }
);

// Route to delete a comment
router.delete('/comment/:commentId', checkAuthenticated, async (req, res) => {
  const commentId = req.params.commentId;
  const userId = req.user.id; // Assuming the user ID is stored in req.user

  try {
    const comment = await commentQueries.getCommentById(commentId);
    if (comment.user_id !== userId) {
      return res
        .status(403)
        .send('You are not authorized to delete this comment');
    }

    await commentQueries.deleteCommentById(commentId);
    res.redirect('back');
  } catch (error) {
    console.error('Database delete error:', error);
    res.status(500).send('Error deleting comment');
  }
});

module.exports = router;
