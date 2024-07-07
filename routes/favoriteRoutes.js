const express = require('express');
const router = express.Router();
const favoritesQueries = require('../queries/favoritesQueries');
const { checkAuthenticated } = require('../middleware/authMiddleware');
const postQueries = require('../queries/postQueries');

router.get('/', checkAuthenticated, async (req, res) => {
  try {
    res.render('favorites.ejs', {
      user: req.user,
    });
  } catch (err) {
    console.error('Error getting favorites:', err);
    res.status(500).send('Error getting favorites');
  }
});

router.get('/posts', checkAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const favorites = await favoritesQueries.getFavoritePosts(userId);
    res.json({ favorites });
  } catch (err) {
    console.error('Error getting favorite posts:', err);
    res.status(500).json({ message: 'Error getting favorite posts' });
  }
});

router.get('/all', checkAuthenticated, async (req, res) => {
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
    console.error('Error getting favorite posts:', err);
    res.status(500).json({ message: 'Error getting favorite posts' });
  }
});

router.get('/posts', checkAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const favorites = await favoritesQueries.getFavoritePosts(userId);
    res.json({ favorites });
  } catch (err) {
    console.error('Error getting favorite posts:', err);
    res.status(500).json({ message: 'Error getting favorite posts' });
  }
});

router.get('/jobs', checkAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const favorites = await favoritesQueries.getFavoriteJobs(userId);
    res.json({ favorites });
  } catch (err) {
    console.error('Error getting favorite jobs:', err);
    res.status(500).json({ message: 'Error getting favorite jobs' });
  }
});

router.get('/comments', checkAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const favorites = await favoritesQueries.getFavoriteComments(userId);
    res.json({ favorites });
  } catch (err) {
    console.error('Error getting favorite comments:', err);
    res.status(500).json({ message: 'Error getting favorite comments' });
  }
});

router.post('/post/:postId', checkAuthenticated, async (req, res) => {
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
        message: 'Post successfully removed from favorites.',
      });
    } else {
      await favoritesQueries.addToFavorites(userId, postId);
      res.json({
        success: true,
        message: 'Post successfully added to favorites.',
      });
    }
  } catch (err) {
    console.error('Error adding to favorites:', err);
    res
      .status(500)
      .json({ success: false, message: 'Error adding to favorites' });
  }
});

router.post(
  '/comment/:postId/:commentId',
  checkAuthenticated,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const postId = req.params.postId;
      const commentId = req.params.commentId;

      await favoritesQueries.addCommentToFavorites(userId, postId, commentId);
      res.redirect(`/posts/${postId}#${req.params.commentId}`);
    } catch (err) {
      console.error('Error adding to favorites:', err);
      res.status(500).send('Error adding to favorites');
    }
  }
);

router.post('/jobs/:jobId', checkAuthenticated, async (req, res) => {
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
        message: 'Job successfully removed from favorites.',
      });
    } else {
      await favoritesQueries.addJobToFavorites(userId, jobId);
      return res.json({
        success: true,
        message: 'Job successfully added to favorites.',
      });
    }
  } catch (err) {
    console.error('Error adding job to favorites:', err);
    res
      .status(500)
      .json({ success: false, message: 'Error adding job to favorites' });
  }
});

router.delete('/post/:postId', checkAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.postId;
    await favoritesQueries.removeFromFavorites(userId, postId);
    res.redirect('/favorites');
  } catch (err) {
    console.error('Error removing from favorites:', err);
    res
      .status(500)
      .json({ success: false, message: 'Error removing from favorites' });
  }
});

router.get('/isFavorite/job/:jobId', async (req, res) => {
  try {
    if (!req.user) {
      return res.json({ isFavorite: false, buttonText: 'Favorite' });
    }
    const userId = req.user.id;
    if (!userId) {
      return res.json({ isFavorite: false, buttonText: 'Favorite' });
    }
    const jobId = req.params.jobId;
    if (!jobId) {
      return res.json({ isFavorite: false, buttonText: 'Favorite' });
    }
    const job = await favoritesQueries.getFavoriteJobByJobIdAndUserId(
      jobId,
      userId
    );
    const isFavorite = !!job;
    res.json({
      isFavorite: isFavorite,
      buttonText: isFavorite ? 'Unfavorite' : 'Favorite',
    });
  } catch (err) {
    console.error('Error checking if job is favorite:', err);
    res
      .status(500)
      .json({ success: false, message: 'Error checking if job is favorite' });
  }
});

router.get('/isFavorite/post/:postId', async (req, res) => {
  try {
    if (!req.user) {
      return res.json({ isFavorite: false, buttonText: 'Favorite' });
    }
    const userId = req.user.id;
    if (!userId) {
      return res.json({ isFavorite: false, buttonText: 'Favorite' });
    }
    const postId = req.params.postId;
    if (!postId) {
      return res.json({ isFavorite: false, buttonText: 'Favorite' });
    }
    const post = await postQueries.getFavoritePostByPostIdAndUserId(
      postId,
      userId
    );
    const isFavorite = !!post;
    res.json({
      isFavorite: isFavorite,
      buttonText: isFavorite ? 'Unfavorite' : 'Favorite',
    });
  } catch (err) {
    console.error('Error checking if post is favorite:', err);
    res
      .status(500)
      .json({ success: false, message: 'Error checking if job is favorite' });
  }
});

module.exports = router;
