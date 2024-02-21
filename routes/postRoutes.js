const express = require("express");
const router = express.Router();
const sql = require("mssql");
const { checkAuthenticated } = require("../middleware/authMiddleware");
const postQueries = require("../queries/postQueries");
const utilFunctions = require("../utils/utilFunctions");
const getUserDetails = utilFunctions.getUserDetails;
const commentQueries = require("../queries/commentQueries");
const { getLinkPreview } = require("../utils/utilFunctions");
const userQueries = require("../queries/userQueries");
const marked = require("marked");

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
router.post("/posts", checkAuthenticated, async (req, res) => {
  try {
    const { userId, title, content, link, community_id, tags } = req.body;
    console.log("Creating post with the following details:", req.body);
    const postId = await postQueries.createPost(
      userId,
      title,
      content,
      link,
      community_id,
      tags || []
    );

    return res.redirect(`/posts/${postId}`);

    console.log(`Post created with ID: ${postId}`);
  } catch (err) {
    console.error("Database insert error:", err);
    res.status(500).render("error.ejs", {
      error: { status: 500, message: "Error creating post" },
    });
  }
});

// Route for boosting a post
router.post("/posts/:postId/react", checkAuthenticated, async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = req.user.id;
    const action = req.body.action.toUpperCase(); // Convert action to uppercase for consistency

    console.log(`${action}ing post: ${postId} by user: ${userId}`);

    // Valid reactions
    const validActions = [
      "LOVE",
      "LIKE",
      "CURIOUS",
      "INTERESTING",
      "CELEBRATE",
      "BOOST",
    ];

    if (!validActions.includes(action)) {
      res.status(400).send("Invalid action");
      return;
    }

    const newScore = await postQueries.interactWithPost(postId, userId, action);

    if (newScore === 0) {
      console.log("User has already interacted with this post.");
      res.json({ message: "Action unchanged", newScore });
    } else {
      console.log(`Post ${action.toLowerCase()}ed successfully.`);
      res.json({
        message: `Post ${action.toLowerCase()}ed successfully`,
        newScore,
      });
    }
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).send("Error processing reaction");
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
          const newScore = await commentQueries.removeBoost(commentId, userId);
          res.json({ message: "Boost removed", newScore });
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
    SELECT 
    c.id, c.created_at, c.deleted, c.comment, c.user_id, c.parent_comment_id, c.post_id,
    SUM(CASE WHEN uca.action_type = 'LOVE' THEN 1 ELSE 0 END) AS loveCount,
    SUM(CASE WHEN uca.action_type = 'BOOST' THEN 1 ELSE 0 END) AS boostCount,
    SUM(CASE WHEN uca.action_type = 'INTERESTING' THEN 1 ELSE 0 END) AS interestingCount,
    SUM(CASE WHEN uca.action_type = 'CURIOUS' THEN 1 ELSE 0 END) AS curiousCount,
    SUM(CASE WHEN uca.action_type = 'LIKE' THEN 1 ELSE 0 END) AS likeCount,
    SUM(CASE WHEN uca.action_type = 'CELEBRATE' THEN 1 ELSE 0 END) AS celebrateCount
FROM comments c
LEFT JOIN UserCommentActions uca ON c.id = uca.comment_id
WHERE c.post_id = '${postId}' AND c.deleted = 0
GROUP BY c.id, c.created_at, c.deleted, c.comment, c.user_id, c.parent_comment_id, c.post_id
ORDER BY c.created_at DESC;`;

    const result = await sql.query(query);

    // Function to nest comments
    function nestComments(commentList) {
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

      return nestedComments;
    }

    // Nest comments
    const nestedComments = nestComments(result.recordset);

    // Recursive function to fetch user and parent author details for each comment
    const fetchUserAndParentDetails = async (comment) => {
      comment.user = await getUserDetails(comment.user_id);

      // Use the new function to get the parent author's username
      if (comment.parent_comment_id || comment.post_id) {
        comment_parent_username =
          await postQueries.getParentAuthorUsernameByCommentId(comment.id);

        comment.parent_author = await userQueries.findByUsername(
          comment_parent_username
        );
        comment.replyingTo = comment.parent_comment_id ? "comment" : "post";
      }

      if (comment.replies && comment.replies.length > 0) {
        await Promise.all(comment.replies.map(fetchUserAndParentDetails));
      }
    };

    // Fetch user and parent author details for all comments in parallel
    await Promise.all(nestedComments.map(fetchUserAndParentDetails));

    // Fetch post details
    const postResult = await utilFunctions.getPostData(postId);

    console.log("Post result:", postResult.user_id);
    // Construct postData
    const postData = {
      ...postResult,
      user: await getUserDetails(postResult.user_id),
      comments: nestedComments,
    };

    // Add link preview to postData if link exists
    if (postData.link) {
      postData.linkPreview = await getLinkPreview(postData.link);
    }
    postData.community = await utilFunctions.getCommunityDetails(
      postData.communities_id
    );

    // render markup content in html
    postData.content = marked.parse(postData.content);

    res.render("post.ejs", {
      post: postData,
      user: req.user,
      linkify: utilFunctions.linkify,
    });
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
    res.status(500).send("Error deleting post");
  }
});

module.exports = router;
