const sql = require("mssql");

const userQueries = {
  findByUsername: async (username) => {
    try {
      const result = await sql.query`
      SELECT 
        u.*, 
        (
          SELECT COUNT(*) 
          FROM user_relationships 
          WHERE followed_id = u.id
        ) AS followerCount,
        (
          SELECT COUNT(*) 
          FROM user_relationships 
          WHERE follower_id = u.id
        ) AS followingCount
      FROM users u
      WHERE u.username = ${username}`;

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
      SELECT 
        p.*,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
        (SELECT COUNT(*) FROM UserPostActions upa WHERE upa.post_id = p.id) AS reaction_count
      FROM 
        posts p
      WHERE 
        p.user_id = ${userId} AND 
        p.deleted = 0
      ORDER BY 
        p.created_at DESC
      OFFSET 0 ROWS
      FETCH NEXT 10 ROWS ONLY;
    `;
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
      FETCH NEXT 10 ROWS ONLY`;
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
        "bio",
        "email",
        "github_url",
        "recruiter_id",
        "leetcode_url",
        "linkedin_url",
        "zipcode",
        "password",
        "profile_border_color",
        "link",
        "link2",
      ];

      // Check if the field is valid
      if (!validFields.includes(field)) {
        throw new Error(`Invalid field name: ${field}`);
      }

      if (["leetcode_url", "linkedin_url", "github_url"].includes(field)) {
        // Extract the username from the provided value
        switch (field) {
          case "leetcode_url":
            value = value.replace(/^https?:\/\/leetcode.com\//i, "");
            break;
          case "linkedin_url":
            value = value.replace(
              /^https?:\/\/(?:www\.)?linkedin.com\/in\//i,
              ""
            );
            break;
          case "github_url":
            value = value.replace(/^https?:\/\/github.com\//i, "");
            break;
        }
      }

      if (field === "recruiter_id") {
        const recruiterQuery = `
        SELECT COUNT(*) AS count
        FROM Recruiters
        WHERE recruiter_id = @recruiterId`;
        const recruiterRequest = new sql.Request();
        recruiterRequest.input("recruiterId", sql.VarChar, value);
        const recruiterResult = await recruiterRequest.query(recruiterQuery);

        if (recruiterResult.recordset[0].count === 0) {
          throw new Error(`Invalid recruiter_id: ${value}`);
        }
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
        // Convert result to JSON string
        const jsonString = JSON.stringify(result);
      }
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
  followUser: async (followerId, followedId) => {
    try {
      // Check if the follow relationship already exists
      const existingRelationship = await sql.query`
        SELECT * 
        FROM user_relationships
        WHERE follower_id = ${followerId} AND followed_id = ${followedId}`;

      if (existingRelationship.recordset.length > 0) {
        throw new Error("User is already following this user");
      }

      // Insert the new follow relationship
      await sql.query`
        INSERT INTO user_relationships (follower_id, followed_id, created_at)
        VALUES (${followerId}, ${followedId}, GETDATE())`;

      return true;
    } catch (err) {
      console.error("Database insert error:", err);
      throw err;
    }
  },
  unfollowUser: async (followerId, followedId) => {
    try {
      // Delete the follow relationship
      const result = await sql.query`
        DELETE FROM user_relationships
        WHERE follower_id = ${followerId} AND followed_id = ${followedId}`;

      if (result.rowsAffected[0] === 0) {
        throw new Error("User is not following this user");
      }

      return true;
    } catch (err) {
      console.error("Database delete error:", err);
      throw err;
    }
  },
  updateGitHubId: async (userId, githubId) => {
    await sql.query`
      UPDATE users
      SET github_id = ${githubId}
      WHERE id = ${userId}
    `;
  },

  updateGitHubUsername: async (userId, githubUsername) => {
    await sql.query`
      UPDATE users
      SET github_url = ${githubUsername}
      WHERE id = ${userId}
    `;
  },

  findByGitHubUsername: async (githubUsername) => {
    try {
      const result = await sql.query`
        SELECT * FROM users WHERE github_url = ${githubUsername}`;
      return result.recordset[0];
    } catch (err) {
      console.error(`Error finding user by GitHub username: ${githubUsername}`);
      throw err;
    }
  },

  findByGithubId: async (githubId) => {
    try {
      const result = await sql.query`
        SELECT * FROM users WHERE github_id = ${githubId}`;
      return result.recordset[0];
    } catch (err) {
      console.error(`Error finding user by GitHub ID: ${githubId}`);
      throw err;
    }
  },

  updateUserGitHubAccessToken: async (userId, accessToken) => {
    try {
      const result = await sql.query`
        UPDATE users
        SET githubAccessToken = ${accessToken}
        WHERE id = ${userId}`;

      if (result && result.rowsAffected === 0) {
        throw new Error(`User ID ${userId} not found`);
      }
    } catch (err) {
      console.error("Database update error:", err.message);
      console.error("Error stack:", err.stack);

      // Additional information for debugging
      console.error(
        `Failed to update GitHub access token for user ID: ${userId}`
      );

      throw err;
    }
  },

  createUserFromGitHubProfile: async (profile) => {
    try {
      const result = await sql.query`
        INSERT INTO users (github_url, username, avatar, email, github_id, created_at)
        OUTPUT INSERTED.*
        VALUES (${profile.username}, ${profile.username}, ${profile.photos[0].value}, ${profile.emails[0].value}, ${profile.id}, GETDATE())`;

      return result.recordset[0];
    } catch (err) {
      console.error("Database insert error:", err);
      throw err;
    }
  },
  removeDuplicateFollows: async () => {
    try {
      const result = await sql.query`
        WITH cte AS (
          SELECT
            *,
            ROW_NUMBER() OVER (
              PARTITION BY follower_id, followed_id
              ORDER BY created_at DESC
            ) AS rn
          FROM user_relationships
        )
        DELETE FROM cte
        WHERE rn > 1`;

      return result.rowsAffected[0];
    } catch (err) {
      console.error("Database delete error:", err);
      throw err;
    }
  },
  isFollowing: async (followerId, followedId) => {
    try {
      const result = await sql.query`
        SELECT COUNT(*) AS count
        FROM user_relationships
        WHERE follower_id = ${followerId} AND followed_id = ${followedId}`;

      return result.recordset[0].count > 0;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },
  getFollowerCount: async (userId) => {
    try {
      const result = await sql.query`
        SELECT COUNT(*) AS count 
        FROM user_relationships
        WHERE followed_id = ${userId}`;

      return result.recordset[0].count;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getFollowing: async (userId) => {
    try {
      const result = await sql.query`
        SELECT u.id, u.username, u.avatar, u.firstname, u.lastname
        FROM users u
        JOIN user_relationships r ON u.id = r.followed_id
        WHERE r.follower_id = ${userId}`;

      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },
  getFollowers: async (userId) => {
    try {
      const result = await sql.query`
        SELECT u.id, u.username, u.avatar, u.firstname, u.lastname
        FROM users u
        JOIN user_relationships r ON u.id = r.follower_id
        WHERE r.followed_id = ${userId}`;

      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
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
