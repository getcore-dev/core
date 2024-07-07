const sql = require('mssql');
const crypto = require('crypto');
const notificationQueries = require('../queries/notificationQueries');
const utilFunctions = require('../utils/utilFunctions');
const { findById } = require('../queries/userQueries');

class Comment {
  constructor(data) {
    this.id = data.id;
    this.postId = data.post_id;
    this.userId = data.user_id;
    this.comment = data.comment;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.deleted = data.deleted || false;
    this.isPinned = data.isPinned || false;
    this.parentCommentId = data.parent_comment_id || null;
  }

  static generateUniqueId() {
    return `${Date.now().toString(36)}-${crypto
      .randomBytes(3)
      .toString('hex')}`;
  }

  static async create(postId, userId, commentText) {
    try {
      const commentId = Comment.generateUniqueId();
      await sql.query`
        INSERT INTO comments (id, post_id, user_id, comment) 
        VALUES (${commentId}, ${postId}, ${userId}, ${commentText})`;

      const result =
        await sql.query`SELECT user_id FROM posts WHERE id = ${postId}`;
      if (result.recordset.length > 0) {
        const originalPostAuthorId = result.recordset[0].user_id;
        if (originalPostAuthorId !== userId) {
          const username = await findById(userId).then((user) => user.username);
          await notificationQueries.createNotification(
            userId,
            originalPostAuthorId,
            'NEW_COMMENT',
            postId
          );
        }
        await Comment.interact(postId, commentId, userId, 'LIKE');
      }

      return commentId;
    } catch (err) {
      console.error('Database insert error:', err);
      throw err;
    }
  }

  static async getById(commentId) {
    try {
      const result =
        await sql.query`SELECT * FROM comments WHERE id = ${commentId}`;
      return result.recordset[0] ? new Comment(result.recordset[0]) : null;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }

  static async getByPostId(postId) {
    try {
      const result =
        await sql.query`SELECT * FROM comments WHERE post_id = ${postId} AND deleted = 0`;
      return result.recordset.map((comment) => new Comment(comment));
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }

  async save() {
    try {
      await sql.query`
        UPDATE comments 
        SET comment = ${this.comment}, 
            updated_at = GETDATE(), 
            isPinned = ${this.isPinned}
        WHERE id = ${this.id}`;
      return true;
    } catch (err) {
      console.error('Database update error:', err);
      return false;
    }
  }

  async delete() {
    try {
      const result =
        await sql.query`SELECT * FROM comments WHERE parent_comment_id = ${this.id}`;
      if (result.recordset.length > 0) {
        await sql.query`
          UPDATE comments 
          SET comment = '[deleted]', deleted = 1
          WHERE id = ${this.id}`;
      } else {
        await sql.query`DELETE FROM comments WHERE id = ${this.id}`;
      }
      await sql.query`DELETE FROM userCommentActions WHERE comment_id = ${this.id}`;
      this.deleted = true;
      return true;
    } catch (err) {
      console.error('Database delete error:', err);
      throw err;
    }
  }

  async togglePin() {
    try {
      this.isPinned = !this.isPinned;
      await sql.query`
        UPDATE comments 
        SET isPinned = ${this.isPinned} 
        WHERE id = ${this.id}`;
      return this.isPinned;
    } catch (err) {
      console.error('Database update error:', err);
      throw err;
    }
  }

  static async interact(postId, commentId, userId, actionType) {
    try {
      const validActions = [
        'LOVE',
        'LIKE',
        'CURIOUS',
        'DISLIKE',
      ];
      if (!validActions.includes(actionType)) {
        throw new Error('Invalid action type');
      }

      let dbActionType = actionType === 'BOOST' ? 'B' : actionType;

      const userAction = await sql.query`
        SELECT action_type 
        FROM userCommentActions 
        WHERE user_id = ${userId} AND comment_id = ${commentId}`;

      let userReaction = null;

      if (userAction.recordset.length === 0) {
        const commentExists = await sql.query`
          SELECT * FROM comments WHERE id = ${commentId} AND post_id = ${postId}`;
        const userExists = await sql.query`
          SELECT * FROM users WHERE id = ${userId}`;

        if (
          commentExists.recordset.length === 0 ||
          userExists.recordset.length === 0
        ) {
          throw new Error('Comment or User does not exist');
        }

        await sql.query`
          INSERT INTO userCommentActions (user_id, comment_id, post_id, action_type, action_timestamp) 
          VALUES (${userId}, ${commentId}, ${postId}, ${dbActionType}, GETDATE())`;
        userReaction = actionType;
      } else if (userAction.recordset[0].action_type !== dbActionType) {
        await sql.query`
          UPDATE userCommentActions 
          SET action_type = ${dbActionType}
          WHERE user_id = ${userId} AND comment_id = ${commentId}`;
        userReaction = actionType;
      } else {
        await sql.query`
          DELETE FROM userCommentActions 
          WHERE user_id = ${userId} AND comment_id = ${commentId}`;
        userReaction = null;
      }

      const reactionCounts = await sql.query`
        SELECT action_type, COUNT(*) as count 
        FROM userCommentActions 
        WHERE comment_id = ${commentId}
        GROUP BY action_type`;

      const reactionsMap = reactionCounts.recordset.reduce((acc, row) => {
        acc[row.action_type === 'B' ? 'BOOST' : row.action_type] = row.count;
        return acc;
      }, {});

      validActions.forEach((action) => {
        if (!reactionsMap[action]) {
          reactionsMap[action] = 0;
        }
      });

      const totalReactions = Object.values(reactionsMap).reduce(
        (a, b) => a + b,
        0
      );

      return { userReaction, totalReactions, reactionsMap };
    } catch (err) {
      console.error('Database update error:', err);
      throw err;
    }
  }

  static async addReply(parentCommentId, userId, replyText) {
    try {
      const replyId = Comment.generateUniqueId();
      await sql.query`
        INSERT INTO comments (id, post_id, user_id, comment, parent_comment_id) 
        SELECT ${replyId}, post_id, ${userId}, ${replyText}, ${parentCommentId}
        FROM comments 
        WHERE id = ${parentCommentId}`;

      const result =
        await sql.query`SELECT user_id, post_id FROM comments WHERE id = ${parentCommentId}`;
      if (result.recordset.length > 0) {
        const originalCommentAuthorId = result.recordset[0].user_id;
        const postId = result.recordset[0].post_id;

        if (originalCommentAuthorId !== userId) {
          const username = await findById(userId).then((user) => user.username);
          await notificationQueries.createNotification(
            userId,
            originalCommentAuthorId,
            'NEW_COMMENT',
            postId
          );
        }
        await Comment.interact(postId, replyId, userId, 'LIKE');
      }

      return replyId;
    } catch (err) {
      console.error('Database insert error:', err);
      throw err;
    }
  }

  static async removeDuplicateActions() {
    try {
      await sql.query`
        WITH cte AS (
          SELECT *, ROW_NUMBER() OVER (PARTITION BY user_id, comment_id, action_type ORDER BY action_timestamp DESC) AS rn
          FROM userCommentActions
        )
        DELETE FROM cte WHERE rn > 1`;
    } catch (err) {
      console.error('Database delete error:', err);
      throw err;
    }
  }
}

module.exports = Comment;
