const sql = require('mssql');
const nodemailer = require('nodemailer');

class Notification {
  constructor(data) {
    this.id = data.id;
    this.type = data.type;
    this.isRead = data.isRead;
    this.createdAt = data.createdAt;
    this.receiverUserId = data.receiverUserId;
    this.senderUserId = data.senderUserId;
    this.postId = data.postId;
    this.senderUsername = data.senderUsername;
    this.receiverUsername = data.receiverUsername;
    this.senderProfilePicture = data.senderProfilePicture;
    this.senderProfileColor = data.senderProfileColor;
  }

  static transporter = nodemailer.createTransport({
    host: 'smtp.mail.me.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.ICLOUD_EMAIL,
      pass: process.env.ICLOUD_EMAIL_PASS,
    },
  });

  static async sendEmailNotification(receiverUserId, type) {
    try {
      const result = await sql.query`
        SELECT email, username 
        FROM users 
        WHERE id = ${receiverUserId}`;
      const user = result.recordset[0];

      if (!user) {
        throw new Error('User not found');
      }

      let subject, text;
      switch (type) {
      case 'NEW_MESSAGE':
        subject = 'You have a new message';
        text = 'You have received a new message. Please check your account for more details.';
        break;
      case 'NEW_COMMENT':
        subject = 'New comment on your post';
        text = 'Someone commented on your post. Please check your account for more details.';
        break;
      default:
        subject = 'You have a new notification';
        text = 'You have received a new notification. Please check your account for more details.';
      }

      const mailOptions = {
        from: '"CORE Support" <support@c-ore.dev>',
        to: user.email,
        subject: subject,
        text: text,
      };

      const info = await Notification.transporter.sendMail(mailOptions);
      console.log('Email sent: ' + info.response);
    } catch (error) {
      console.error('Error sending email notification:', error);
    }
  }

  static async getUnreadByUserId(userId) {
    try {
      const result = await sql.query`
        SELECT notifications.*, sender.username as senderUsername, receiver.username as receiverUsername, sender.avatar as senderProfilePicture, sender.profile_border_color as senderProfileColor
        FROM notifications 
        INNER JOIN users as sender ON notifications.senderUserId = sender.id
        INNER JOIN users as receiver ON notifications.receiverUserId = receiver.id
        WHERE notifications.receiverUserId = ${userId} AND notifications.isRead = 0 
        ORDER BY notifications.createdAt DESC`;
      return result.recordset.map(notification => new Notification(notification));
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }

  static async getReadByUserId(userId) {
    try {
      const result = await sql.query`
        SELECT notifications.*, sender.username as senderUsername, receiver.username as receiverUsername, sender.avatar as senderProfilePicture, sender.profile_border_color as senderProfileColor
        FROM notifications 
        INNER JOIN users as sender ON notifications.senderUserId = sender.id
        INNER JOIN users as receiver ON notifications.receiverUserId = receiver.id
        WHERE notifications.receiverUserId = ${userId} AND notifications.isRead = 1 
        ORDER BY notifications.createdAt DESC`;
      return result.recordset.map(notification => new Notification(notification));
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }

  static async getAllByUserId(userId) {
    try {
      const result = await sql.query`
        SELECT notifications.*, sender.username as senderUsername, receiver.username as receiverUsername, sender.avatar as senderProfilePicture, sender.profile_border_color as senderProfileColor
        FROM notifications 
        INNER JOIN users as sender ON notifications.senderUserId = sender.id
        INNER JOIN users as receiver ON notifications.receiverUserId = receiver.id
        WHERE notifications.receiverUserId = ${userId}
        ORDER BY notifications.createdAt DESC`;
      return result.recordset.map(notification => new Notification(notification));
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }

  static async getUnreadCountByUserId(userId) {
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
  }

  static async create(senderUserId, receiverUserId, type, postId = '') {
    try {
      const createdAt = new Date();
      const result = await sql.query`
        INSERT INTO notifications (type, isRead, createdAt, receiverUserId, senderUserId, postId)
        OUTPUT INSERTED.*
        VALUES (${type}, 0, ${createdAt}, ${receiverUserId}, ${senderUserId}, ${postId})`;
      
      await Notification.sendEmailNotification(receiverUserId, type);
      
      return new Notification(result.recordset[0]);
    } catch (err) {
      console.error('Database insert error:', err);
      throw err;
    }
  }

  async markAsRead() {
    try {
      await sql.query`
        UPDATE notifications 
        SET isRead = 1 
        WHERE id = ${this.id}`;
      this.isRead = true;
    } catch (err) {
      console.error('Database update error:', err);
      throw err;
    }
  }

  static async markAllAsRead(userId) {
    try {
      await sql.query`
        UPDATE notifications 
        SET isRead = 1 
        WHERE receiverUserId = ${userId}`;
    } catch (err) {
      console.error('Database update error:', err);
      throw err;
    }
  }

  async delete() {
    try {
      await sql.query`
        DELETE FROM notifications 
        WHERE id = ${this.id}`;
    } catch (err) {
      console.error('Database delete error:', err);
      throw err;
    }
  }

  static async deleteDuplicates(userId, type, postId) {
    try {
      await sql.query`
        DELETE FROM notifications
        WHERE receiverUserId = ${userId} AND type = ${type} AND postId = ${postId}`;
    } catch (err) {
      console.error('Database delete error:', err);
      throw err;
    }
  }
}

module.exports = Notification;