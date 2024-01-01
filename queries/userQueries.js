const sql = require("mssql");

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

  updateProfilePicture: async (userId, profilePicturePath) => {
    console.log(`Starting updateProfilePicture for user ID: ${userId}`);

    try {
      console.log(
        `Updating avatar for user ID: ${userId} with path: ${profilePicturePath}`
      );

      const result = await sql.query`
        UPDATE users 
        SET avatar = ${profilePicturePath}
        WHERE id = ${userId}`;

      if (result && result.rowCount === 0) {
        console.warn(`No rows updated. User ID ${userId} might not exist.`);
      } else if (result) {
        console.log(`Update successful. Rows affected: ${result.rowCount}`);
      }

      console.log(`Updated profile picture path: ${profilePicturePath}`);
    } catch (err) {
      console.error("Database update error:", err.message);
      console.error("Error stack:", err.stack);

      // Additional information for debugging
      console.error(
        `Failed to update avatar for user ID: ${userId} with path: ${profilePicturePath}`
      );

      throw err;
    }
  },
};

module.exports = userQueries;
