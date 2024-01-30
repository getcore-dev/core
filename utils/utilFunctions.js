  "use strict";
const puppeteer = require("puppeteer-extra");
const pluginStealth = require("puppeteer-extra-plugin-stealth");
const util = require("util");
const request = util.promisify(require("request"));
const getUrls = require("get-urls");
const isBase64 = require("is-base64");
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
        GROUP BY p.id, p.created_at, p.deleted, u.username, p.title, p.content, p.link, p.communities_id, u.avatar, u.currentJob,p.react_like, p.react_love, p.react_curious, p.react_interesting, p.react_celebrate
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
        SELECT p.id, p.created_at, p.deleted, p.title, p.content, p.link, p.communities_id,
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
        GROUP BY p.id, p.created_at, p.deleted, u.username, p.title, p.content, p.link, p.communities_id
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
  getCommentsForPost: async (postId) => {
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

  getLinkPreview: async (uri, puppeteerArgs = [], puppeteerAgent = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)", executablePath) => {
    puppeteer.use(pluginStealth());

    const urlImageIsAccessible = async (url) => {
      const correctedUrls = getUrls(url);
  if (isBase64(url, { allowMime: true })) {
    return true;
  }
  if (correctedUrls.size !== 0) {
    const urlResponse = await request(correctedUrls.values().next().value);
    const contentType = urlResponse.headers["content-type"];
    return new RegExp("image/*").test(contentType);
  }
    };

    const getImg = async (page, uri) => {
      const img = await page.evaluate(async () => {
    const ogImg = document.querySelector('meta[property="og:image"]');
    if (
      ogImg != null &&
      ogImg.content.length > 0 &&
      (await urlImageIsAccessible(ogImg.content))
    ) {
      return ogImg.content;
    }
    const imgRelLink = document.querySelector('link[rel="image_src"]');
    if (
      imgRelLink != null &&
      imgRelLink.href.length > 0 &&
      (await urlImageIsAccessible(imgRelLink.href))
    ) {
      return imgRelLink.href;
    }
    const twitterImg = document.querySelector('meta[name="twitter:image"]');
    if (
      twitterImg != null &&
      twitterImg.content.length > 0 &&
      (await urlImageIsAccessible(twitterImg.content))
    ) {
      return twitterImg.content;
    }

    let imgs = Array.from(document.getElementsByTagName("img"));
    if (imgs.length > 0) {
      imgs = imgs.filter((img) => {
        let addImg = true;
        if (img.naturalWidth > img.naturalHeight) {
          if (img.naturalWidth / img.naturalHeight > 3) {
            addImg = false;
          }
        } else {
          if (img.naturalHeight / img.naturalWidth > 3) {
            addImg = false;
          }
        }
        if (img.naturalHeight <= 50 || img.naturalWidth <= 50) {
          addImg = false;
        }
        return addImg;
      });
      if (imgs.length > 0) {
        imgs.forEach((img) =>
          img.src.indexOf("//") === -1
            ? (img.src = `${new URL(uri).origin}/${img.src}`)
            : img.src
        );
        return imgs[0].src;
      }
    }
    return null;
  });
  return img;
    };

    const getTitle = async (page) => {
      const title = await page.evaluate(() => {
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle != null && ogTitle.content.length > 0) {
      return ogTitle.content;
    }
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle != null && twitterTitle.content.length > 0) {
      return twitterTitle.content;
    }
    const docTitle = document.title;
    if (docTitle != null && docTitle.length > 0) {
      return docTitle;
    }
    const h1El = document.querySelector("h1");
    const h1 = h1El ? h1El.innerHTML : null;
    if (h1 != null && h1.length > 0) {
      return h1;
    }
    const h2El = document.querySelector("h2");
    const h2 = h2El ? h2El.innerHTML : null;
    if (h2 != null && h2.length > 0) {
      return h2;
    }
    return null;
  });
  return title;
    };

    const getDescription = async (page) => {
 const description = await page.evaluate(() => {
    const ogDescription = document.querySelector(
      'meta[property="og:description"]'
    );
    if (ogDescription != null && ogDescription.content.length > 0) {
      return ogDescription.content;
    }
    const twitterDescription = document.querySelector(
      'meta[name="twitter:description"]'
    );
    if (twitterDescription != null && twitterDescription.content.length > 0) {
      return twitterDescription.content;
    }
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription != null && metaDescription.content.length > 0) {
      return metaDescription.content;
    }
    let paragraphs = document.querySelectorAll("p");
    let fstVisibleParagraph = null;
    for (let i = 0; i < paragraphs.length; i++) {
      if (
        // if object is visible in dom
        paragraphs[i].offsetParent !== null &&
        !paragraphs[i].childElementCount != 0
      ) {
        fstVisibleParagraph = paragraphs[i].textContent;
        break;
      }
    }
    return fstVisibleParagraph;
  });
  return description;
    };

    const getDomainName = async (page, uri) => {
      const domainName = await page.evaluate(() => {
    const canonicalLink = document.querySelector("link[rel=canonical]");
    if (canonicalLink != null && canonicalLink.href.length > 0) {
      return canonicalLink.href;
    }
    const ogUrlMeta = document.querySelector('meta[property="og:url"]');
    if (ogUrlMeta != null && ogUrlMeta.content.length > 0) {
      return ogUrlMeta.content;
    }
    return null;
  });
  return domainName != null
    ? new URL(domainName).hostname.replace("www.", "")
    : new URL(uri).hostname.replace("www.", "");
    };

    const getFavicon = async (page, uri) => {
      const noLinkIcon = `${new URL(uri).origin}/favicon.ico`;
  if (await urlImageIsAccessible(noLinkIcon)) {
    return noLinkIcon;
  }

  const favicon = await page.evaluate(async () => {
    const icon16Sizes = document.querySelector('link[rel=icon][sizes="16x16"]');
    if (
      icon16Sizes &&
      icon16Sizes.href.length > 0 &&
      (await urlImageIsAccessible(icon16Sizes.href))
    ) {
      return icon16Sizes.href;
    }

    const shortcutIcon = document.querySelector('link[rel="shortcut icon"]');
    if (
      shortcutIcon &&
      shortcutIcon.href.length > 0 &&
      (await urlImageIsAccessible(shortcutIcon.href))
    ) {
      return shortcutIcon.href;
    }

    const icons = document.querySelectorAll("link[rel=icon]");
    for (let i = 0; i < icons.length; i++) {
      if (
        icons[i] &&
        icons[i].href.length > 0 &&
        (await urlImageIsAccessible(icons[i].href))
      ) {
        return icons[i].href;
      }
    }

    const appleTouchIcons = document.querySelectorAll('link[rel="apple-touch-icon"],link[rel="apple-touch-icon-precomposed"]');
    for (let i = 0; i < appleTouchIcons.length; i ++) {
      if (
        appleTouchIcons[i] &&
        appleTouchIcons[i].href.length > 0 &&
        (await urlImageIsAccessible(appleTouchIcons[i].href))
      ) {
        return appleTouchIcons[i].href;
      }
    }

    return null;
  })

  return favicon;
    };

    const params = {
      headless: true,
      args: [...puppeteerArgs],
    };
    if (executablePath) {
      params["executablePath"] = executablePath;
    }

    const browser = await puppeteer.launch(params);
    const page = await browser.newPage();
    page.setUserAgent(puppeteerAgent);

    await page.goto(uri);
    await page.exposeFunction("request", request);
    await page.exposeFunction("urlImageIsAccessible", urlImageIsAccessible);

    const preview = {};
    preview.title = await getTitle(page);
    preview.description = await getDescription(page);
    preview.domain = await getDomainName(page, uri);
    preview.img = await getImg(page, uri);
    preview.favicon = await getFavicon(page, uri);

    await browser.close();
    return preview;
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
