const sql = require("mssql");
const crypto = require("crypto");
const redisClient = require("../config/redisConfig"); // Adjust the path as necessary

const postQueries = {
  getPosts: async () => {
    try {
      const cacheKey = "posts_all";
      // Try to get data from cache
      const cachedPosts = await redisClient.get(cacheKey);
      if (cachedPosts) {
        return JSON.parse(cachedPosts);
      }

      const result = await sql.query("SELECT * FROM posts WHERE deleted = 0");
      const posts = result.recordset;

      // Cache the result for future requests
      await redisClient.set(cacheKey, JSON.stringify(posts), "EX", 3600); // Expires in 1 hour
      return posts;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getPostById: async (postId) => {
    const cacheKey = `post_${postId}`;
    const cachedPost = await redisClient.get(cacheKey);
    if (cachedPost) {
      return JSON.parse(cachedPost);
    }
    try {
      const result =
        await sql.query`SELECT * FROM posts WHERE id = ${postId} AND deleted = 0`;
      await redisClient.set(cacheKey, result.recordset[0], "EX", 3600); // Expires in 1 hour
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

  createPost: async (userId, title, content, link = "", community_id, tags) => {
    if (typeof link !== "string") {
      throw new Error("Link must be a string");
    }

    console.log(
      "userId:",
      userId,
      "title:",
      title,
      "content:",
      content,
      "tags:",
      tags,
      "community_id:",
      community_id,
      "link:",
      link
    );

    try {
      // Insert the post into the posts table
      const uniqueId = `${Date.now().toString(36)}-${crypto
        .randomBytes(3)
        .toString("hex")}`;

      if (tags && tags.length > 0) {
        for (const tag of tags) {
          // Find or create the tag and get its id
          let tagId;
          const tagRecord =
            await sql.query`SELECT id FROM tags WHERE name = ${tag}`;
          if (tagRecord.recordset.length > 0) {
            tagId = tagRecord.recordset[0].id;
          } else {
            // If tag does not exist, create it
            const newTag =
              await sql.query`INSERT INTO tags (name) OUTPUT INSERTED.id VALUES (${tag})`;
            tagId = newTag.recordset[0].id;
          }
          // Associate the tag with the post
          await sql.query`INSERT INTO post_tags (post_id, tag_id) VALUES (${uniqueId}, ${tagId})`;
        }
      }

      await sql.query`INSERT INTO posts (id, user_id, title, content, link, communities_id) VALUES (${uniqueId}, ${userId}, ${title}, ${content}, ${link}, ${community_id})`;
      return uniqueId;
    } catch (err) {
      console.error("Database insert error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  },

  getTagsByPostId: async (postId) => {
    try {
      const result = await sql.query`
        SELECT t.name
        FROM tags t
        JOIN post_tags pt ON t.id = pt.tag_id
        WHERE pt.post_id = ${postId}`;

      return result.recordset.map((record) => record.name);
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getAllTags: async () => {
    try {
      const result = await sql.query`SELECT * FROM tags`;
      return result.recordset;
    } catch (err) {
      return JSON.stringify(err);
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

        const newScore =
          (await postQueries.getBoostCount(postId)) -
          (await postQueries.getDetractCount(postId));

        if (newScore == 0) {
          return 0;
        } else {
          return newScore;
        }
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
        const newScore =
          (await postQueries.getBoostCount(postId)) -
          (await postQueries.getDetractCount(postId));
        return newScore;
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

        const newScore =
          (await postQueries.getBoostCount(postId)) -
          (await postQueries.getDetractCount(postId));
        return newScore;
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

        const newScore =
          (await postQueries.getBoostCount(postId)) -
          (await postQueries.getDetractCount(postId));
        return newScore;
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

      const newScore =
        (await postQueries.getBoostCount(postId)) -
        (await postQueries.getDetractCount(postId));
      return newScore;
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
  getUserInteractions: async (postId, userId) => {
    try {
      const result = await sql.query`
      SELECT action_type 
      FROM userPostActions 
        WHERE user_id = ${userId} AND post_id = ${postId}`;

      if (result.recordset.length === 0) {
        return "";
      } else {
        return result.recordset[0].action_type;
      }
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
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

      const newScore =
        (await postQueries.getBoostCount(postId)) -
        (await postQueries.getDetractCount(postId));

      return newScore;
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
