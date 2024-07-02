const sql = require("mssql");
const crypto = require("crypto");
const tagQueries = require("../queries/tagsQueries");

class Post {
  constructor(data) {
    this.id = data.id;
    this.userId = data.user_id;
    this.title = data.title;
    this.content = data.content;
    this.link = data.link || '';
    this.communityId = data.communities_id;
    this.postType = data.post_type;
    this.views = data.views || 0;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.deleted = data.deleted || false;
    this.isLocked = data.isLocked || false;
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
      return result.recordset.map(post => new Post(post));
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  static async getById(postId) {
    try {
      const result = await sql.query`SELECT * FROM posts WHERE id = ${postId} AND deleted = 0`;
      return result.recordset[0] ? new Post(result.recordset[0]) : null;
    } catch (err) {
      console.error("Database query error:", err);
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
      return result.recordset.map(post => new Post(post));
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  static async getByCommunity(communityId) {
    try {
      const result = await sql.query`
        SELECT p.*, u.username, u.avatar, 
        (SELECT COUNT(*) FROM userPostActions upa WHERE upa.post_id = p.id) AS totalReactionCount,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS commentCount
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE p.communities_id = ${communityId} AND p.deleted = 0
        ORDER BY p.created_at DESC`;
      return result.recordset.map(post => new Post(post));
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  static async create(userId, title, content, link = "", communityId, tags, postType) {
    if (typeof link !== "string") {
      throw new Error("Link must be a string");
    }

    if (!Array.isArray(tags)) {
      tags = tags.split(",").map((tag) => tag.trim());
    }

    try {
      const uniqueId = Post.generateUniqueId();
      await sql.query`
        INSERT INTO posts (id, user_id, title, content, link, communities_id, post_type, views) 
        VALUES (${uniqueId}, ${userId}, ${title}, ${content}, ${link}, ${communityId}, ${postType}, 1)`;

      if (tags && tags.length > 0) {
        for (const tag of tags) {
          let tagId;
          const tagRecord = await sql.query`SELECT id FROM tags WHERE name = ${tag}`;
          if (tagRecord.recordset.length > 0) {
            tagId = tagRecord.recordset[0].id;
          } else {
            const newTag = await sql.query`INSERT INTO tags (name) OUTPUT INSERTED.id VALUES (${tag})`;
            tagId = newTag.recordset[0].id;
          }
          await sql.query`INSERT INTO post_tags (post_id, tag_id) VALUES (${uniqueId}, ${tagId})`;
        }
      }

      await sql.query`INSERT INTO UserPostActions (post_id, user_id, action_type) VALUES (${uniqueId}, ${userId}, 'B')`;

      return uniqueId;
    } catch (err) {
      console.error("Database insert error:", err);
      throw err;
    }
  }

  async save() {
    try {
      await sql.query`
        UPDATE posts 
        SET title = ${this.title}, 
            content = ${this.content}, 
            link = ${this.link}, 
            updated_at = GETDATE() 
        WHERE id = ${this.id} AND deleted = 0`;
      return true;
    } catch (err) {
      console.error("Database update error:", err);
      return false;
    }
  }

  async delete() {
    try {
      await sql.query`UPDATE posts SET deleted = 1 WHERE id = ${this.id}`;
      this.deleted = true;
      return true;
    } catch (err) {
      console.error("Database delete error:", err);
      throw err;
    }
  }

  async toggleLock() {
    try {
      this.isLocked = !this.isLocked;
      await sql.query`UPDATE posts SET isLocked = ${this.isLocked} WHERE id = ${this.id}`;
      return { message: "Post locked/unlocked", isLocked: this.isLocked };
    } catch (err) {
      console.error("Database update error:", err);
      throw err;
    }
  }

  async incrementViews() {
    try {
      const result = await sql.query`
        UPDATE posts 
        SET views = CASE 
          WHEN views IS NULL OR views < 0 THEN 1 
          ELSE views + 1 
        END
        WHERE id = ${this.id}
        OUTPUT INSERTED.views`;
      this.views = result.recordset[0].views;
      return this.views;
    } catch (err) {
      console.error("Database update error:", err);
      throw err;
    }
  }

  static async interact(postId, userId, actionType) {
    try {
      const validActions = ["LOVE", "LIKE", "CURIOUS", "INTERESTING", "CELEBRATE", "BOOST"];
      if (!validActions.includes(actionType)) {
        throw new Error("Invalid action type");
      }

      let dbActionType = actionType === "BOOST" ? "B" : actionType;

      const userAction = await sql.query`
        SELECT action_type 
        FROM userPostActions 
        WHERE user_id = ${userId} AND post_id = ${postId}`;

      let userReaction = null;

      if (userAction.recordset.length === 0) {
        await sql.query`
          INSERT INTO userPostActions (user_id, post_id, action_type) 
          VALUES (${userId}, ${postId}, ${dbActionType})`;
        userReaction = actionType;
      } else if (userAction.recordset[0].action_type !== dbActionType) {
        await sql.query`
          UPDATE userPostActions 
          SET action_type = ${dbActionType}
          WHERE user_id = ${userId} AND post_id = ${postId}`;
        userReaction = actionType;
      } else {
        await sql.query`
          DELETE FROM userPostActions 
          WHERE user_id = ${userId} AND post_id = ${postId}`;
        userReaction = null;
      }

      const reactionCounts = await sql.query`
        SELECT action_type, COUNT(*) as count 
        FROM userPostActions 
        WHERE post_id = ${postId}
        GROUP BY action_type`;

      const reactionsMap = reactionCounts.recordset.reduce((acc, row) => {
        acc[row.action_type] = row.count;
        return acc;
      }, {});

      validActions.forEach((action) => {
        if (!reactionsMap[action] && !(action === "BOOST" && reactionsMap["B"])) {
          reactionsMap[action] = 0;
        } else if (action === "BOOST" && reactionsMap["B"]) {
          reactionsMap[action] = reactionsMap["B"];
          delete reactionsMap["B"];
        }
      });

      return { userReaction, reactionsMap };
    } catch (err) {
      console.error("Database update error:", err);
      throw err;
    }
  }

  static async getTags(postId) {
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
  }

  static async getAllTags() {
    try {
      const result = await sql.query`SELECT * FROM tags`;
      return result.recordset;
    } catch (err) {
      return JSON.stringify(err);
    }
  }

  static async removeDuplicateActions() {
    try {
      await sql.query`
        WITH cte AS (
          SELECT *, ROW_NUMBER() OVER (PARTITION BY user_id, post_id, action_type ORDER BY action_timestamp DESC) AS rn
          FROM userPostActions
        )
        DELETE FROM cte WHERE rn > 1`;
    } catch (err) {
      console.error("Database delete error:", err);
      throw err;
    }
  }

  static async getUserInteraction(postId, userId) {
    try {
      const result = await sql.query`
        SELECT action_type 
        FROM userPostActions 
        WHERE user_id = ${userId} AND post_id = ${postId}`;

      if (result.recordset.length === 0) {
        return "";
      } else {
        let actionType = result.recordset[0].action_type;
        return actionType === "B" ? "BOOST" : actionType;
      }
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  // Additional methods can be added here as needed
}

module.exports = Post;