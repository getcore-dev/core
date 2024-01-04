const sql = require("mssql");
const crypto = require("crypto");

const postQueries = {
  getPosts: async () => {
    try {
      const result = await sql.query("SELECT * FROM posts WHERE deleted = 0");
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  },

  getPostById: async (postId) => {
    try {
      const result =
        await sql.query`SELECT * FROM posts WHERE id = ${postId} AND deleted = 0`;
      return result.recordset[0];
    } catch (err) {
      console.error("Database query error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  },

  getCommentsByPostId: async (postId) => {
    try {
      const result = await sql.query`
        SELECT * 
        FROM replies 
        WHERE post_id = ${postId} AND deleted = 0`;

      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  },

  createPost: async (userId, title, content, link = "", community_id) => {
    try {
      const uniqueId = `${Date.now().toString(36)}-${crypto
        .randomBytes(3)
        .toString("hex")}`;
      await sql.query`INSERT INTO posts (id, user_id, title, content, link, communities_id) VALUES (${uniqueId}, ${userId}, ${title}, ${content}, ${link}, ${community_id})`;
      return uniqueId;
    } catch (err) {
      console.error("Database insert error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  },

  deletePostById: async (postId) => {
    try {
      await sql.query`UPDATE posts SET deleted = 1 WHERE id = ${postId}`;
    } catch (err) {
      console.error("Database delete error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  },

  boostPost: async (postId, userId) => {
    try {
      // Check if the user has already boosted or detracted the post
      const userAction = await sql.query`
        SELECT action_type 
        FROM userPostActions 
        WHERE user_id = ${userId} AND post_id = ${postId}`;

      // If user hasn't interacted with the post in terms of boosting or detracting
      if (userAction.recordset.length === 0) {
        // Update the boost count in posts table
        await sql.query`
          UPDATE posts 
          SET boosts = boosts + 1 
          WHERE id = ${postId}`;

        // Insert a record in userPostActions to indicate this user has boosted the post
        await sql.query`
          INSERT INTO userPostActions (user_id, post_id, action_type) 
          VALUES (${userId}, ${postId}, 'B')`;
      } else if (userAction.recordset[0].action_type === "D") {
        // Update the boost count and remove the detract count in posts table
        await sql.query`
          UPDATE posts 
          SET boosts = boosts + 1,
              detracts = detracts - 1
          WHERE id = ${postId}`;

        // Update the action_type in userPostActions to indicate this user has boosted the post
        await sql.query`
          UPDATE userPostActions 
          SET action_type = 'B'
          WHERE user_id = ${userId} AND post_id = ${postId}`;
      } else {
        console.log("User has already interacted with this post.");
      }
    } catch (err) {
      console.error("Database update error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  },
  detractPost: async (postId, userId) => {
    try {
      // Check if the user has already boosted or detracted the post
      const userAction = await sql.query`
        SELECT action_type 
        FROM userPostActions 
        WHERE user_id = ${userId} AND post_id = ${postId}`;

      // If user hasn't interacted with the post in terms of boosting or detracting
      if (userAction.recordset.length === 0) {
        // Update the detract count in posts table
        await sql.query`
          UPDATE posts 
          SET detracts = detracts + 1 
          WHERE id = ${postId}`;

        // Insert a record in userPostActions to indicate this user has detracted the post
        await sql.query`
          INSERT INTO userPostActions (user_id, post_id, action_type) 
          VALUES (${userId}, ${postId}, 'D')`;
      } else if (userAction.recordset[0].action_type === "B") {
        // Update the detract count and remove the boost count in posts table
        await sql.query`
          UPDATE posts 
          SET detracts = detracts + 1,
              boosts = boosts - 1
          WHERE id = ${postId}`;

        // Update the action_type in userPostActions to indicate this user has detracted the post
        await sql.query`
          UPDATE userPostActions 
          SET action_type = 'D'
          WHERE user_id = ${userId} AND post_id = ${postId}`;
      } else {
        console.log("User has already interacted with this post.");
      }
    } catch (err) {
      console.error("Database update error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  },
  isPostBoosted: async (postId, userId) => {
    try {
      const result = await sql.query`
        SELECT action_type 
        FROM userPostActions 
        WHERE user_id = ${userId} AND post_id = ${postId}`;

      return (
        result.recordset.length > 0 && result.recordset[0].action_type === "B"
      );
    } catch (err) {
      console.error("Database query error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  },
  isPostDetracted: async (postId, userId) => {
    try {
      const result = await sql.query`
        SELECT action_type 
        FROM userPostActions 
        WHERE user_id = ${userId} AND post_id = ${postId}`;

      return (
        result.recordset.length > 0 && result.recordset[0].action_type === "D"
      );
    } catch (err) {
      console.error("Database query error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  },
  removeBoost: async (postId, userId) => {
    try {
      // Update the boost count in posts table
      await sql.query`
        UPDATE posts 
        SET boosts = boosts - 1 
        WHERE id = ${postId}`;

      // Delete the record in userPostActions to indicate this user has removed the boost
      await sql.query`
        DELETE FROM userPostActions 
        WHERE user_id = ${userId} AND post_id = ${postId}`;
    } catch (err) {
      console.error("Database update error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  },
  getBoostCount: async (postId) => {
    try {
      const result = await sql.query`
        SELECT boosts 
        FROM posts 
        WHERE id = ${postId}`;

      return result.recordset[0].boosts;
    } catch (err) {
      console.error("Database query error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  },
  getDetractCount: async (postId) => {
    try {
      const result = await sql.query`
        SELECT detracts 
        FROM posts 
        WHERE id = ${postId}`;

      return result.recordset[0].detracts;
    } catch (err) {
      console.error("Database query error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  },
  removeDetract: async (postId, userId) => {
    try {
      // Update the detract count in posts table
      await sql.query`
        UPDATE posts 
        SET detracts = detracts - 1 
        WHERE id = ${postId}`;

      // Delete the record in userPostActions to indicate this user has removed the detract
      await sql.query`
        DELETE FROM userPostActions 
        WHERE user_id = ${userId} AND post_id = ${postId}`;
    } catch (err) {
      console.error("Database update error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  },
  getCommunityById: async (communityId) => {
    try {
      const result = await sql.query`
        SELECT * 
        FROM communities 
        WHERE id = ${communityId}`;

      return result.recordset[0];
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },
};

module.exports = postQueries;
