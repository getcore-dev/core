const sql = require("mssql");
const utilFunctions = require("../utils/utilFunctions");
const userQueries = require("../queries/userQueries");

const viewController = {
  renderHomePage: async (req, res) => {
    try {
      // Fetch a limited number of posts to improve performance
      const result = await sql.query(
        "SELECT TOP 20 * FROM posts WHERE deleted = 0 ORDER BY created_at DESC"
      );
      let posts = result.recordset;

      // Process each post concurrently
      const processedPosts = await Promise.all(
        posts.map(async (post) => {
          // Gather all async operations for a single post
          const userDetails = utilFunctions.getUserDetails(post.user_id);
          const postScore = utilFunctions.getPostScore(post.id);
          const comments = utilFunctions.getComments(post.id);
          const communityDetails = utilFunctions.getCommunityDetails(
            post.communities_id
          );

          const operations = [
            userDetails,
            postScore,
            comments,
            communityDetails,
          ];

          // Only add link preview if there is a link
          let linkPreview;
          if (post.link) {
            linkPreview = utilFunctions.getLinkPreview(post.link);
            operations.push(linkPreview);
          }

          // Await all async operations
          const [user, score, commentsData, community, linkPrev] =
            await Promise.all(operations);

          // Combine data into a single post object
          return {
            ...post,
            username: user.username.toLowerCase(),
            score,
            comments: commentsData,
            community,
            linkPreview: linkPrev,
          };
        })
      );

      res.render("communities.ejs", { user: req.user, posts: processedPosts });
    } catch (err) {
      res.render("error.ejs", {
        user: req.user,
        error: { message: err.message },
      });
    }
  },

  renderLogin: async (req, res) => {
    res.render("login.ejs", { user: req.user });
  },

  renderRegister: async (req, res) => {
    res.render("register.ejs", { user: req.user });
  },

  renderUserProfile: async (req, res) => {
    try {
      const username = req.params.username;
      const otheruser = await userQueries.findByUsername(username);
      const posts = await userQueries.getPostsByUserId(otheruser.id);
      const comments = await userQueries.getCommentsByUserId(otheruser.id);

      if (otheruser) {
        res.render("user_profile.ejs", {
          otheruser: otheruser,
          user: req.user,
          posts: posts,
          comments: comments,
          editfunction: userQueries.updateField,
        });
      } else {
        res.render("404.ejs", { user: req.user });
      }
    } catch (error) {
      res.status(500).send(error.message);
    }
  },

  renderErrorPage: (req, res, error) => {
    res.render("error.ejs", { user: req.user, error });
  },

  renderPostCreationPage: (req, res) => {
    res.render("create-post.ejs", { user: req.user });
  },

  renderLearningPage: (req, res) => {
    res.render("learning.ejs", { user: req.user });
  },

  renderJobsPage: (req, res) => {
    res.render("jobs.ejs", { user: req.user });
  },
};

module.exports = viewController;
