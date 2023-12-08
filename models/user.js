const db = require("./database.js");

class User {
  constructor(id, username, email, password, country, zipcode) {
    this.id = id;
    this.username = username;
    this.email = email;
    this.password = password; // Note: this should be hashed
    this.country = country;
    this.zipcode = zipcode;
  }

  static findByUsername(username, callback) {
    const query = "SELECT * FROM users WHERE username = ?";
    db.query(query, [username], (err, results) => {
      if (err) {
        return callback(err, null);
      }
      if (results.length > 0) {
        const user = new User(
          results[0].id,
          results[0].username,
          results[0].email,
          results[0].password,
          results[0].country,
          results[0].zipcode
        );
        callback(null, user);
      } else {
        callback(null, null);
      }
    });
  }

  save(callback) {
    const query =
      "INSERT INTO users (username, email, password, country, zipcode) VALUES (?, ?, ?, ?, ?)";
    db.query(
      query,
      [this.username, this.email, this.password, this.country, this.zipcode],
      (err, result) => {
        if (err) {
          return callback(err);
        }
        callback(null, result);
      }
    );
  }
}

module.exports = User;
