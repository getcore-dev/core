const sql = require('mssql');

const userQueries = {
  findByUsername: async (username) => {
    try {
      await userQueries.removeUserRelationshipsWithDeadAccounts();
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
      console.log(result.recordset[0].followingCount);

      const user = result.recordset[0];
      if (user) {
        const topCommunities = await userQueries.getTopCommunities(user.id);
        user.topCommunities = topCommunities.map((c) => c.name).join(', ');
      }

      return user;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  searchUsers: async (searchTerm) => {
    try {
      const result = await sql.query`
        SELECT * FROM users 
        WHERE username LIKE ${'%' + searchTerm + '%'}
        OR firstname LIKE ${'%' + searchTerm + '%'}
        OR lastname LIKE ${'%' + searchTerm + '%'}`;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  updateLastLogin: async (userId) => {
    try {
      await sql.query`
        UPDATE users
        SET lastLogin = GETDATE()
        WHERE id = ${userId}`;
    } catch (err) {
      console.error('Database update error:', err);
      throw err;
    }
  },

  findByGoogleId: async (googleId) => {
    try {
      const result = await sql.query`
        SELECT * FROM users WHERE google_id = ${googleId}`;
      return result.recordset[0];
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  createUserFromGoogleProfile: async (profile) => {
    try {
      const result = await sql.query`
        INSERT INTO users (username, email, avatar, google_id, created_at, isAdmin, bio, points, verified)
        OUTPUT INSERTED.*
        VALUES (${profile.username.toLowerCase()}, ${
  profile.emails[0].value
}, ${profile.photos[0].value}, ${profile.id}, GETDATE(), 0, '', 0, 0)`;

      return result.recordset[0];
    } catch (err) {
      console.error('Database insert error:', err);
      throw err;
    }
  },

  toggleAdmin: async (userId) => {
    try {
      const result = await sql.query`
        UPDATE users
        SET isAdmin = CASE WHEN isAdmin = 1 THEN 0 ELSE 1 END
        WHERE id = ${userId};
        SELECT isAdmin FROM users WHERE id = ${userId};
      `;

      if (result.recordset.length === 0) {
        console.warn(`No rows updated. User ID ${userId} might not exist.`);
        return { message: `User ID ${userId} not found.`, success: false };
      } else {
        const isAdmin = result.recordset[0].isAdmin;
        return {
          message: `User ID ${userId} is now ${
            isAdmin ? 'an admin' : 'not an admin'
          }.`,
          success: true,
          isAdmin: isAdmin,
        };
      }
    } catch (err) {
      console.error('Database update error:', err.message);
      console.error('Error stack:', err.stack);
      console.error(`Failed to toggle admin status for user ID: ${userId}`);
      throw err;
    }
  },

  toggleBan: async (userId) => {
    try {
      const result = await sql.query`
        UPDATE users
        SET isBanned = CASE WHEN isBanned = 1 THEN 0 ELSE 1 END
        WHERE id = ${userId};
        SELECT isBanned FROM users WHERE id = ${userId};
      `;

      if (result.recordset.length === 0) {
        console.warn(`No rows updated. User ID ${userId} might not exist.`);
        return { message: `User ID ${userId} not found.`, success: false };
      } else {
        const isBanned = result.recordset[0].isBanned;
        return {
          message: `User ID ${userId} is now ${
            isBanned ? 'banned' : 'unbanned'
          }.`,
          success: true,
          isBanned: isBanned,
        };
      }
    } catch (err) {
      console.error('Database update error:', err.message);
      console.error('Error stack:', err.stack);
      console.error(`Failed to toggle ban status for user ID: ${userId}`);
      throw err;
    }
  },

  toggleVerified: async (userId) => {
    try {
      const result = await sql.query`
        UPDATE users
        SET verified = CASE WHEN verified = 1 THEN 0 ELSE 1 END
        WHERE id = ${userId};
        SELECT verified FROM users WHERE id = ${userId};
      `;

      if (result.recordset.length === 0) {
        console.warn(`No rows updated. User ID ${userId} might not exist.`);
        return { message: `User ID ${userId} not found.`, success: false };
      } else {
        const verified = result.recordset[0].verified;
        return {
          message: `User ID ${userId} is now ${
            verified ? 'verified' : 'unverified'
          }.`,
          success: true,
          verified: verified,
        };
      }
    } catch (err) {
      console.error('Database update error:', err.message);
      console.error('Error stack:', err.stack);
      console.error(`Failed to toggle verified status for user ID: ${userId}`);
      throw err;
    }
  },

  getTopCommunities: async (userId) => {
    try {
      const result = await sql.query`
      SELECT
        c.id,
        c.name,
        COUNT(*) AS interaction_count
      FROM
        communities c
      LEFT JOIN
        posts p ON c.id = p.communities_id AND p.user_id = ${userId}
      LEFT JOIN
        comments cm ON cm.post_id = p.id AND cm.user_id = ${userId}
      WHERE
        p.user_id = ${userId} OR cm.user_id = ${userId}
        AND c.id != 9
      GROUP BY
        c.id, c.name
      ORDER BY
        interaction_count DESC
      OFFSET 0 ROWS
      FETCH NEXT 3 ROWS ONLY`;

      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getPostsByUserId: async (userId) => {
    try {
      const result = await sql.query`
      SELECT * FROM posts WHERE user_id = ${userId} AND deleted = 0 ORDER BY created_at DESC`;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },
  getPostsByUserIdUserProfile: async (userId, currentUserId) => {
    try {
      const result = await sql.query`
      SELECT 
        p.*,
        c.PrivacySetting,
        (SELECT COUNT(*) FROM comments com WHERE com.post_id = p.id AND com.deleted = 0) AS comment_count,
        (SELECT COUNT(*) FROM UserPostActions upa WHERE upa.post_id = p.id) AS reaction_count
      FROM 
        posts p
      INNER JOIN
        communities c ON p.communities_id = c.id
      LEFT JOIN
        community_memberships cm ON c.id = cm.community_id AND cm.user_id = ${currentUserId}
      WHERE 
        p.user_id = ${userId} AND 
        p.deleted = 0 AND
        p.communities_id != 9 AND
        (c.PrivacySetting = 'Public' OR cm.user_id IS NOT NULL)
      ORDER BY 
        p.created_at DESC
      OFFSET 0 ROWS
      FETCH NEXT 10 ROWS ONLY;
    `;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getCommentAuthorByCommentId: async (commentId) => {
    try {
      const result = await sql.query`
        SELECT * FROM users WHERE id = (SELECT user_id FROM comments WHERE id = ${commentId})`;
      return result.recordset[0];
    } catch (err) {
      console.error('Database query error:', err);
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
      console.error('Database query error:', err);
      throw err;
    }
  },

  getCommentsByUserIdUserProfile: async (userId, currentUserId) => {
    try {
      const result = await sql.query`
        SELECT 
          comments.*, 
          posts.title,
          communities.PrivacySetting
        FROM comments 
        INNER JOIN posts ON comments.post_id = posts.id 
        INNER JOIN communities ON posts.communities_id = communities.id
        LEFT JOIN community_memberships cm ON communities.id = cm.community_id AND cm.user_id = ${currentUserId}
        WHERE 
          comments.user_id = ${userId} 
          AND comments.deleted = 0 
          AND (communities.PrivacySetting = 'Public' OR cm.user_id IS NOT NULL)
        ORDER BY comments.created_at DESC 
        OFFSET 0 ROWS 
        FETCH NEXT 10 ROWS ONLY
      `;
      const comments = result.recordset;
  
      const enrichedComments = await Promise.all(
        comments.map(async (comment) => {
          const author = await userQueries.getCommentAuthorByCommentId(
            comment.id,
            currentUserId
          );
          let receiver = null;
          if (comment.parent_comment_id) {
            receiver = await userQueries.getCommentAuthorByCommentId(
              comment.parent_comment_id,
              currentUserId
            );
            receiver = receiver ? receiver.username : null;
          }
          return { ...comment, author, receiver };
        })
      );
  
      return enrichedComments;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  findById: async (id) => {
    try {
      const result = await sql.query`SELECT * FROM users WHERE id = ${id}`;
      return result.recordset[0];
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  findByEmail: async (email) => {
    try {
      const result =
        await sql.query`SELECT * FROM users WHERE email = ${email}`;
      return result.recordset[0];
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  updateField: async (userId, field, value) => {
    try {
      const validFields = [
        'firstname',
        'lastname',
        'avatar',
        'bio',
        'email',
        'github_url',
        'recruiter_id',
        'leetcode_url',
        'linkedin_url',
        'zipcode',
        'password',
        'profile_border_color',
        'link',
        'link2',
        'settings_PrivateJobNames',
        'settings_PrivateSchoolNames',
        'jobPreferredTitle',
        'jobPreferredSkills',
        'jobPreferredLocation',
        'jobExperienceLevel',
        'jobPreferredIndustry',
        'jobPreferredSalary',
      ];

      console.log('field', field);
      console.log('value', value);
  
      // Check if the field is valid
      if (!validFields.includes(field)) {
        throw new Error(`Invalid field name: ${field}`);
      }
  
      if (['leetcode_url', 'linkedin_url', 'github_url'].includes(field)) {
        // Extract the username from the provided value
        switch (field) {
          case 'leetcode_url':
            value = value.replace(/^https?:\/\/leetcode.com\//i, '');
            break;
          case 'linkedin_url':
            value = value.replace(
              /^https?:\/\/(?:www\.)?linkedin.com\/in\//i,
              ''
            );
            break;
          case 'github_url':
            value = value.replace(/^https?:\/\/github.com\//i, '');
            break;
        }
      }
  
      if (field === 'recruiter_id') {
        const recruiterQuery = `
          SELECT COUNT(*) AS count
          FROM Recruiters
          WHERE recruiter_id = @recruiterId`;
        const recruiterRequest = new sql.Request();
        recruiterRequest.input('recruiterId', sql.VarChar, value);
        const recruiterResult = await recruiterRequest.query(recruiterQuery);
  
        if (recruiterResult.recordset[0].count === 0) {
          throw new Error(`Invalid recruiter_id: ${value}`);
        }
      }
  
      // Handle boolean conversion for specific fields
      if (
        field === 'settings_PrivateJobNames' ||
        field === 'settings_PrivateSchoolNames'
      ) {
        value = value === true || value === 'true'; // Ensure value is boolean
      }
  
      // Determine the appropriate SQL data type
      let sqlType = sql.VarChar;
      if (
        field === 'settings_PrivateJobNames' ||
        field === 'settings_PrivateSchoolNames'
      ) {
        sqlType = sql.Bit;
      } else if (typeof value === 'number') {
        sqlType = sql.Int;
      } else if (Array.isArray(value)) {
        // Handle empty arrays or arrays with only empty strings
        if (value.length === 0 || (value.length === 1 && value[0] === '')) {
          value = null;
        } else {
          value = value.filter(item => item !== '').join(',');
        }
      }
  
      // Construct the query with the safe field name
      const query = `
        UPDATE users
        SET ${field} = @value
        WHERE id = @userId`;
  
      // Prepare and execute the query
      const request = new sql.Request();
      request.input('value', sqlType, value);
      request.input('userId', sql.VarChar, userId);
      const result = await request.query(query);
  
      if (result && result.rowsAffected === 0) {
        console.warn(`No rows updated. User ID ${userId} might not exist.`);
      } else if (result) {
        // Convert result to JSON string
        const jsonString = JSON.stringify(result);
      }
    } catch (err) {
      console.error('Database update error:', err.message);
      console.error('Error stack:', err.stack);
      // Additional information for debugging
      console.error(
        `Failed to update field ${field} for user ID: ${userId} with value: ${value}`
      );
      throw err;
    }
  },

  getUserCount: async () => {
    try {
      const result = await sql.query`
        SELECT COUNT(*) AS count FROM users`;
      return result.recordset[0].count;
    } catch (err) {
      console.error('Database query error:', err);
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
        // unfollow user
        await sql.query`
          DELETE FROM user_relationships
          WHERE follower_id = ${followerId} AND followed_id = ${followedId}`;
        return false;
      }

      // Insert the new follow relationship
      await sql.query`
        INSERT INTO user_relationships (follower_id, followed_id, created_at)
        VALUES (${followerId}, ${followedId}, GETDATE())`;

      return true;
    } catch (err) {
      console.error('Database insert error:', err);
      throw err;
    }
  },
  unfollowUser: async (followerId, followedId) => {
    try {
      const existingRelationship = await sql.query`
        SELECT *
        FROM user_relationships
        WHERE follower_id = ${followerId} AND followed_id = ${followedId}`;

      if (existingRelationship.recordset.length === 0) {
        throw new Error('User is not following this user');
      }

      if (existingRelationship.recordset.length > 0) {
        // unfollow user
        await sql.query`
          DELETE FROM user_relationships
          WHERE follower_id = ${followerId} AND followed_id = ${followedId}`;
        return false;
      }

      return true;
    } catch (err) {
      console.error('Database delete error:', err);
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
      console.error('Database update error:', err.message);
      console.error('Error stack:', err.stack);

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
        INSERT INTO users (github_url, username, avatar, email, github_id, created_at, isAdmin, bio, verified)
        OUTPUT INSERTED.*
        VALUES (${profile.username.toLowerCase()}, ${profile.username}, ${
  profile.photos[0].value
}, ${profile.emails[0].value}, ${profile.id}, GETDATE(), 0, '', 0)`;

      return result.recordset[0];
    } catch (err) {
      console.error('Database insert error:', err);
      throw err;
    }
  },

  removeUserRelationshipsWithDeadAccounts: async () => {
    try {
      const result = await sql.query`
        DELETE FROM user_relationships
        WHERE followed_id NOT IN (SELECT id FROM users) OR follower_id NOT IN (SELECT id FROM users)`;

      return result.rowsAffected[0];
    } catch (err) {
      console.error('Database delete error:', err);
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
      console.error('Database delete error:', err);
      throw err;
    }
  },
  isFollowing: async (followerId, followedId) => {
    try {
      await userQueries.removeDuplicateFollows();
      const result = await sql.query`
        SELECT COUNT(*) AS count
        FROM user_relationships
        WHERE follower_id = ${followerId} AND followed_id = ${followedId}`;

      return result.recordset[0].count > 0;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },
  getFollowerCount: async (userId) => {
    try {
      await userQueries.removeDuplicateFollows();
      const result = await sql.query`
        SELECT COUNT(*) AS count 
        FROM user_relationships
        WHERE followed_id = ${userId}`;

      return result.recordset[0].count;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getFollowing: async (userId) => {
    try {
      await userQueries.removeDuplicateFollows();
      const result = await sql.query`
        SELECT u.id, u.username, u.avatar, u.firstname, u.lastname
        FROM users u
        JOIN user_relationships r ON u.id = r.followed_id
        WHERE r.follower_id = ${userId}`;

        console.log(result);
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },
  getFollowers: async (userId) => {
    try {
      await userQueries.removeDuplicateFollows();
      const result = await sql.query`
        SELECT u.id, u.username, u.avatar, u.firstname, u.lastname
        FROM users u
        JOIN user_relationships r ON u.id = r.follower_id
        WHERE r.followed_id = ${userId}`;
        console.log(result);

      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
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
        throw new Error(`User ID ${userId} not found`);
      }
    } catch (err) {
      console.error('Database update error:', err.message);
      console.error('Error stack:', err.stack);

      // Additional information for debugging
      console.error(
        `Failed to update avatar for user ID: ${userId} with path: ${profilePicturePath}`
      );

      throw err;
    }
  },
};

module.exports = userQueries;
