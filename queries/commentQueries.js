const sql = require("mssql");
const crypto = require("crypto");

function GETDATE() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

const commentQueries = {
  addComment: async (postId, userId, commentText) => {
    try {
      const commentId = `${Date.now().toString(36)}-${crypto
        .randomBytes(3)
        .toString("hex")}`;
      await sql.query`INSERT INTO comments (id, post_id, user_id, comment) VALUES (${commentId}, ${postId}, ${userId}, ${commentText})`;
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
      const replyId = `${Date.now().toString(36)}-${crypto
        .randomBytes(3)
        .toString("hex")}`;
      await sql.query`INSERT INTO replies (id, comment_id, user_id, reply) VALUES (${replyId}, ${commentId}, ${userId}, ${replyText})`;
      return replyId;
    } catch (err) {
      console.error("Database insert error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  },
  boostComment: async (commentId, userId) => {
    try {
      const userAction = await sql.query`
        SELECT action_type 
        FROM userCommentActions 
        WHERE user_id = ${userId} AND comment_id = ${commentId}`;

      if (userAction.recordset.length === 0) {
        await sql.query`
          UPDATE comments 
          SET boosts = boosts + 1 
          WHERE id = ${commentId}`;

        await sql.query`
          INSERT INTO userCommentActions (user_id, comment_id, action_type, action_timestamp) VALUES (${userId}, ${commentId}, 'B', GETDATE())`;
      } else if (userAction.recordset[0].action_type === "D") {
        await sql.query`
          UPDATE comments 
          SET boosts = boosts + 1,
              detracts = detracts - 1
          WHERE id = ${commentId}`;

        await sql.query`
          UPDATE userCommentActions 
          SET action_type = 'B'
          WHERE user_id = ${userId} AND comment_id = ${commentId}`;
      } else {
        console.log("User has already interacted with this comment.");
      }
    } catch (err) {
      console.error("Database update error:", err);
      throw err;
    }
  },
  detractComment: async (commentId, userId) => {
    try {
      const userAction = await sql.query`
        SELECT action_type 
        FROM userCommentActions 
        WHERE user_id = ${userId} AND comment_id = ${commentId}`;

      if (userAction.recordset.length === 0) {
        await sql.query`
          UPDATE comments 
          SET detracts = detracts + 1 
          WHERE id = ${commentId}`;

        await sql.query`
          INSERT INTO userCommentActions (user_id, comment_id, action_type) 
          VALUES (${userId}, ${commentId}, 'D')`;
      } else if (userAction.recordset[0].action_type === "B") {
        await sql.query`
          UPDATE comments 
          SET detracts = detracts + 1,
              boosts = boosts - 1
          WHERE id = ${commentId}`;

        await sql.query`
          UPDATE userCommentActions 
          SET action_type = 'D'
          WHERE user_id = ${userId} AND comment_id = ${commentId}`;
      } else {
        console.log("User has already interacted with this comment.");
      }
    } catch (err) {
      console.error("Database update error:", err);
      throw err;
    }
  },
  isCommentBoosted: async (commentId, userId) => {
    try {
      const result = await sql.query`
        SELECT action_type 
        FROM userCommentActions 
        WHERE user_id = ${userId} AND comment_id = ${commentId}`;

      return (
        result.recordset.length > 0 && result.recordset[0].action_type === "B"
      );
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },
  isCommentDetracted: async (commentId, userId) => {
    try {
      const result = await sql.query`
        SELECT action_type 
        FROM userCommentActions 
        WHERE user_id = ${userId} AND comment_id = ${commentId}`;

      return (
        result.recordset.length > 0 && result.recordset[0].action_type === "D"
      );
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },
  removeBoost: async (commentId, userId) => {
    try {
      await sql.query`
        UPDATE comments 
        SET boosts = boosts - 1 
        WHERE id = ${commentId}`;

      await sql.query`
        DELETE FROM userCommentActions 
        WHERE user_id = ${userId} AND comment_id = ${commentId}`;

      return await commentQueries.getBoostCount(commentId);
    } catch (err) {
      console.error("Database update error:", err);
      throw err;
    }
  },
  getBoostCount: async (commentId) => {
    try {
      const result = await sql.query`
        SELECT boosts 
        FROM comments 
        WHERE id = ${commentId}`;

      return result.recordset[0].boosts;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },
};

module.exports = commentQueries;
