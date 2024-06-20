const sql = require("mssql");
const crypto = require("crypto");
const notificationQueries = require("./notificationQueries");
const utilFunctions = require("../utils/utilFunctions");
const { findById } = require("./userQueries");

function GETDATE() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

const commentQueries = {
  removeDuplicateActions: async () => {
    try {
      const result = await sql.query`
        WITH cte AS (
          SELECT *, ROW_NUMBER() OVER (PARTITION BY user_id, comment_id, action_type ORDER BY action_timestamp DESC) AS rn
          FROM userCommentActions
        )
        DELETE FROM cte WHERE rn > 1`;
    } catch (err) {
      console.error("Database delete error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  },

  togglePinComment: async (commentId) => {
    try {
      // Fetch the current pinned status of the comment
      const result =
        await sql.query`SELECT isPinned FROM comments WHERE id = ${commentId}`;
      if (result.recordset.length === 0) {
        throw new Error(`Comment with id ${commentId} does not exist`);
      }

      // Toggle the pinned status
      const newPinnedStatus = !result.recordset[0].isPinned;
      await sql.query`
        UPDATE comments 
        SET isPinned = ${newPinnedStatus} 
        WHERE id = ${commentId}`;
    } catch (err) {
      console.error("Database update error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  },

  addComment: async (postId, userId, commentText) => {
    try {
      // Insert the comment into the database
      const commentId = `${Date.now().toString(36)}-${crypto
        .randomBytes(3)
        .toString("hex")}`;
      await sql.query`INSERT INTO comments (id, post_id, user_id, comment) VALUES (${commentId}, ${postId}, ${userId}, ${commentText})`;

      // Fetch the user ID of the original post's author
      const result =
        await sql.query`SELECT user_id FROM posts WHERE id = ${postId}`;
      if (result.recordset.length > 0) {
        const originalPostAuthorId = result.recordset[0].user_id;

        // Create a notification for the original post author
        if (originalPostAuthorId !== userId) {
          const username = await findById(userId).then((user) => user.username);
          // Check to avoid notifying if commenting on own post
          await notificationQueries.createNotification(
            userId,
            originalPostAuthorId,
            "NEW_COMMENT",
            postId
          );
        }

        // boost your comment by default
        await commentQueries.interactWithComment(
          postId,
          commentId,
          userId,
          "BOOST"
        );
      }

      return commentId;
    } catch (err) {
      console.error("Database insert error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  },

  interactWithComment: async (postId, commentId, userId, actionType) => {
    try {
      if (
        ![
          "LOVE",
          "LIKE",
          "CURIOUS",
          "INTERESTING",
          "CELEBRATE",
          "BOOST",
        ].includes(actionType)
      ) {
        throw new Error("Invalid action type");
      }

      if (actionType === "BOOST") {
        actionType = "B";
      }

      // Check if the user has already interacted with the comment
      const userAction = await sql.query`
        SELECT action_type 
        FROM userCommentActions 
        WHERE user_id = ${userId} AND comment_id = ${commentId}`;

      if (userAction.recordset.length === 0) {
        // check if comments and user exists
        const commentExists = await sql.query`
          SELECT * FROM comments WHERE id = ${commentId}`;
        const userExists = await sql.query`
          SELECT * FROM users WHERE id = ${userId}`;

        if (commentExists.recordset.length === 0) {
          throw new Error(`Comment with id ${commentId} does not exist`);
        }

        if (userExists.recordset.length === 0) {
          throw new Error(`User with id ${userId} does not exist`);
        }

        // If no existing interaction, insert new action
        await sql.query`
          INSERT INTO userCommentActions (user_id, comment_id, action_type, action_timestamp) 
          VALUES (${userId}, ${commentId}, ${actionType}, ${GETDATE()})`;
      } else if (userAction.recordset[0].action_type !== actionType) {
        // If existing interaction is different, update action
        await sql.query`
          UPDATE userCommentActions 
          SET action_type = ${actionType}
          WHERE user_id = ${userId} AND comment_id = ${commentId}`;
      } else {
        // If user is repeating the same action, remove the action
        await sql.query`
          DELETE FROM userCommentActions 
          WHERE user_id = ${userId} AND comment_id = ${commentId}`;
      }

      // Recalculate and update the reactions count for the comment
      const reactionCounts = await sql.query`
        SELECT action_type, COUNT(*) as count 
        FROM userCommentActions 
        WHERE comment_id = ${commentId}
        GROUP BY action_type`;

      // Initialize reaction counts
      let loveCount = 0,
        likeCount = 0,
        curiousCount = 0,
        interestingCount = 0,
        celebrateCount = 0,
        boostCount = 0;

      // Update reaction counts based on the query result
      reactionCounts.recordset.forEach((row) => {
        switch (row.action_type) {
          case "LOVE":
            loveCount = row.count;
            break;
          case "LIKE":
            likeCount = row.count;
            break;
          case "CURIOUS":
            curiousCount = row.count;
            break;
          case "INTERESTING":
            interestingCount = row.count;
            break;
          case "CELEBRATE":
            celebrateCount = row.count;
            break;
          case "B":
            boostCount = row.count;
            break;
        }
      });

      // Update the comment with new reaction counts
      await sql.query`
        UPDATE comments 
        SET react_love = ${loveCount}, 
        react_like = ${likeCount},
        react_curious = ${curiousCount},
        react_interesting = ${interestingCount},
        react_celebrate = ${celebrateCount},
        boosts = ${boostCount}
        WHERE id = ${commentId}`;

      // Return updated comment info (or just the new reaction counts)
      return {
        love: loveCount,
        like: likeCount,
        curious: curiousCount,
        interesting: interestingCount,
        celebrate: celebrateCount,
        boosts: boostCount,
      };
    } catch (err) {
      console.error("Database update error:", err);
      throw err;
    }
  },
  getCommentsByPostId: async (postId) => {
    try {
      const result =
        await sql.query`SELECT * FROM comments WHERE post_id = ${postId} AND deleted = 0`;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  },

  deleteCommentById: async (commentId) => {
    try {
      // check if comments exist where parent_comment_id = commentId
      const result = await sql.query`
        SELECT * FROM comments WHERE parent_comment_id = ${commentId}`;

      if (result.recordset.length > 0) {
        // If there are replies, set comment to deleted and user id to 0
        await sql.query`
          UPDATE comments 
          SET comment = '[deleted]'
          WHERE id = ${commentId}`;
      } else {
        // If there are no replies, delete the comment
        await sql.query`DELETE FROM comments WHERE id = ${commentId}`;
      }

      // Delete all reactions to the comment
      await sql.query`DELETE FROM userCommentActions WHERE comment_id = ${commentId}`;
    } catch (err) {
      console.error("Database delete error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  },

  getCommentById: async (commentId) => {
    try {
      const result =
        await sql.query`SELECT * FROM comments WHERE id = ${commentId}`;
      return result.recordset[0];
    } catch (err) {
      console.error("Database query error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  },

  addReply: async (commentId, userId, replyText) => {
    try {
      // Insert the reply into the database
      const replyId = `${Date.now().toString(36)}-${crypto
        .randomBytes(3)
        .toString("hex")}`;
      await sql.query`INSERT INTO replies (id, comment_id, user_id, reply) VALUES (${replyId}, ${commentId}, ${userId}, ${replyText})`;

      // Fetch the user ID of the original comment author
      const result =
        await sql.query`SELECT user_id FROM comments WHERE id = ${commentId}`;
      if (result.recordset.length > 0) {
        const originalCommentAuthorId = result.recordset[0].user_id;

        // Create a notification for the original comment author
        if (originalCommentAuthorId !== userId) {
          const username = await findById(userId).then((user) => user.username);
          // Check to avoid notifying if commenting on own post
          await notificationQueries.createNotification(
            userId,
            originalCommentAuthorId,
            "NEW_COMMENT",
            postId
          );
        }
      }

      // boost your comment by default
      await commentQueries.interactWithComment(0, commentId, userId, "BOOST");

      return replyId;
    } catch (err) {
      console.error("Database insert error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  },
};

module.exports = commentQueries;
