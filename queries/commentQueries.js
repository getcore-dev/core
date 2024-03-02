const sql = require("mssql");
const crypto = require("crypto");
const notificationQueries = require("./notificationQueries");
const utilFunctions = require("../utils/utilFunctions");
const { findById } = require("./userQueries");

function GETDATE() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

const commentQueries = {
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
      }

      return commentId;
    } catch (err) {
      console.error("Database insert error:", err);
      throw err; // Rethrow the error for the caller to handle
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
      await sql.query`UPDATE comments SET deleted = 1 WHERE id = ${commentId}`;
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

      return replyId;
    } catch (err) {
      console.error("Database insert error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  },
};

module.exports = commentQueries;
