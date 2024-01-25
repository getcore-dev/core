const sql = require("mssql");
const crypto = require("crypto");

const notificationQueries = {
  // Fetch all unread notifications for a specific user
  getUnreadNotifications: async (userId) => {
    try {
      const result = await sql.query`
        SELECT * FROM notifications 
        WHERE userId = ${userId} AND isRead = 0 
        ORDER BY createdAt DESC`;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  // Mark a specific notification as read
  markAsRead: async (notificationId) => {
    try {
      await sql.query`
        UPDATE notifications 
        SET isRead = 1 
        WHERE id = ${notificationId}`;
    } catch (err) {
      console.error("Database update error:", err);
      throw err;
    }
  },

  // Create a new notification
  createNotification: async (userId, type, message) => {
    try {
      const createdAt = new Date();
      await sql.query`INSERT INTO notifications (userId, type, message, isRead, createdAt) VALUES (${userId}, ${type}, ${message}, 0, ${createdAt})`;
    } catch (err) {
      console.error("Database insert error:", err);
      throw err;
    }
  },

  // Fetch all notifications for a specific user
  getAllNotifications: async (userId) => {
    try {
      const result = await sql.query`
        SELECT * FROM notifications 
        WHERE userId = ${userId} 
        ORDER BY createdAt DESC`;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  // Delete a specific notification
  deleteNotification: async (notificationId) => {
    try {
      await sql.query`
        DELETE FROM notifications 
        WHERE id = ${notificationId}`;
    } catch (err) {
      console.error("Database delete error:", err);
      throw err;
    }
  },

  // Mark all notifications as read for a specific user
  markAllAsRead: async (userId) => {
    try {
      await sql.query`
        UPDATE notifications 
        SET isRead = 1 
        WHERE userId = ${userId}`;
    } catch (err) {
      console.error("Database update error:", err);
      throw err;
    }
  },
};

module.exports = notificationQueries;
