const express = require("express");
const router = express.Router();
const sql = require("mssql");
const { checkAuthenticated } = require("../middleware/authMiddleware");
const postQueries = require("../queries/postQueries");
const utilFunctions = require("../utils/utilFunctions");
const getUserDetails = utilFunctions.getUserDetails;
const commentQueries = require("../queries/commentQueries");

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
    const userId = req.user.id;
    const action = req.body.action; // Action can be "boost" or "detract"

    console.log(`${action}ing post: ${postId} by user: ${userId}`);

    // Check if the post is already boosted or detracted by the user
    const isBoosted = await postQueries.isPostBoosted(postId, userId);
    const isDetracted = await postQueries.isPostDetracted(postId, userId);

    if (action === "boost") {
      if (isBoosted) {
        console.log("Post is already boosted. Removing the boost...");
        // If already boosted, remove the boost
        await postQueries.removeBoost(postId, userId);
        res.json({ message: "Boost removed" });
      } else {
        console.log("Post is not boosted. Adding the boost...");
        // If not boosted, add the boost
        await postQueries.boostPost(postId, userId);

        // Get the number of boosts and detracts for the post
        const boosts = await postQueries.getBoostCount(postId);
        const detracts = await postQueries.getDetractCount(postId);

        res.json({ message: "Boost successful", boosts, detracts });
      }
    } else if (action === "detract") {
      if (isDetracted) {
        console.log("Post is already detracted. Removing the detract...");
        // If already detracted, remove the detract
        await postQueries.removeDetract(postId, userId);
        res.json({ message: "Detract removed" });
      } else {
        console.log("Post is not detracted. Adding the detract...");
        // If not detracted, add the detract
        await postQueries.detractPost(postId, userId);

        // Get the number of boosts and detracts for the post
        const boosts = await postQueries.getBoostCount(postId);
        const detracts = await postQueries.getDetractCount(postId);

        res.json({ message: "Detract successful", boosts, detracts });
      }
    } else {
      res.status(400).send("Invalid action");
    }
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).send("Error boosting/detracting post");
  }
});

router.post(
  "/comments/:commentId/boost",
  checkAuthenticated,
  async (req, res) => {
    try {
      const commentId = req.params.commentId;
      const userId = req.user.id;
      const action = req.body.action; // Action can be "boost" or "detract"

      console.log(`${action}ing comment: ${commentId} by user: ${userId}`);

      // Check if the post is already boosted or detracted by the user
      const isBoosted = await commentQueries.isCommentBoosted(
        commentId,
        userId
      );
      const isDetracted = await commentQueries.isCommentDetracted(
        commentId,
        userId
      );

      if (action === "boost") {
        if (isBoosted) {
          console.log("Comment is already boosted. Removing the boost...");
          // If already boosted, remove the boost
          await commentQueries.removeBoost(commentId, userId);
          res.json({ message: "Boost removed" });
        } else {
          console.log("Comment is not boosted. Adding the boost...");
          // If not boosted, add the boost
          await commentQueries.boostComment(commentId, userId);

          // Get the number of boosts and detracts for the post
          const boosts = await commentQueries.getBoostCount(commentId);
          const detracts = await commentQueries.getDetractCount(commentId);

          res.json({ message: "Boost successful", boosts, detracts });
        }
      } else if (action === "detract") {
        if (isDetracted) {
          console.log("Comment is already detracted. Removing the detract...");
          // If already detracted, remove the detract
          await commentQueries.removeDetract(commentId, userId);
          res.json({ message: "Detract removed" });
        } else {
          console.log("Comment is not detracted. Adding the detract...");
          // If not detracted, add the detract
          await commentQueries.detractComment(commentId, userId);

          // Get the number of boosts and detracts for the post
          const boosts = await commentQueries.getBoostCount(commentId);
          const detracts = await commentQueries.getDetractCount(commentId);

          res.json({ message: "Detract successful", boosts, detracts });
        }
      } else {
        res.status(400).send("Invalid action");
      }
    } catch (err) {
      console.error("Database error:", err);
      res.status(500).send("Error boosting/detracting comment");
    }
  }
);

router.get("/posts/:postId", async (req, res) => {
  try {
    const postId = req.params.postId;

    // Fetch all comments related to the post
    const query = `
        SELECT c.id, c.parent_comment_id, c.user_id, c.comment, c.created_at, c.boosts, c.detracts
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
