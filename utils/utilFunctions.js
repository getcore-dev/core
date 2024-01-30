const sql = require("mssql");
const axios = require("axios");
const cheerio = require("cheerio");
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 1200 }); // TTL is 20 minutes

const utilFunctions = {
  getPosts: async () => {
    try {
      // Query to get posts with boosts and detracts count
      const result = await sql.query`
        SELECT p.id, p.created_at, p.deleted, p.title, p.content, p.link, p.communities_id, p.react_like, p.react_love, p.react_curious, p.react_interesting, p.react_celebrate,
        u.currentJob, u.username, u.avatar,
              SUM(CASE WHEN upa.action_type = 'LOVE' THEN 1 ELSE 0 END) as loveCount,
              SUM(CASE WHEN upa.action_type = 'INTERESTING' THEN 1 ELSE 0 END) as interestingCount,
              SUM(CASE WHEN upa.action_type = 'CURIOUS' THEN 1 ELSE 0 END) as curiousCount,
              SUM(CASE WHEN upa.action_type = 'LIKE' THEN 1 ELSE 0 END) as likeCount,
              SUM(CASE WHEN upa.action_type = 'CELEBRATE' THEN 1 ELSE 0 END) as celebrateCount
        FROM posts p
        INNER JOIN users u ON p.user_id = u.id
        LEFT JOIN userPostActions upa ON p.id = upa.post_id
        WHERE p.deleted = 0
        GROUP BY p.id, p.created_at, p.deleted, u.username, p.title, p.content, p.link, p.communities_id, u.avatar, u.currentJob,p.react_like, p.react_love, p.react_curious, p.react_interesting, p.react_celebrate, p.link_description, p.link_image, p.link_title
        ORDER BY p.created_at DESC
      `;

      // Optionally, update the posts table if there's a discrepancy
      for (let post of result.recordset) {
        if (
          post.likeCount !== post.react_like ||
          post.loveCount !== post.react_love ||
          post.interestingCount !== post.react_interesting ||
          post.curiousCount !== post.react_curious ||
          post.celebrateCount !== post.react_celebrate
        ) {
          await sql.query`
            UPDATE posts
            SET react_like = ${post.likeCount},
                react_love = ${post.loveCount},
                react_interesting = ${post.interestingCount},
                react_curious = ${post.curiousCount},
                react_celebrate = ${post.celebrateCount}
            WHERE id = ${post.id}
          `;
        }
      }

      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getPostData: async (postId) => {
    try {
      const result = await sql.query`
        SELECT p.id, p.created_at, p.deleted, p.title, p.content, p.link, p.communities_id, p.link_description, p.link_image, p.link_title, p.react_like, p.react_love, p.react_curious, p.react_interesting, p.react_celebrate,
                u.username, 
                SUM(CASE WHEN upa.action_type = 'LOVE' THEN 1 ELSE 0 END) as loveCount,
                SUM(CASE WHEN upa.action_type = 'INTERESTING' THEN 1 ELSE 0 END) as interestingCount,
                SUM(CASE WHEN upa.action_type = 'CURIOUS' THEN 1 ELSE 0 END) as curiousCount,
                SUM(CASE WHEN upa.action_type = 'LIKE' THEN 1 ELSE 0 END) as likeCount,
                SUM(CASE WHEN upa.action_type = 'CELEBRATE' THEN 1 ELSE 0 END) as celebrateCount
        FROM posts p
        INNER JOIN users u ON p.user_id = u.id
        LEFT JOIN userPostActions upa ON p.id = upa.post_id
        WHERE p.id = ${postId}
        GROUP BY p.id, p.created_at, p.deleted, u.username, p.title, p.content, p.link, p.communities_id, p.link_description, p.link_image, p.link_title, p.react_like, p.react_love, p.react_curious, p.react_interesting, p.react_celebrate
      `;
      const postData = result.recordset[0];
      if (postData) {
        postData.user = await utilFunctions.getUserDetails(postData.user_id);
        postData.score = postData.boostCount - postData.detractCount;
      }
      return postData;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getCommunities: async (communityId) => {
    try {
      const result = await sql.query`
        SELECT * FROM communities WHERE id = ${communityId}
      `;
      return result.recordset[0];
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getRepliesForComment: async (commentId) => {
    try {
      const result = await sql.query`
        SELECT * FROM comments WHERE parent_comment_id = ${commentId}
      `;
      const commentList = result.recordset;
      return await utilFunctions.getNestedComments(commentList);
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
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
      throw err;
    }
  },
  getTags: async (postId) => {
    try {
      const result = await sql.query`
        SELECT t.name FROM tags t
        INNER JOIN post_tags pt ON t.id = pt.tag_id
        WHERE pt.post_id = ${postId}
      `;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

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

  getUserDetailsFromGithub: async (githubUsername) => {
    try {
      const githubUser = "https://github.com/" + githubUsername;
      const query = `SELECT * FROM users WHERE github_url = '${githubUser}'`;

      const result = await sql.query(query);
      console.log(result);
      if (result.recordset.length > 0) {
        return result.recordset[0];
      } else {
        return null;
      }
    } catch (err) {
      console.error("Database query error:", err);
      return null;
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
      // Ensure the URL is a string
      if (typeof url !== "string") {
        throw new Error("URL must be a string");
      }

      // check if url exists in the LinkPreviewData table
      const linkPreviewDataQuery = `SELECT * FROM LinkPreviewData WHERE link = '${url}'`;
      const linkPreviewDataResult = await sql.query(linkPreviewDataQuery);

      // return data mapped to the proper format
      // link = url, image_url = image, description = description, title = title
      if (linkPreviewDataResult.recordset.length > 0) {
        const linkPreviewData = linkPreviewDataResult.recordset[0];
        return {
          url: linkPreviewData.link,
          image: linkPreviewData.image_url,
          description: linkPreviewData.description,
          title: linkPreviewData.title,
        };
      }

      const headers = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
      };

      const response = await axios.get(url, { headers, timeout: 5000 });
      const { data, status } = response;

      if (status !== 200) {
        throw new Error(`Request failed with status code ${status}`);
      }

      const $ = cheerio.load(data);
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

      // insert into LinkPreviewData table
      const insertLinkPreviewDataQuery = `INSERT INTO LinkPreviewData (link, image_url, description, title) VALUES ('${preview.url}', '${preview.image}', '${preview.description}', '${preview.title}')`;
      await sql.query(insertLinkPreviewDataQuery);

      return preview;
    } catch (error) {
      console.error("Error fetching URL:", error);
      return null;
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
