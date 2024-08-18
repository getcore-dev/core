const sql = require('mssql');
const nodemailer = require('nodemailer');

// Set up nodemailer transporter
const transporter = nodemailer.createTransport({
  host: 'smtp.mail.me.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.ICLOUD_EMAIL,
    pass: process.env.ICLOUD_EMAIL_PASS,
  },
});

// Function to send email notification
const sendEmailNotification = async (receiverUserId, type) => {
  try {
    // Fetch the receiver's email and username
    const result = await sql.query`
      SELECT email, username 
      FROM users 
      WHERE id = ${receiverUserId}`;
    const user = result.recordset[0];

    if (!user) {
      throw new Error('User not found');
    }

    // Define the email content based on the notification type
    let subject;
    let text;

    switch (type) {
    case 'NEW_MESSAGE':
      subject = 'You have a new message';
      text =
          'You have received a new message. Please check your account for more details.';
      break;
    case 'NEW_FOLLOWER':
      subject = 'You have a new follower';
      text =
          'You have a new follower. Please check your account for more details.';
      break;
    case 'NEW_REPLY':
      subject = 'New reply to your comment';
      text =
          'Someone replied to your comment. Please check your account for more details.';
      break;
    case 'NEW_COMMENT':
      subject = 'New comment on your post';
      text =
          'Someone commented on your post. Please check your account for more details.';
      break;
    case 'NEW_FEEDBACK':
      subject = '[ADMIN] New core feedback';
      text =
          'A new feedback has been submitted. Please check the feedback network for more details.';
      break;
    default:
      subject = 'You have a new notification';
      text =
          'You have received a new notification. Please check your account for more details.';
    }

    // Send the email
    const mailOptions = {
      from: '"core" <support@getcore.dev>',
      to: user.email,
      subject: subject,
      text: text,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return console.log(error);
      }
      console.log('Email sent: ' + info.response);
    });
  } catch (error) {
    console.error('Error sending email notification:', error);
  }
};

const notificationQueries = {
  // Fetch all unread notifications for a specific user
  getUnreadNotifications: async (userId) => {
    try {
      const result = await sql.query`
        SELECT notifications.*, sender.username as senderUsername, receiver.username as receiverUsername, sender.avatar as senderProfilePicture, sender.profile_border_color as senderProfileColor
        FROM notifications 
        INNER JOIN users as sender ON notifications.senderUserId = sender.id
        INNER JOIN users as receiver ON notifications.receiverUserId = receiver.id
        WHERE notifications.receiverUserId = ${userId} AND notifications.isRead = 0 
        ORDER BY notifications.createdAt DESC`;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  deleteAllNotifications: async (userId) => {
    try {
      await sql.query`
        DELETE FROM notifications
        WHERE receiverUserId = ${userId}`;
    } catch (err) {
      console.error('Database delete error:', err);
      throw err;
    }
  },


  deleteDuplicateNotifications: async (userId, type, postId) => {
    try {
      await sql.query`
        DELETE FROM notifications
        WHERE receiverUserId = ${userId} AND type = ${type} AND postId = ${postId}`;
    } catch (err) {
      console.error('Database delete error:', err);
      throw err;
    }
  },

  getUnreadNotificationCount: async (userId) => {
    try {
      const result = await sql.query`
        SELECT COUNT(*) as count
        FROM notifications
        WHERE receiverUserId = ${userId} AND isRead = 0`;
      return result.recordset[0].count;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getReadNotifications: async (userId) => {
    try {
      const result = await sql.query`
        SELECT notifications.*, sender.username as senderUsername, receiver.username as receiverUsername, sender.avatar as senderProfilePicture, sender.profile_border_color as senderProfileColor
        FROM notifications 
        INNER JOIN users as sender ON notifications.senderUserId = sender.id
        INNER JOIN users as receiver ON notifications.receiverUserId = receiver.id
        WHERE notifications.receiverUserId = ${userId} AND notifications.isRead = 1 
        ORDER BY notifications.createdAt DESC`;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
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
      console.error('Database update error:', err);
      throw err;
    }
  },


  createNotification: async (
    senderUserId,
    receiverUserId,
    type,
    postId = '',
    important_message = ''
  ) => {
    try {
      const createdAt = new Date();
      const result = await sql.query`
        SELECT * FROM notifications
        WHERE senderUserId = ${senderUserId} AND receiverUserId = ${receiverUserId} AND postId = ${postId}`;

      if (result.recordset.length > 0) {
        await sql.query`
          UPDATE notifications
          SET type = ${type}, createdAt = ${createdAt}, isRead = 0
          WHERE senderUserId = ${senderUserId} AND receiverUserId = ${receiverUserId} AND postId = ${postId}`;
      } else {
        await sql.query`
          INSERT INTO notifications (type, isRead, createdAt, receiverUserId, senderUserId, postId, important_message)
          VALUES (${type}, 0, ${createdAt}, ${receiverUserId}, ${senderUserId}, ${postId} , ${important_message})`;
      }

      await sendEmailNotification(receiverUserId, type);
    } catch (err) {
      console.error('Database operation error:', err);
      throw err;
    }
  },

  createAdminNotification: async (type, feedbackId, senderId, createdAt, important_message = '') => {
    try {
      // get all admin users
      const result = await sql.query`
        SELECT id FROM users WHERE isAdmin = 1`;
      const adminUsers = result.recordset;

      // create a notification for each admin user
      adminUsers.forEach(async (admin) => {
        await sql.query`
          INSERT INTO notifications (type, isRead, createdAt, receiverUserId, senderUserId, postId, important_message) 
          VALUES (${type}, 0, ${createdAt}, ${admin.id}, ${senderId}, ${feedbackId}, '${important_message}')`;
      });
    } catch (err) {
      console.error('Database insert error:', err);
      throw err;
    }
  },

  // delete notification if it is unread and action is undone
  deleteNotification: async (notificationId) => {
    try {
      await sql.query`
        DELETE FROM notifications 
        WHERE id = ${notificationId}`;
    } catch (err) {
      console.error('Database delete error:', err);
      throw err;
    }
  },

  // Fetch all notifications for a specific user
  getAllNotifications: async (userId) => {
    try {
      const result = await sql.query`
      SELECT notifications.*, sender.username as senderUsername, receiver.username as receiverUsername, sender.avatar as senderProfilePicture, sender.profile_border_color as senderProfileColor
      FROM notifications 
      INNER JOIN users as sender ON notifications.senderUserId = sender.id
      INNER JOIN users as receiver ON notifications.receiverUserId = receiver.id
      WHERE notifications.receiverUserId = ${userId}
      ORDER BY notifications.createdAt DESC`;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },


  // Mark all notifications as read for a specific user
  markAllAsRead: async (userId) => {
    try {
      await sql.query`
        UPDATE notifications 
        SET isRead = 1 
        WHERE receiverUserId = ${userId}`;
    } catch (err) {
      console.error('Database update error:', err);
      throw err;
    }
  },
};

module.exports = notificationQueries;
