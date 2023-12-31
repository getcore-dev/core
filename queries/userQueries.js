const sql = require("mssql");
const fs = require("fs");
const path = require("path");

const userQueries = {
  findByUsername: async (username) => {
    try {
      const result =
        await sql.query`SELECT * FROM users WHERE username = ${username}`;
      return result.recordset[0];
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  findById: async (id) => {
    try {
      const result = await sql.query`SELECT * FROM users WHERE id = ${id}`;
      return result.recordset[0];
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  findByEmail: async (email) => {
    try {
      const result =
        await sql.query`SELECT * FROM users WHERE email = ${email}`;
      return result.recordset[0];
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  addProfilePicture: async (userId, profilePictureUrl) => {
    try {
      const profilePicturePath = path.join(
        "/path/to/profile/images",
        path.basename(profilePictureUrl)
      );

      // Store the profile picture on the server
      await fs.promises.writeFile(
        profilePicturePath,
        fs.readFileSync(profilePictureUrl)
      );

      // Update the profile_image_path in the database
      await sql.query`UPDATE users SET profile_image_path = ${profilePicturePath} WHERE id = ${userId}`;
    } catch (err) {
      console.error("Database update error:", err);
      throw err;
    }
  },
};

module.exports = userQueries;
