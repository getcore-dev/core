const sql = require("mssql");
const utilFunctions = require("../utils/utilFunctions");
const userQueries = require("../queries/userQueries");

const viewController = {
  renderHomePage: async (req, res) => {
    try {
      const result = await sql.query("SELECT * FROM posts WHERE deleted = 0");
      let posts = result.recordset;

      for (let post of posts) {
        const user = await utilFunctions.getUserDetails(post.user_id);
        post.username = user.username.toLowerCase();
        post.score = await utilFunctions.getPostScore(post.id);
        post.comments = await utilFunctions.getComments(post.id);
        post.community = await utilFunctions.getCommunityDetails(
          post.communities_id
        );
        post.linkPreview = await utilFunctions.getLinkPreview(post.link);
      }

      res.render("communities.ejs", { user: req.user, posts: posts });
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

      if (otheruser) {
        res.render("user_profile.ejs", {
          otheruser: otheruser,
          user: req.user,
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
