const db = require("./database");

class User {
  static async findById(userId) {
    return new Promise((resolve, reject) => {
      const query = "SELECT * FROM users WHERE user_id = ?";
      db.query(query, [userId], (error, results) => {
        if (error) {
          reject(error);
        } else {
          resolve(results[0]);
        }
      });
    });
  }
  static async create(userData) {
    return new Promise((resolve, reject) => {
      const { username, email, password_hash, zip_code } = userData;
      const query =
        "INSERT INTO users (username, email, password_hash, zip_code) VALUES (?, ?, ?, ?)";

      db.query(
        query,
        [username, email, password_hash, zip_code],
        (error, results) => {
          if (error) {
            reject(error);
          } else {
            resolve({ user_id: results.insertId, ...userData });
          }
        }
      );
    });
  }
}

module.exports = User;
