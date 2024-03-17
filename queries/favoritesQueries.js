const sql = require("mssql");

const favoritesQueries = {
  addToFavorites: async (userId, postId) => {
    try {
      const checkExistence = await sql.query`
                SELECT * FROM favorites 
                WHERE user_id = ${userId} AND post_id = ${postId}`;

      if (checkExistence.recordset.length > 0) {
        throw new Error("User has already favorited this post.");
      }

      // Add post to user's favorites
      await sql.query`
                INSERT INTO favorites (user_id, post_id) 
                VALUES (${userId}, ${postId})`;

      return "Post successfully added to favorites.";
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  removeFromFavorites: async (userId, postId) => {
    try {
      // check if post exists in user's favorites
      const checkExistence = await sql.query`
                SELECT * FROM favorites 
                WHERE user_id = ${userId} AND post_id = ${postId}`;

      if (checkExistence.recordset.length === 0) {
        throw new Error("Post is not in user's favorites.");
      }

      // Remove post from user's favorites
      await sql.query`
                DELETE FROM favorites 
                WHERE user_id = ${userId} AND post_id = ${postId}`;

      return "Post successfully removed from favorites.";
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getFavorites: async (userId) => {
    try {
      const result = await sql.query`
                SELECT f.*,
                p.title, p.content, p.user_id, p.created_at, p.updated_at,
                u.username, u.avatar 
                FROM favorites f
                INNER JOIN posts p ON f.post_id = p.id
                INNER JOIN users u ON p.user_id = u.id
                WHERE f.user_id = ${userId}`;

      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },
};

module.exports = favoritesQueries;
