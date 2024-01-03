const sql = require("mssql");

const utilFunctions = {
  getUserDetails: async (userId) => {
    try {
      const userResult =
        await sql.query`SELECT * FROM users WHERE id = ${userId}`;
      if (userResult.recordset.length > 0) {
        return userResult.recordset[0];
      } else {
        throw new Error(`User with ID ${userId} not found`);
      }
    } catch (err) {
      console.error("Database query error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  },

  getComments: async (postId) => {
    try {
      const result = await sql.query`
        SELECT * FROM comments WHERE post_id = ${postId} AND deleted = 0
      `;
      const commentList = result.recordset;
      return await utilFunctions.getNestedComments(commentList);
    } catch (err) {
      console.error("Database query error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  },

  getNestedComments: async (commentList) => {
    const commentMap = {};

    // Create a map of comments
    commentList.forEach((comment) => {
      commentMap[comment.id] = { ...comment, replies: [] };
    });

    const nestedComments = [];
    for (let comment of commentList) {
      if (comment.parent_comment_id && commentMap[comment.parent_comment_id]) {
        commentMap[comment.parent_comment_id].replies.push(
          commentMap[comment.id]
        );
      } else {
        nestedComments.push(commentMap[comment.id]);
      }
    }

    // Fetch user details for each comment
    for (let comment of nestedComments) {
      comment.user = await utilFunctions.getUserDetails(comment.user_id);
      for (let reply of comment.replies) {
        reply.user = await utilFunctions.getUserDetails(reply.user_id);
      }
    }

    return nestedComments;
  },

  getPostScore: async (postId) => {
    try {
      const result = await sql.query`
        SELECT boosts, detracts FROM posts WHERE id = ${postId}
      `;
      const boosts = result.recordset[0].boosts;
      const detracts = result.recordset[0].detracts;
      const score = boosts - detracts;
      return score;
    } catch (err) {
      console.error("Database query error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  },

  nestComments: async (commentList) => {
    const commentMap = {};

    // Create a map of comments
    commentList.forEach((comment) => {
      commentMap[comment.id] = { ...comment, replies: [] };
    });

    const nestedComments = [];
    for (let comment of commentList) {
      if (comment.parent_comment_id && commentMap[comment.parent_comment_id]) {
        commentMap[comment.parent_comment_id].replies.push(
          commentMap[comment.id]
        );
      } else {
        nestedComments.push(commentMap[comment.id]);
      }
    }

    // Fetch user details for each comment
    for (let comment of nestedComments) {
      comment.user = await utilFunctions.getUserDetails(comment.user_id);
      for (let reply of comment.replies) {
        reply.user = await utilFunctions.getUserDetails(reply.user_id);
      }
    }

    return nestedComments;
  },
};

module.exports = utilFunctions;
