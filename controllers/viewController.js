const sql = require('mssql');
const utilFunctions = require('../utils/utilFunctions');
const userQueries = require('../queries/userQueries');
const postQueries = require('../queries/postQueries');

const viewController = {
  renderHomePage: async (req, res) => {
    try {
      // Send basic post data to the client
      res.render('communities.ejs', {
        user: req.user,
        communityId: null,
        community: null,
      });
    } catch (err) {
      res.render('error.ejs', {
        user: req.user,
        error: { message: err.message },
      });
    }
  },

  renderPrivacyPage: async (req, res) => {
    res.render('privacy.ejs', { user: req.user });
  },

  renderAboutPage: async (req, res) => {
    res.render('about.ejs', { user: req.user });
  },

  renderSettingsPage: async (req, res) => {
    res.render('settings.ejs', { user: req.user });
  },

  renderFollowers: async (req, res) => {
    try {
      const username = req.params.username;
      const user = await userQueries.findByUsername(username);
      const followers = await userQueries.getFollowers(user.id);
      res.render('user_followers.ejs', {
        user: req.user,
        otheruser: user,
        followers,
      });
    } catch (err) {
      res.render('error.ejs', {
        user: req.user,
        error: { message: err.message },
      });
    }
  },

  renderFollowing: async (req, res) => {
    try {
      const username = req.params.username;
      const user = await userQueries.findByUsername(username);
      const following = await userQueries.getFollowing(user.id);
      res.render('user_following.ejs', {
        user: req.user,
        otheruser: user,
        followers: following, // lmfao.
      });
    } catch (err) {
      res.render('error.ejs', {
        user: req.user,
        error: { message: err.message },
      });
    }
  },

  renderLogin: async (req, res) => {
    res.render('login.ejs', {
      user: req.user,
      githubClientId: process.env.GITHUB_CLIENT_ID,
    });
  },

  renderRegister: async (req, res) => {
    res.render('register.ejs', { user: req.user });
  },

  renderUserProfile: async (req, res) => {
    try {
      const username = req.params.username;
      const userId = req.user ? req.user.id : null;
      const otheruser = await userQueries.findByUsername(username);
      const posts = await userQueries.getPostsByUserIdUserProfile(otheruser.id);
      const comments = await userQueries.getCommentsByUserIdUserProfile(
        otheruser.id
      );
      await userQueries.removeDuplicateFollows();

      if (otheruser) {
        let isFollowing = false;
        if (userId) {
          isFollowing = await userQueries.isFollowing(userId, otheruser.id);
        }

        res.render('user_profile.ejs', {
          otheruser: otheruser,
          user: req.user,
          posts: posts,
          comments: comments,
          linkify: utilFunctions.linkify,
          isFollowing: isFollowing,
        });
      } else {
        res.render('404.ejs', { user: req.user });
      }
    } catch (error) {
      res.status(500).send(error.message);
    }
  },

  renderErrorPage: (req, res, error) => {
    res.render('error.ejs', { user: req.user, error });
  },

  renderPostCreationPage: (req, res) => {
    res.render('create-post.ejs', { user: req.user });
  },

  renderFeedbackCreationPage: (req, res) => {
    res.render('create-feedback.ejs', { user: req.user });
  },

  renderLearningPage: (req, res) => {
    res.render('learning.ejs', { user: req.user });
  },

  renderJobsPage: (req, res) => {
    res.render('jobs.ejs', { user: req.user });
  },
};

module.exports = viewController;
