const express = require("express");
const router = express.Router();
const sql = require("mssql");
const { checkAuthenticated } = require("../middleware/authMiddleware");
const postQueries = require("../queries/postQueries");
const utilFunctions = require("../utils/utilFunctions");
const getUserDetails = utilFunctions.getUserDetails;

// Route for viewing all posts
router.get("/posts", async (req, res) => {
  try {
    const posts = await postQueries.getPosts();
    res.render("posts.ejs", { user: req.user, error: null, posts: posts });
  } catch (err) {
    console.error("Database query error:", err);
    const error = { status: 500, message: "Error fetching posts" };
    res.render("error.ejs", { user: req.user, error });
  }
});

// Route for creating a new post
router.post("/posts", async (req, res) => {
  try {
    const { userId, title, content } = req.body;
    const postId = await postQueries.createPost(userId, title, content);
    res.redirect(`/posts/${postId}`);
  } catch (err) {
    console.error("Database insert error:", err);
    res.status(500).send("Error creating post");
  }
});

// Route for boosting a post
router.post("/posts/:postId/boost", checkAuthenticated, async (req, res) => {
  try {
    const postId = req.params.postId;
    await postQueries.boostPost(postId);
    res.json({ message: "Boost successful" });
  } catch (err) {
    console.error("Database insert error:", err);
    res.status(500).send("Error boosting post");
  }
});

router.get("/posts/:postId", async (req, res) => {
  try {
    const postId = req.params.postId;

    // Fetch all comments related to the post
    const query = `
        SELECT c.id, c.parent_comment_id, c.user_id, c.comment, c.created_at
        FROM comments c
        WHERE c.post_id = '${postId}' AND c.deleted = 0`;

    const result = await sql.query(query);

    // Function to nest comments
    async function nestComments(commentList) {
      const commentMap = {};

      // Create a map of comments
      commentList.forEach((comment) => {
        commentMap[comment.id] = { ...comment, replies: [] };
      });

      const nestedComments = [];
      for (let comment of commentList) {
        if (
          comment.parent_comment_id &&
          commentMap[comment.parent_comment_id]
        ) {
          commentMap[comment.parent_comment_id].replies.push(
            commentMap[comment.id]
          );
        } else {
          nestedComments.push(commentMap[comment.id]);
        }
      }

      // Fetch user details for each comment
      for (let comment of nestedComments) {
        comment.user = await getUserDetails(comment.user_id);
        for (let reply of comment.replies) {
          reply.user = await getUserDetails(reply.user_id);
        }
      }

      return nestedComments;
    }

    // Nest comments
    const nestedComments = await nestComments(result.recordset);

    async function fetchUserDetailsForComments(comments) {
      for (let comment of comments) {
        comment.user = await getUserDetails(comment.user_id);
        if (comment.replies && comment.replies.length > 0) {
          await fetchUserDetailsForComments(comment.replies);
        }
      }
    }

    await fetchUserDetailsForComments(nestedComments);

    // Fetch post details
    const postQuery = `SELECT * FROM posts WHERE id = '${postId}' AND deleted = 0`;
    const postResult = await sql.query(postQuery);

    // Combine post details with comments
    const postData = {
      ...postResult.recordset[0],
      user: await getUserDetails(postResult.recordset[0].user_id),
      comments: await Promise.all(
        nestedComments.map(async (comment) => {
          const user = await getUserDetails(comment.user_id);
          const replies = await Promise.all(
            comment.replies.map(async (reply) => {
              const replyUser = await getUserDetails(reply.user_id);
              console.log(replyUser);
              return { ...reply };
            })
          );
          return { ...comment, user, replies };
        })
      ),
    };

    res.render("post.ejs", { post: postData, user: req.user });
  } catch (err) {
    console.error("Database query error:", err);
    res.status(500).send("Error fetching post and comments");
  }
});

// Route for deleting a post
router.delete("/post/:postId", checkAuthenticated, async (req, res) => {
  const postId = req.params.postId;
  const userId = req.user.id; // Assuming the user ID is stored in req.user

  try {
    const post = await postQueries.getPostById(postId);
    if (post.user_id !== userId) {
      return res.status(403).send("You are not authorized to delete this post");
    }

    await postQueries.deletePostById(postId);
    res.redirect("/");
  } catch (error) {
    console.error("Database delete error:", error);
    res.status(500).send("Error deleting post");
  }
});

module.exports = router;
