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
        SELECT p.id, p.created_at, p.deleted, p.title, p.content, p.link, p.communities_id, p.react_like, p.react_love, p.react_curious, p.react_interesting, p.react_celebrate, p.post_type,
        u.currentJob, u.username, u.avatar,
              SUM(CASE WHEN upa.action_type = 'LOVE' THEN 1 ELSE 0 END) as loveCount,
              SUM(CASE WHEN upa.action_type = 'B' THEN 1 ELSE 0 END) as boostCount,
              SUM(CASE WHEN upa.action_type = 'INTERESTING' THEN 1 ELSE 0 END) as interestingCount,
              SUM(CASE WHEN upa.action_type = 'CURIOUS' THEN 1 ELSE 0 END) as curiousCount,
              SUM(CASE WHEN upa.action_type = 'LIKE' THEN 1 ELSE 0 END) as likeCount,
              SUM(CASE WHEN upa.action_type = 'CELEBRATE' THEN 1 ELSE 0 END) as celebrateCount
        FROM posts p
        INNER JOIN users u ON p.user_id = u.id
        LEFT JOIN userPostActions upa ON p.id = upa.post_id
        WHERE p.deleted = 0
        GROUP BY p.id, p.created_at, p.deleted, u.username, p.title, p.content, p.link, p.communities_id, u.avatar, u.currentJob,p.react_like, p.react_love, p.react_curious, p.react_interesting, p.react_celebrate, p.link_description, p.link_image, p.link_title, p.post_type
        ORDER BY p.created_at DESC
      `;

      /*
      const postsToUpdate = result.recordset.filter(
        (post) => post.post_type == "post"
      );
      for (let post of postsToUpdate) {
        await sql.query`
          UPDATE posts
          SET post_type = 'discussion'
          WHERE id = ${post.id}
        `;
        // Reflect the change in the local object to ensure the updated data is returned
        post.post_type = "discussion";
      }
      */

      /*
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
      */

      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getPostsForCommunity: async (communityId) => {
    try {
      const result = await sql.query`
        SELECT p.id, p.created_at, p.deleted, p.title, p.content, p.link, p.communities_id, p.react_like, p.react_love, p.react_curious, p.react_interesting, p.react_celebrate, p.post_type,
        u.currentJob, u.username, u.avatar,
              SUM(CASE WHEN upa.action_type = 'LOVE' THEN 1 ELSE 0 END) as loveCount,
              SUM(CASE WHEN upa.action_type = 'B' THEN 1 ELSE 0 END) as boostCount,
              SUM(CASE WHEN upa.action_type = 'INTERESTING' THEN 1 ELSE 0 END) as interestingCount,
              SUM(CASE WHEN upa.action_type = 'CURIOUS' THEN 1 ELSE 0 END) as curiousCount,
              SUM(CASE WHEN upa.action_type = 'LIKE' THEN 1 ELSE 0 END) as likeCount,
              SUM(CASE WHEN upa.action_type = 'CELEBRATE' THEN 1 ELSE 0 END) as celebrateCount
        FROM posts p
        INNER JOIN users u ON p.user_id = u.id
        LEFT JOIN userPostActions upa ON p.id = upa.post_id
        WHERE p.communities_id = ${communityId} AND p.deleted = 0
        GROUP BY p.id, p.created_at, p.deleted, u.username, p.title, p.content, p.link, p.communities_id, u.avatar, u.currentJob, p.react_like, p.react_love, p.react_curious, p.react_interesting, p.react_celebrate, p.post_type
        ORDER BY p.created_at DESC
      `;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getCommunities: async () => {
    try {
      const result = await sql.query`
        SELECT name FROM communities`;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getTrendingPosts: async () => {
    try {
      const result = await sql.query`
        SELECT TOP 5 * FROM (
          SELECT p.id, p.created_at, p.deleted, p.title, p.content, p.link, p.communities_id, p.react_like, p.react_love, p.react_curious, p.react_interesting, p.react_celebrate,
          u.currentJob, u.username, u.avatar, u.currentCompany,
                SUM(CASE WHEN upa.action_type = 'LOVE' THEN 1 ELSE 0 END) as loveCount,
                SUM(CASE WHEN upa.action_type = 'B' THEN 1 ELSE 0 END) as boostCount,
                SUM(CASE WHEN upa.action_type = 'INTERESTING' THEN 1 ELSE 0 END) as interestingCount,
                SUM(CASE WHEN upa.action_type = 'CURIOUS' THEN 1 ELSE 0 END) as curiousCount,
                SUM(CASE WHEN upa.action_type = 'LIKE' THEN 1 ELSE 0 END) as likeCount,
                SUM(CASE WHEN upa.action_type = 'CELEBRATE' THEN 1 ELSE 0 END) as celebrateCount
          FROM posts p
          INNER JOIN users u ON p.user_id = u.id
          LEFT JOIN userPostActions upa ON p.id = upa.post_id
          WHERE p.deleted = 0
          GROUP BY p.id, p.created_at, p.deleted, u.currentCompany, p.title, p.content, p.link, p.communities_id, u.username, u.avatar, u.currentJob, p.react_like, p.react_love, p.react_curious, p.react_interesting, p.react_celebrate
        ) AS SubQuery
        ORDER BY (loveCount + boostCount + interestingCount + curiousCount + likeCount + celebrateCount) / NULLIF(DATEDIFF(hour, created_at, GETDATE()), 0) DESC
      `;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getPostData: async (postId) => {
    try {
      const result = await sql.query`
        SELECT p.id, p.created_at, p.deleted, p.title, p.content, p.link, p.communities_id, p.link_description, p.link_image, p.link_title, p.react_like, p.react_love, p.react_curious, p.react_interesting, p.react_celebrate, p.post_type,
                u.username, u.id as user_id, u.avatar, 
                SUM(CASE WHEN upa.action_type = 'LOVE' THEN 1 ELSE 0 END) as loveCount,
                SUM(CASE WHEN upa.action_type = 'B' THEN 1 ELSE 0 END) as boostCount,
                SUM(CASE WHEN upa.action_type = 'INTERESTING' THEN 1 ELSE 0 END) as interestingCount,
                SUM(CASE WHEN upa.action_type = 'CURIOUS' THEN 1 ELSE 0 END) as curiousCount,
                SUM(CASE WHEN upa.action_type = 'LIKE' THEN 1 ELSE 0 END) as likeCount,
                SUM(CASE WHEN upa.action_type = 'CELEBRATE' THEN 1 ELSE 0 END) as celebrateCount
        FROM posts p
        INNER JOIN users u ON p.user_id = u.id
        LEFT JOIN userPostActions upa ON p.id = upa.post_id
        WHERE p.id = ${postId}
        GROUP BY p.id, p.created_at, p.deleted, u.username, p.title, p.content, p.link, p.communities_id, p.link_description, p.link_image, p.link_title, p.react_like, p.react_love, p.react_curious, p.react_interesting, p.react_celebrate, u.avatar, u.id, p.post_type
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

  getAllCommunities: async () => {
    try {
      const result = await sql.query`
        SELECT id, name, mini_icon, shortname FROM communities WHERE PrivacySetting = 'Public'
      `;
      return result.recordset;
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
        SELECT t.* FROM tags t
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
      const query = `SELECT * FROM users WHERE github_url = '${githubUsername}'`;
      const result = await sql.query(query);

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

  getGitHubRepoPreview: async (url) => {
    const isGitHubUrl = /^https?:\/\/github\.com\/.+\/.+/.test(url);
    if (!isGitHubUrl) {
      throw new Error("URL must be a GitHub repository URL");
    }

    // Extract the repository's owner and name from the URL
    const [, owner, repo] = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);

    try {
      // Check if recent data (within the last 30 minutes) already exists in the GitHubRepoData table
      const existingDataQuery = `
      SELECT *, DATEDIFF(minute, time_fetched, GETDATE()) AS time_diff
      FROM GitHubRepoData
      WHERE repo_url = '${url}'
    `;
      const existingDataResult = await sql.query(existingDataQuery);

      // Only fetch data from GitHub API if no recent data is available in your database
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
      const commitsUrl = `${apiUrl}/commits`;
      const repoResponse = await axios.get(apiUrl, {
        headers: { "User-Agent": "request" },
        timeout: 5000,
      });
      const commitsResponse = await axios.get(commitsUrl, {
        headers: { "User-Agent": "request" },
        params: { per_page: 5 },
        timeout: 5000,
      });

      if (repoResponse.status !== 200 || commitsResponse.status !== 200) {
        throw new Error(
          `Request to GitHub API failed with status: ${repoResponse.status} or ${commitsResponse.status}`
        );
      }

      const repoData = repoResponse.data;
      const commitsData = commitsResponse.data;
      const rawRepoJson = JSON.stringify(repoData);
      const rawCommitsJson = JSON.stringify(commitsData);

      if (existingDataResult.recordset.length > 0) {
        // Data exists, so update it with the new data from GitHub if it's older than 30 minutes
        const updateQuery = `
        UPDATE GitHubRepoData
        SET repo_name = '${repoData.name.replace(/'/g, "''")}',
            raw_json = '${rawRepoJson.replace(/'/g, "''")}',
            raw_commits_json = '${rawCommitsJson.replace(/'/g, "''")}',
            time_fetched = GETDATE()
        WHERE repo_url = '${url}'
      `;
        await sql.query(updateQuery);
      } else {
        // No existing data, insert new data into GitHubRepoData table
        const insertQuery = `
        INSERT INTO GitHubRepoData (id, repo_url, repo_name, raw_json, raw_commits_json, time_fetched)
        VALUES ('${repoData.id}', '${url}', '${repoData.name.replace(
          /'/g,
          "''"
        )}', '${rawRepoJson.replace(/'/g, "''")}', '${rawCommitsJson.replace(
          /'/g,
          "''"
        )}', GETDATE())
      `;
        await sql.query(insertQuery);
      }
      return {
        id: repoData.id,
        repo_url: repoData.html_url,
        repo_name: repoData.name,
        raw_json: rawRepoJson,
        raw_commits_json: rawCommitsJson,
        time_fetched: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Error fetching GitHub repository data:", error);
      throw error; // Changed to rethrow the error to make error handling more consistent
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
