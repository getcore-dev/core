const sql = require("mssql");
const crypto = require("crypto");
const redisClient = require("../config/redisConfig"); // Adjust the path as necessary

const generateUniqueId = () => {
  // Use the last 4 characters of the current timestamp in base 36
  const timestampPart = Date.now().toString(36).slice(-4);

  // Generate a random 4-character string in base 36
  const randomPart = crypto.randomBytes(2).toString("hex").slice(0, 4);

  // Combine both parts to form an 8-character ID
  return `${timestampPart}${randomPart}`;
};

const removeDuplicateActions = async (postId, userId, actionType) => {
  try {
    console.log(
      `Removing duplicate ${actionType} actions for user ${userId} on post ${postId}`
    );

    // Check if there are duplicate actions for the same user and post with the specified action type
    const duplicateActions = await sql.query`
      SELECT id
      FROM userPostActions
      WHERE user_id = ${userId} AND post_id = ${postId} AND action_type = ${actionType}`;

    // If there are duplicates, delete them
    if (duplicateActions.recordset.length > 1) {
      console.log(
        `Found ${duplicateActions.recordset.length} duplicate ${actionType} actions.`
      );

      const duplicateIds = duplicateActions.recordset.map(
        (action) => action.id
      );
      await sql.query`
        DELETE FROM userPostActions
        WHERE id IN (${duplicateIds.join(",")})`;

      console.log(
        `Deleted ${duplicateIds.length} duplicate ${actionType} actions.`
      );
    } else {
      console.log(`No duplicate ${actionType} actions found.`);
    }
  } catch (err) {
    console.error("Database delete error:", err);
    throw err; // Rethrow the error for the caller to handle
  }
};
const getScore = async (postId) => {
  try {
    // Get the sum of boosts for the specified post
    const boostResult = await sql.query`
      SELECT COUNT(*) AS boostCount
      FROM userPostActions
      WHERE post_id = ${postId} AND action_type = 'B'`;

    const boostCount = boostResult.recordset[0].boostCount;

    // Get the sum of detracts for the specified post
    const detractResult = await sql.query`
      SELECT COUNT(*) AS detractCount
      FROM userPostActions
      WHERE post_id = ${postId} AND action_type = 'D'`;

    const detractCount = detractResult.recordset[0].detractCount;

    // Calculate the score (boosts - detracts)
    return { boostCount, detractCount, score: boostCount - detractCount };
  } catch (err) {
    console.error("Database query error:", err);
    throw err; // Rethrow the error for the caller to handle
  }
};

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
    try {
      const result =
        await sql.query`SELECT * FROM posts WHERE id = ${postId} AND deleted = 0`;
      return result.recordset[0];
    } catch (err) {
      console.error("Database query error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  },

  getParentAuthorUsernameByCommentId: async (commentId) => {
    try {
      // Query to check if the comment has a parent_comment_id and get the parent comment's author username or post's author username accordingly
      const result = await sql.query`
        SELECT 
          COALESCE(parentComment.user_id, post.user_id) as author_id
        FROM 
          comments as comment
          LEFT JOIN comments as parentComment ON comment.parent_comment_id = parentComment.id
          LEFT JOIN posts as post ON comment.post_id = post.id
        WHERE 
          comment.id = ${commentId}`;

      if (result.recordset.length === 0) {
        throw new Error("Comment not found");
      }

      const authorId = result.recordset[0].author_id;

      // Now fetch the username using the authorId
      const userResult = await sql.query`
        SELECT username
        FROM users
        WHERE id = ${authorId}`;

      if (userResult.recordset.length === 0) {
        throw new Error("User not found");
      }

      return userResult.recordset[0].username;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
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

    if (!Array.isArray(tags)) {
      tags = tags.split(",").map((tag) => tag.trim());
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
      link,
      "tags:",
      tags
    );

    try {
      // Insert the post into the posts table
      const uniqueId = generateUniqueId();

      // Insert into the posts table
      await sql.query`INSERT INTO posts (id, user_id, title, content, link, communities_id) VALUES (${uniqueId}, ${userId}, ${title}, ${content}, ${link}, ${community_id})`;

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

      // Record user's upvote and set boosts and detracts
      await sql.query`INSERT INTO userpostactions (post_id, user_id, upvoted, boosts, detracts) VALUES (${uniqueId}, ${userId}, 1, 1, 0)`;

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

  interactWithPost: async (postId, userId, actionType) => {
    try {
      // Validate actionType
      if (!["LOVE", "LIKE", "CURIOUS", "INTERESTING", "CELEBRATE"].includes(actionType)) {
        throw new Error("Invalid action type");
      }
  
      // Check if the user has already interacted with the post
      const userAction = await sql.query`
        SELECT action_type 
        FROM userPostActions 
        WHERE user_id = ${userId} AND post_id = ${postId}`;
  
      if (userAction.recordset.length === 0) {
        // If no previous interaction, insert new action
        await sql.query`
          INSERT INTO userPostActions (user_id, post_id, action_type) 
          VALUES (${userId}, ${postId}, ${actionType})`;
      } else if (userAction.recordset[0].action_type !== actionType) {
        // If existing interaction is different, update action
        await sql.query`
          UPDATE userPostActions 
          SET action_type = ${actionType}
          WHERE user_id = ${userId} AND post_id = ${postId}`;
      } else {
        // If user is repeating the same action, remove the action
        await sql.query`
          DELETE FROM userPostActions 
          WHERE user_id = ${userId} AND post_id = ${postId}`;
      }
  
      // Recalculate and update the reactions count for the post
      const reactionCounts = await sql.query`
        SELECT action_type, COUNT(*) as count 
        FROM userPostActions 
        WHERE post_id = ${postId}
        GROUP BY action_type`;
  
      // Initialize reaction counts
      let loveCount = 0, likeCount = 0, curiousCount = 0, interestingCount = 0, celebrateCount = 0;
  
      // Update reaction counts based on the query result
      reactionCounts.recordset.forEach(row => {
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
        }
      });
  
      // Update the post with new reaction counts
      await sql.query`
        UPDATE posts 
        SET love = ${loveCount}, 
            like = ${likeCount},
            curious = ${curiousCount},
            interesting = ${interestingCount},
            celebrate = ${celebrateCount}
        WHERE id = ${postId}`;
  
      // Return updated post info (or just the new reaction counts)
      return { love: loveCount, like: likeCount, curious: curiousCount, interesting: interestingCount, celebrate: celebrateCount };
    } catch (err) {
      console.error("Database update error:", err);
      throw err;
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
