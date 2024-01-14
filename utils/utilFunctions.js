const sql = require("mssql");
const axios = require("axios");
const cheerio = require("cheerio");
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 3600 }); // Cache TTL is 1 hour (3600 seconds)

const utilFunctions = {
  getUserDetails: async (userId) => {
    try {
      const userResult =
        await sql.query`SELECT * FROM users WHERE id = ${userId}`;
      if (userResult.recordset.length > 0) {
        return userResult.recordset[0];
      } else {
        // Return a default user object instead of throwing an error
        return { id: userId, username: "unknown", avatar: null };
      }
    } catch (err) {
      console.error("Database query error:", err);
      // Optionally, you can still return a default user object in case of query error
      return { id: userId, username: "error", avatar: null };
    }
  },

  linkify: (text) => {
    const urlRegex =
      /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;
    return text.replace(urlRegex, (url) => {
      return `<a href="${url}" target="_blank" class="comment-url">${url}</a>`;
    });
  },

  checkMissingFields: async (userId) => {
    let missingFields = [];

    const result = await sql.query`
      SELECT firstname, lastname FROM users WHERE id = ${userId}
    `;

    try {
      if (result.recordset.length > 0) {
        let user = result.recordset[0];
        if (!user.firstname) missingFields.push("firstname");
        if (!user.lastname) missingFields.push("lastname");
      }
      return missingFields;
    } catch (err) {
      console.error("Error in checking missing fields:", err);
    }
  },

  getLinkPreview: async (url) => {
    const getMetaTag = async ($, name) => {
      return (
        $(`meta[name=${name}]`).attr("content") ||
        $(`meta[name="twitter:${name}"]`).attr("content") ||
        $(`meta[property="og:${name}"]`).attr("content")
      );
    };
    try {
      if (typeof url !== "string") {
        throw new Error("URL must be a string");
      }

      const cacheKey = `link_preview_${url}`;
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData); // Return cached data if available
      }

      const headers = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
      };

      const response = await axios.get(url, { headers, timeout: 5000 });
      if (response.status !== 200) {
        throw new Error(`Request failed with status code ${response.status}`);
      }

      const $ = cheerio.load(response.data);
      const metaTags = await Promise.all([
        getMetaTag($, "description"),
        getMetaTag($, "image"),
        getMetaTag($, "author"),
      ]);

      const preview = {
        url,
        title: $("title").first().text(),
        favicon:
          $('link[rel="shortcut icon"]').attr("href") ||
          $('link[rel="alternate icon"]').attr("href"),
        description: metaTags[0],
        image: metaTags[1],
        author: metaTags[2],
      };

      // Cache the result for future requests
      await redisClient.set(cacheKey, JSON.stringify(preview), "EX", 3600); // Expires in 1 hour
      return preview;
    } catch (error) {
      console.error("Error fetching URL:", error);
      return null;
    }
  },

  // Helper function to fetch meta tags

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

  getCommunityDetails: async (communityId) => {
    try {
      const result = await sql.query`
        SELECT * FROM communities WHERE id = ${communityId}
      `;
      return result.recordset[0];
    } catch (err) {
      console.error("Database query error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  },
};

module.exports = utilFunctions;
