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

  getPostsByUserId: async (userId) => {
    try {
      const result = await sql.query`
      SELECT * FROM posts WHERE user_id = ${userId} AND deleted = 0 ORDER BY created_at DESC`;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },
  getPostsByUserIdUserProfile: async (userId) => {
    try {
      const result = await sql.query`
      SELECT * FROM posts WHERE user_id = ${userId} AND deleted = 0 ORDER BY created_at DESC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY`;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getCommentAuthorByCommentId: async (commentId) => {
    try {
      const result = await sql.query`
        SELECT * FROM users WHERE id = (SELECT user_id FROM comments WHERE id = ${commentId})`;
      return result.recordset[0];
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getCommentsByUserId: async (userId) => {
    try {
      const result = await sql.query`
        SELECT * FROM comments WHERE user_id = ${userId} AND deleted = 0 ORDER BY created_at DESC`;
      const comments = result.recordset;

      const enrichedComments = await Promise.all(
        comments.map(async (comment) => {
          const author = await userQueries.getCommentAuthorByCommentId(
            comment.id
          );
          let receiver = null;
          if (comment.parent_comment_id) {
            receiver = await userQueries.getCommentAuthorByCommentId(
              comment.parent_comment_id
            );
            receiver = receiver.username;
          }
          return { ...comment, author, receiver };
        })
      );

      return enrichedComments;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getCommentsByUserIdUserProfile: async (userId) => {
    try {
      const result = await sql.query`
      SELECT comments.*, posts.title 
      FROM comments 
      INNER JOIN posts ON comments.post_id = posts.id 
      WHERE comments.user_id = ${userId} AND comments.deleted = 0 
      ORDER BY comments.created_at DESC 
      OFFSET 0 ROWS 
      FETCH NEXT 3 ROWS ONLY`;
      const comments = result.recordset;

      const enrichedComments = await Promise.all(
        comments.map(async (comment) => {
          const author = await userQueries.getCommentAuthorByCommentId(
            comment.id
          );
          let receiver = null;
          if (comment.parent_comment_id) {
            receiver = await userQueries.getCommentAuthorByCommentId(
              comment.parent_comment_id
            );
            receiver = receiver.username;
          }
          return { ...comment, author, receiver };
        })
      );

      return enrichedComments;
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

  updateField: async (userId, field, value) => {
    try {
      const validFields = [
        "firstname",
        "lastname",
        "avatar",
        "email",
        "github_url",
        "recruiter_id",
        "leetcode_url",
        "linkedin_url",
        "zipcode",
        "currentJob_employment_type",
        "currentJob_skills",
        "currentJob",
        "currentCompany",
        "currentIndustry",
        "password",
        "currentJob_begindate",
      ];

      // Check if the field is valid
      if (!validFields.includes(field)) {
        throw new Error(`Invalid field name: ${field}`);
      }

      // Construct the query with the safe field name
      const query = `
            UPDATE users 
            SET ${field} = @value
            WHERE id = @userId`;

      // Prepare and execute the query
      const request = new sql.Request();
      request.input("value", sql.VarChar, value); // assuming the type is VarChar
      request.input("userId", sql.VarChar, userId);
      const result = await request.query(query);

      if (result && result.rowsAffected === 0) {
        console.warn(`No rows updated. User ID ${userId} might not exist.`);
      } else if (result) {
      }

      // Convert result to JSON string
      const jsonString = JSON.stringify(result);
    } catch (err) {
      console.error("Database update error:", err.message);
      console.error("Error stack:", err.stack);

      // Additional information for debugging
      console.error(
        `Failed to update field ${field} for user ID: ${userId} with value: ${value}`
      );

      throw err;
    }
  },

  updateProfilePicture: async (userId, profilePicturePath) => {
    try {
      const result = await sql.query`
        UPDATE users 
        SET avatar = ${profilePicturePath}
        WHERE id = ${userId}`;

      if (result && result.rowCount === 0) {
      } else if (result) {
      }
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
