const sql = require("mssql");
const crypto = require("crypto");
const tagQueries = require("../queries/tagsQueries");

class Post {
  constructor(data) {
    this.id = data.id;
    this.userId = data.user_id;
    this.title = data.title;
    this.content = data.content;
    this.link = data.link;
    this.communityId = data.communities_id;
    this.postType = data.post_type;
    this.views = data.views;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.deleted = data.deleted;
    this.isLocked = data.isLocked;
  }

  static generateUniqueId() {
    const timestampPart = Date.now().toString(36).slice(-4);
    const randomPart = crypto.randomBytes(2).toString("hex").slice(0, 4);
    return `${timestampPart}${randomPart}`;
  }

  static async getAll() {
    try {
      const result = await sql.query(
        "SELECT * FROM posts WHERE deleted = 0 AND communities_id != 9 ORDER BY created_at DESC"
      );
      return result.recordset.map((post) => new Post(post));
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  static async getById(postId) {
    try {
      const result =
        await sql.query`SELECT * FROM posts WHERE id = ${postId} AND deleted = 0`;
      return result.recordset[0] ? new Post(result.recordset[0]) : null;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  static async getFavoriteByPostIdAndUserId(postId, userId) {
    try {
      const result = await sql.query`
        SELECT * FROM favorites
        WHERE user_id = ${userId} AND post_id = ${postId}`;
      return result.recordset[0];
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  async toggleLock() {
    try {
      const result = await sql.query`
        SELECT isLocked FROM posts WHERE id = ${this.id}`;
      if (result.recordset.length === 0) {
        throw new Error("Post not found");
      }

      this.isLocked = !result.recordset[0].isLocked;

      await sql.query`
        UPDATE posts SET isLocked = ${this.isLocked} WHERE id = ${this.id}`;

      return { message: "Post locked/unlocked", isLocked: this.isLocked };
    } catch (err) {
      console.error("Database update error:", err);
      throw err;
    }
  }

  static async getByTag(tagId) {
    try {
      const result = await sql.query`
        SELECT p.*, u.username, u.avatar,
        (SELECT COUNT(*) FROM userPostActions upa WHERE upa.post_id = p.id) AS totalReactionCount,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS commentCount
        FROM posts p
        JOIN users u ON p.user_id = u.id
        JOIN post_tags pt ON p.id = pt.post_id
        WHERE pt.tag_id = ${tagId}`;
      return result.recordset.map((post) => new Post(post));
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  static async getTagId(tagName) {
    try {
      const result = await sql.query`
        SELECT id FROM tags WHERE name = ${tagName}`;
      return result.recordset.length > 0 ? result.recordset[0].id : null;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  async incrementViews() {
    try {
      const checkResult = await sql.query`
        SELECT COALESCE(views, 0) as views FROM posts WHERE id = ${this.id}`;

      if (checkResult.recordset.length === 0) {
        throw new Error("Post not found.");
      }

      const currentViews = checkResult.recordset[0].views;

      let updateQuery;
      if (currentViews === null || isNaN(currentViews) || currentViews < 0) {
        updateQuery = sql.query`
          UPDATE posts 
          SET views = 1
          WHERE id = ${this.id}`;
      } else {
        updateQuery = sql.query`
          UPDATE posts 
          SET views = views + 1
          WHERE id = ${this.id}`;
      }

      const result = await updateQuery;
      return result.rowsAffected[0] > 0;
    } catch (err) {
      console.error("Database update error:", err);
      throw err;
    }
  }
  static async incrementViews(postId) {
    try {
      const checkResult = await sql.query`
        SELECT COALESCE(views, 0) as views FROM posts WHERE id = ${postId}`;

      if (checkResult.recordset.length === 0) {
        throw new Error("Post not found.");
      }

      const currentViews = checkResult.recordset[0].views;

      let updateQuery;
      if (currentViews === null || isNaN(currentViews) || currentViews < 0) {
        updateQuery = sql.query`
          UPDATE posts 
          SET views = 1
          WHERE id = ${postId}`;
      } else {
        updateQuery = sql.query`
          UPDATE posts 
          SET views = views + 1
          WHERE id = ${postId}`;
      }

      const result = await updateQuery;
      return result.rowsAffected[0] > 0;
    } catch (err) {
      console.error("Database update error:", err);
      throw err;
    }
  }

  static async fetchSimilarPosts(user, postId, communityId, tags, title) {
    const tagsCondition =
      tags && tags.length > 0
        ? `t.name IN (${tags.map((tag) => `'${tag}'`).join(",")})`
        : "1=1";
    let userReactionSubquery = "";
    if (user) {
      userReactionSubquery = `, ( SELECT TOP 1 upa.action_type FROM userPostActions upa WHERE upa.post_id = p.id AND upa.user_id = '${user.id}' ) AS userReaction`;
    }

    // Step 1: Find posts with matching tags, regardless of community
    let queryWithMatchingTags = `
    SELECT
      p.id, p.title, p.content, p.link, p.created_at, p.communities_id,
      u.username, u.avatar,
      c.name AS community_name, c.community_color as community_color, c.shortname as community_shortname,
      p.post_type, p.views,
      (SELECT COUNT(*) FROM userPostActions upa WHERE upa.post_id = p.id) AS totalReactionCount,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS commentCount,
      COUNT(t.name) AS tagMatchCount
      ${userReactionSubquery}
    FROM posts p
    JOIN users u ON p.user_id = u.id
    JOIN communities c ON p.communities_id = c.id
    LEFT JOIN post_tags pt ON p.id = pt.post_id
    LEFT JOIN tags t ON pt.tag_id = t.id
    WHERE p.id != '${postId}' AND p.deleted = 0 AND ${tagsCondition} AND p.communities_id != 9
    GROUP BY p.id, p.title, p.content, p.link, p.created_at, p.communities_id,
             u.username, u.avatar, c.name, p.post_type, p.views, c.community_color, c.shortname
    ORDER BY tagMatchCount DESC, p.created_at DESC
    OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY;
  `;
    const resultWithMatchingTags = await sql.query(queryWithMatchingTags);

    // If less than 5 posts with matching tags are found, fill up with random posts from any community
    let finalResults = resultWithMatchingTags.recordset;
    if (finalResults.length < 5) {
      const additionalPostsNeeded = 5 - finalResults.length;
      const excludePostIds =
        finalResults.length > 0
          ? `AND p.id NOT IN (${finalResults
              .map((post) => `'${post.id}'`)
              .join(",")})`
          : "";

      let queryWithRandomPosts = `
      SELECT TOP ${additionalPostsNeeded}
        p.id, p.title, p.content, p.link, p.created_at, p.communities_id,
        u.username, u.avatar, 
        c.name AS community_name, c.community_color as community_color, c.shortname as community_shortname,
        p.post_type, p.views,
        (SELECT COUNT(*) FROM userPostActions upa WHERE upa.post_id = p.id) AS totalReactionCount,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS commentCount
        ${userReactionSubquery}
      FROM posts p
      JOIN users u ON p.user_id = u.id
      JOIN communities c ON p.communities_id = c.id
    WHERE p.id != '${postId}' AND p.deleted = 0 AND p.communities_id != 9
        ${excludePostIds}
      ORDER BY NEWID();
    `;
      const resultWithRandomPosts = await sql.query(queryWithRandomPosts);
      finalResults = finalResults.concat(resultWithRandomPosts.recordset);
    }

    return finalResults;
  }

  static async fetchPostsByCommunity(communityId) {
    try {
      const result = await sql.query`
        SELECT p.*, u.username, u.avatar, 
        (SELECT COUNT(*) FROM userPostActions upa WHERE upa.post_id = p.id) AS totalReactionCount,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS commentCount
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE p.communities_id = ${communityId} AND p.deleted = 0
        ORDER BY p.created_at DESC`;
      return result.recordset.map((post) => new Post(post));
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  static async acceptAnswer(postId, commentId, userId) {
    try {
      // Check if the post exists
      const postResult = await sql.query`
        SELECT * FROM posts WHERE id = ${postId} AND deleted = 0`;
      if (postResult.recordset.length === 0) {
        throw new Error("Post not found");
      }

      // check if post is a question
      if (postResult.recordset[0].post_type !== "question") {
        throw new Error("Post is not a question");
      }

      // check if post is authored by the user
      if (postResult.recordset[0].user_id !== userId) {
        throw new Error("User is not the author of the post");
      }

      // check if comment exists
      const commentResult = await sql.query`
        SELECT * FROM comments WHERE id = ${commentId}`;
      if (commentResult.recordset.length === 0) {
        throw new Error("Comment not found");
      }

      // check if there is already an answer to the question
      const answerResult = await sql.query`
        SELECT * FROM QuestionSolutions WHERE OriginalPostID = ${postId}`;
      if (answerResult.recordset.length > 0) {
        // replace the accepted answer
        const result = await sql.query`
          UPDATE QuestionSolutions SET CommentID = ${commentId}, SolutionTimestamp = GETDATE() WHERE OriginalPostID = ${postId}`;
        if (result.rowsAffected[0] === 0) {
          throw new Error("Failed to accept the answer");
        }
        return true;
      }

      const result = await sql.query`
        INSERT INTO QuestionSolutions (OriginalPostID, CommentID, SolutionTimestamp) VALUES (${postId}, ${commentId}, GETDATE())`;

      if (result.rowsAffected[0] === 0) {
        throw new Error("Failed to accept the answer");
      } else {
        return true;
      }
    } catch (err) {
      console.error("Database update error:", err);
      throw err;
    }
  }

  static async getAcceptedAnswer(postId) {
    try {
      const result = await sql.query`
        SELECT * FROM QuestionSolutions WHERE OriginalPostID = ${postId}`;

      // return the actual comment
      const comment = await sql.query`
        SELECT * FROM comments WHERE id = ${result.recordset[0].CommentID}`;

      return comment.recordset[0];
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  static async edit(postId, postData) {
    const transaction = new sql.Transaction(/* [connection] */);
    try {
      await transaction.begin();
      const updateRequest = new sql.Request(transaction);

      const trimmedLink = postData.link.trim();

      await updateRequest.query`UPDATE posts SET title = ${postData.title}, content = ${postData.content}, link = ${trimmedLink}, updated_at = GETDATE() WHERE id = ${postId} AND deleted = 0`;

      const deleteTagsRequest = new sql.Request(transaction);
      await deleteTagsRequest.query`DELETE FROM post_tags WHERE post_id = ${postId}`;

      for (const tagNameOrId of postData.tags) {
        const tagRequest = new sql.Request(transaction);
        let tagId;
        // Check if tagNameOrId is an ID (integer) or a new tag name (string)
        if (isNaN(parseInt(tagNameOrId))) {
          // It's a new tag name, check if it exists or create new
          let tag = await tagQueries.findTagByName(tagNameOrId);
          if (!tag) {
            // Tag doesn't exist, create it
            tag = await tagQueries.createTag(tagNameOrId); // Adjust to ensure it returns the new tag object
            tagId = tag.id; // Assuming createTag returns the new tag object including its ID
          } else {
            tagId = tag.id; // Use existing tag ID
          }
        } else {
          // It's an existing tag ID
          tagId = tagNameOrId;
        }

        // Insert the mapping between the post and the tag using the tag ID
        const insertPostTagRequest = new sql.Request(transaction);
        await insertPostTagRequest.query`INSERT INTO post_tags (post_id, tag_id) VALUES (${postId}, ${tagId})`;
      }

      await transaction.commit();

      return true;
    } catch (err) {
      return false;
    }
  }

  static async getParentAuthorUsernameByCommentId(commentId) {
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
  }

  static async getCommentsByPostId(postId) {
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
  }

  static async create(
    userId,
    title,
    content,
    link = "",
    communityId,
    tags,
    postType
  ) {
    if (typeof link !== "string") {
      throw new Error("Link must be a string");
    }

    if (!Array.isArray(tags)) {
      tags = tags.split(",").map((tag) => tag.trim());
    }

    try {
      // Insert the post into the posts table
      const uniqueId = generateUniqueId();

      // Insert into the posts table
      await sql.query`INSERT INTO posts (id, user_id, title, content, link, communities_id, post_type, views) VALUES (${uniqueId}, ${userId}, ${title}, ${content}, ${link}, ${community_id}, ${post_type}, 1)`;

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
      await sql.query`INSERT INTO UserPostActions (post_id, user_id, action_type) VALUES (${uniqueId}, ${userId}, 'B')`;

      return uniqueId;
    } catch (err) {
      console.error("Database insert error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  }

  static async createFeedback(userId, title, attachmentUrl, body) {
    try {
      const uniqueId = generateUniqueId();

      // Insert into the posts table
      await sql.query`INSERT INTO posts (id, user_id, title, content, link, communities_id, post_type, views) VALUES (${uniqueId}, ${userId}, ${title}, ${body}, ${attachmentUrl}, 9, 'discussion', 1)`;

      return uniqueId;
    } catch (err) {
      console.error("Database insert error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  }

  async getTags() {
    try {
      const result = await sql.query`
        SELECT t.name
        FROM tags t
        JOIN post_tags pt ON t.id = pt.tag_id
        WHERE pt.post_id = ${this.id}`;
      return result.recordset.map((record) => record.name);
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  static async getAllTags() {
    try {
      const result = await sql.query`SELECT * FROM tags`;
      return result.recordset;
    } catch (err) {
      return JSON.stringify(err);
    }
  }

  async delete() {
    try {
      await sql.query`UPDATE posts SET deleted = 1 WHERE id = ${this.id}`;
      this.deleted = true;
    } catch (err) {
      console.error("Database delete error:", err);
      throw err;
    }
  }

  static async interact(postId, userId, actionType) {
    try {
      const validActions = [
        "LOVE",
        "LIKE",
        "CURIOUS",
        "INTERESTING",
        "CELEBRATE",
        "BOOST",
      ];
      if (!validActions.includes(actionType)) {
        throw new Error("Invalid action type");
      }

      let dbActionType = actionType === "BOOST" ? "B" : actionType;

      // Check if the user has already interacted with the post
      const userAction = await sql.query`
        SELECT action_type 
        FROM userPostActions 
        WHERE user_id = ${userId} AND post_id = ${postId}`;

      let userReaction = null;

      if (userAction.recordset.length === 0) {
        // If no previous interaction, insert new action
        await sql.query`
          INSERT INTO userPostActions (user_id, post_id, action_type) 
          VALUES (${userId}, ${postId}, ${dbActionType})`;
        userReaction = actionType;
      } else if (userAction.recordset[0].action_type !== dbActionType) {
        // If existing interaction is different, update action
        await sql.query`
          UPDATE userPostActions 
          SET action_type = ${dbActionType}
          WHERE user_id = ${userId} AND post_id = ${postId}`;
        userReaction = actionType;
      } else {
        // If user is repeating the same action, remove the action
        await sql.query`
          DELETE FROM userPostActions 
          WHERE user_id = ${userId} AND post_id = ${postId}`;
        userReaction = null;
      }

      // Get total reaction count for each type
      const reactionCounts = await sql.query`
        SELECT action_type, COUNT(*) as count 
        FROM userPostActions 
        WHERE post_id = ${postId}
        GROUP BY action_type`;

      // Convert the result to a map of reaction names to their counts
      const reactionsMap = reactionCounts.recordset.reduce((acc, row) => {
        acc[row.action_type] = row.count;
        return acc;
      }, {});

      // Ensure all reaction types are present in the map, even if count is 0
      validActions.forEach((action) => {
        if (
          !reactionsMap[action] &&
          !(action === "BOOST" && reactionsMap["B"])
        ) {
          reactionsMap[action] = 0;
        } else if (action === "BOOST" && reactionsMap["B"]) {
          reactionsMap[action] = reactionsMap["B"];
          delete reactionsMap["B"];
        }
      });

      return {
        userReaction,
        reactionsMap,
      };
    } catch (err) {
      console.error("Database update error:", err);
      throw err;
    }
  }

  static async removeDuplicateActions() {
    try {
      const result = await sql.query`
        WITH cte AS (
          SELECT *, ROW_NUMBER() OVER (PARTITION BY user_id, post_id, action_type ORDER BY action_timestamp DESC) AS rn
          FROM userPostActions
        )
        DELETE FROM cte WHERE rn > 1`;
    } catch (err) {
      console.error("Database delete error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  }

  static async getUserInteractions(postId, userId) {
    try {
      const result = await sql.query`
    SELECT action_type 
    FROM userPostActions 
      WHERE user_id = ${userId} AND post_id = ${postId}`;

      if (result.recordset.length === 0) {
        return "";
      } else {
        let actionType = result.recordset[0].action_type;
        if (actionType.includes("B")) {
          actionType = "BOOST";
        }
        return actionType;
      }
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  static async getCommunityById(communityId) {
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
  }
}

module.exports = Post;
