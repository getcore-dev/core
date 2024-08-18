const sql = require('mssql');
const crypto = require('crypto');
const notificationQueries = require('./notificationQueries');
const utilFunctions = require('../utils/utilFunctions');
const { findById } = require('./userQueries');

function GETDATE() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

const commentQueries = {
  removeDuplicateActions: async () => {
    try {
      const result = await sql.query`
        WITH cte AS (
          SELECT *, ROW_NUMBER() OVER (PARTITION BY user_id, comment_id, action_type ORDER BY action_timestamp DESC) AS rn
          FROM userCommentActions
        )
        DELETE FROM cte WHERE rn > 1`;
    } catch (err) {
      console.error('Database delete error:', err);
      throw err; // Rethrow the error for the caller to handle
    }
  },

  togglePinComment: async (commentId) => {
    try {
      // Fetch the current pinned status of the comment
      const result =
        await sql.query`SELECT isPinned FROM comments WHERE id = ${commentId}`;
      if (result.recordset.length === 0) {
        throw new Error(`Comment with id ${commentId} does not exist`);
      }

      // Toggle the pinned status
      const newPinnedStatus = !result.recordset[0].isPinned;
      await sql.query`
        UPDATE comments 
        SET isPinned = ${newPinnedStatus} 
        WHERE id = ${commentId}`;
    } catch (err) {
      console.error('Database update error:', err);
      throw err; // Rethrow the error for the caller to handle
    }
  },

  addComment: async (postId, userId, commentText) => {
    try {
      // Insert the comment into the database
      const commentId = `${Date.now().toString(36)}-${crypto
        .randomBytes(3)
        .toString('hex')}`;
      await sql.query`INSERT INTO comments (id, post_id, user_id, comment) VALUES (${commentId}, ${postId}, ${userId}, ${commentText})`;

      // Fetch the user ID of the original post's author
      const result =
        await sql.query`SELECT user_id FROM posts WHERE id = ${postId}`;
      if (result.recordset.length > 0) {
        const originalPostAuthorId = result.recordset[0].user_id;

        // Create a notification for the original post author
        if (originalPostAuthorId !== userId) {
          const username = await findById(userId).then((user) => user.username);
          // Check to avoid notifying if commenting on own post
          await notificationQueries.createNotification(
            userId,
            originalPostAuthorId,
            'NEW_COMMENT',
            postId
          );
        }

        // LIKE your comment by default
        await commentQueries.interactWithComment(
          postId,
          commentId,
          userId,
          'LIKE'
        );
      }

      return commentId;
    } catch (err) {
      console.error('Database insert error:', err);
      throw err; // Rethrow the error for the caller to handle
    }
  },

  interactWithComment: async (postId, commentId, userId, actionType) => {
    try {
      const validActions = ['LOVE', 'LIKE', 'CURIOUS', 'DISLIKE'];
      if (!validActions.includes(actionType)) {
        throw new Error('Invalid action type');
      }

      let dbActionType = actionType === 'BOOST' ? 'B' : actionType;

      // Check if the user has already interacted with the comment
      const userAction = await sql.query`
        SELECT action_type 
        FROM userCommentActions 
        WHERE user_id = ${userId} AND comment_id = ${commentId}`;

      let userReaction = null;

      if (userAction.recordset.length === 0) {
        // Check if comments and user exist
        const commentExists = await sql.query`
          SELECT * FROM comments WHERE id = ${commentId} AND post_id = ${postId}`;
        const userExists = await sql.query`
          SELECT * FROM users WHERE id = ${userId}`;

        if (commentExists.recordset.length === 0) {
          throw new Error(
            `Comment with id ${commentId} for post id ${postId} does not exist`
          );
        }

        if (userExists.recordset.length === 0) {
          throw new Error(`User with id ${userId} does not exist`);
        }

        // If no existing interaction, insert new action
        await sql.query`
          INSERT INTO userCommentActions (user_id, comment_id, action_type, action_timestamp) 
          VALUES (${userId}, ${commentId}, ${dbActionType}, GETDATE())`;
        userReaction = actionType;
      } else if (userAction.recordset[0].action_type !== dbActionType) {
        // If existing interaction is different, update action
        await sql.query`
          UPDATE userCommentActions 
          SET action_type = ${dbActionType}
          WHERE user_id = ${userId} AND comment_id = ${commentId}`;
        userReaction = actionType;
      } else {
        // If user is repeating the same action, remove the action
        await sql.query`
          DELETE FROM userCommentActions 
          WHERE user_id = ${userId} AND comment_id = ${commentId}`;
        userReaction = null;
      }

      // Recalculate and update the reactions count for the comment
      const reactionCounts = await sql.query`
        SELECT action_type, COUNT(*) as count 
        FROM userCommentActions 
        WHERE comment_id = ${commentId}
        GROUP BY action_type`;

      // Convert the result to a map of reaction names to their counts
      const reactionsMap = reactionCounts.recordset.reduce((acc, row) => {
        acc[row.action_type === 'B' ? 'BOOST' : row.action_type] = row.count;
        return acc;
      }, {});

      // Ensure all reaction types are present in the map, even if count is 0
      validActions.forEach((action) => {
        if (!reactionsMap[action]) {
          reactionsMap[action] = 0;
        }
      });

      // Calculate total reactions
      const totalReactions = Object.values(reactionsMap).reduce(
        (a, b) => a + b,
        0
      );

      return {
        userReaction,
        totalReactions,
        reactionsMap,
      };
    } catch (err) {
      console.error('Database update error:', err);
      throw err;
    }
  },

  getCommentsByPostId: async (postId) => {
    try {
      const result =
        await sql.query`SELECT * FROM comments WHERE post_id = ${postId} AND deleted = 0`;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err; // Rethrow the error for the caller to handle
    }
  },

  deleteCommentById: async (commentId) => {
    try {
      // check if comments exist where parent_comment_id = commentId
      const result = await sql.query`
        SELECT * FROM comments WHERE parent_comment_id = ${commentId}`;

      if (result.recordset.length > 0) {
        // If there are replies, set comment to deleted and user id to 0
        await sql.query`
          UPDATE comments 
          SET comment = '[deleted]',
              deleted=1,
              user_id='7d9dbdd1-1916-45e0-a4cc-b1fe942a0736'
          WHERE id = ${commentId}`;
      } else {
        // If there are no replies, delete the comment
        await sql.query`DELETE FROM userCommentActions WHERE comment_id = ${commentId}`;
        await sql.query`DELETE FROM comments WHERE id = ${commentId}`;
      }

    } catch (err) {
      console.error('Database delete error:', err);
      throw err; // Rethrow the error for the caller to handle
    }
  },

  getCommentById: async (commentId) => {
    try {
      const result =
        await sql.query`SELECT * FROM comments WHERE id = ${commentId}`;
      return result.recordset[0];
    } catch (err) {
      console.error('Database query error:', err);
      throw err; // Rethrow the error for the caller to handle
    }
  },

  addReply: async (commentId, userId, replyText) => {
    try {
      // Insert the reply into the database
      const replyId = `${Date.now().toString(36)}-${crypto
        .randomBytes(3)
        .toString('hex')}`;
      await sql.query`INSERT INTO comments (id, post_id, parent_comment_id, user_id, comment) VALUES (${replyId}, (SELECT post_id FROM comments WHERE id = ${commentId}), ${commentId}, ${userId}, ${replyText})`;

      // Fetch the user ID of the original comment author
      const result =
        await sql.query`SELECT * FROM comments WHERE id = ${commentId}`;
      if (result.recordset.length > 0) {
        const originalCommentAuthorId = result.recordset[0].user_id;
        const postId = result.recordset[0].post_id;

        // Create a notification for the original comment author
        if (originalCommentAuthorId !== userId) {
          // Check to avoid notifying if commenting on own post
          await notificationQueries.createNotification(
            userId,
            originalCommentAuthorId,
            'NEW_REPLY',
            postId
          );
        }
        await commentQueries.interactWithComment(postId, replyId, userId, 'LIKE');
      }

      // like your comment by default

      return replyId;
    } catch (err) {
      console.error('Database insert error:', err);
      throw err; // Rethrow the error for the caller to handle
    }
  }
};

module.exports = commentQueries;
