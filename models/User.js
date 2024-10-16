const sql = require('mssql');

class User {
  constructor(data) {
    this.id = data.id;
    this.username = data.username;
    this.email = data.email;
    this.avatar = data.avatar;
    this.googleId = data.google_id;
    this.githubId = data.github_id;
    this.githubUrl = data.github_url;
    this.isAdmin = data.isAdmin;
    this.isBanned = data.isBanned;
    this.verified = data.verified;
    this.bio = data.bio;
    this.points = data.points;
    this.createdAt = data.created_at;
    this.lastLogin = data.lastLogin;
    this.firstname = data.firstname;
    this.lastname = data.lastname;
    this.recruiter_id = data.recruiter_id;
    this.leetcode_url = data.leetcode_url;
    this.linkedin_url = data.linkedin_url;
    this.zipcode = data.zipcode;
    this.profile_border_color = data.profile_border_color;
    this.link = data.link;
    this.link2 = data.link2;
    this.settings_PrivateJobNames = data.settings_PrivateJobNames;
    this.settings_PrivateSchoolNames = data.settings_PrivateSchoolNames;
    this.jobPreferredTitle = data.jobPreferredTitle;
    this.jobPreferredSkills = data.jobPreferredSkills;
    this.jobPreferredLocation = data.jobPreferredLocation;
    this.jobExperienceLevel = data.jobExperienceLevel;
    this.jobPreferredIndustry = data.jobPreferredIndustry;
    this.jobPreferredSalary = data.jobPreferredSalary;
    this.followerCount = data.followerCount;
    this.followingCount = data.followingCount;
    this.topCommunities = data.topCommunities;
    this.githubCommitData = data.githubCommitData;
    this.githubCommitDataLastUpdated = data.githubCommitDataLastUpdated;
  }

  static async findByUsername(username) {
    try {
      const result = await sql.query`
        SELECT 
          u.*, 
          (SELECT COUNT(*) FROM user_relationships WHERE followed_id = u.id) AS followerCount,
          (SELECT COUNT(*) FROM user_relationships WHERE follower_id = u.id) AS followingCount
        FROM users u
        WHERE u.username = ${username}`;

      const userData = result.recordset[0];
      if (userData) {
        const user = new User(userData);
        const topCommunities = await User.getTopCommunities(user.id);
        user.topCommunities = topCommunities.map((c) => c.name).join(', ');
        return user;
      }
      return null;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }

  static async updateLastLogin(userId) {
    try {
      await sql.query`
        UPDATE users
        SET lastLogin = GETDATE()
        WHERE id = ${userId}`;
    } catch (err) {
      console.error('Database update error:', err);
      throw err;
    }
  }

  static async findByGoogleId(googleId) {
    try {
      const result = await sql.query`SELECT * FROM users WHERE google_id = ${googleId}`;
      return result.recordset[0] ? new User(result.recordset[0]) : null;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }

  static async createFromGoogleProfile(profile) {
    try {
      const result = await sql.query`
        INSERT INTO users (username, email, avatar, google_id, created_at, isAdmin, bio, verified)
        OUTPUT INSERTED.*
        VALUES (${profile.username.toLowerCase()}, ${profile.emails[0].value}, ${profile.photos[0].value}, ${profile.id}, GETDATE(), 0, '', 0)`;

      return new User(result.recordset[0]);
    } catch (err) {
      console.error('Database insert error:', err);
      throw err;
    }
  }

  static async toggleAdmin(userId) {
    try {
      const result = await sql.query`
        UPDATE users
        SET isAdmin = CASE WHEN isAdmin = 1 THEN 0 ELSE 1 END
        OUTPUT INSERTED.isAdmin
        WHERE id = ${userId}`;

      if (result.recordset.length === 0) {
        return { message: `User ID ${userId} not found.`, success: false };
      } else {
        const isAdmin = result.recordset[0].isAdmin;
        return {
          message: `User ID ${userId} is now ${isAdmin ? 'an admin' : 'not an admin'}.`,
          success: true,
          isAdmin: isAdmin,
        };
      }
    } catch (err) {
      console.error('Database update error:', err);
      throw err;
    }
  }

  static async toggleBan(userId) {
    try {
      const result = await sql.query`
        UPDATE users
        SET isBanned = CASE WHEN isBanned = 1 THEN 0 ELSE 1 END
        OUTPUT INSERTED.isBanned
        WHERE id = ${userId}`;

      if (result.recordset.length === 0) {
        return { message: `User ID ${userId} not found.`, success: false };
      } else {
        const isBanned = result.recordset[0].isBanned;
        return {
          message: `User ID ${userId} is now ${isBanned ? 'banned' : 'unbanned'}.`,
          success: true,
          isBanned: isBanned,
        };
      }
    } catch (err) {
      console.error('Database update error:', err);
      throw err;
    }
  }

  static async toggleVerified(userId) {
    try {
      const result = await sql.query`
        UPDATE users
        SET verified = CASE WHEN verified = 1 THEN 0 ELSE 1 END
        OUTPUT INSERTED.verified
        WHERE id = ${userId}`;

      if (result.recordset.length === 0) {
        return { message: `User ID ${userId} not found.`, success: false };
      } else {
        const verified = result.recordset[0].verified;
        return {
          message: `User ID ${userId} is now ${verified ? 'verified' : 'unverified'}.`,
          success: true,
          verified: verified,
        };
      }
    } catch (err) {
      console.error('Database update error:', err);
      throw err;
    }
  }

  static async getTopCommunities(userId) {
    try {
      const result = await sql.query`
      SELECT TOP 3
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
        (p.user_id = ${userId} OR cm.user_id = ${userId})
        AND c.id != 9
      GROUP BY
        c.id, c.name
      ORDER BY
        interaction_count DESC`;

      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }

  async getPosts(limit = 10) {
    try {
      const result = await sql.query`
      SELECT TOP ${limit}
        p.*,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
        (SELECT COUNT(*) FROM UserPostActions upa WHERE upa.post_id = p.id) AS reaction_count
      FROM 
        posts p
      WHERE 
        p.user_id = ${this.id} AND 
        p.deleted = 0 AND
        p.communities_id != 9
      ORDER BY 
        p.created_at DESC`;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }

  async getComments(limit = 10) {
    try {
      const result = await sql.query`
      SELECT TOP ${limit}
        comments.*, posts.title 
      FROM comments 
      INNER JOIN posts ON comments.post_id = posts.id 
      WHERE comments.user_id = ${this.id} AND comments.deleted = 0 
      ORDER BY comments.created_at DESC`;
      
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }

  static async findById(id) {
    try {
      const result = await sql.query`SELECT * FROM users WHERE id = ${id}`;
      return result.recordset[0] ? new User(result.recordset[0]) : null;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }

  static async findByEmail(email) {
    try {
      const result = await sql.query`SELECT * FROM users WHERE email = ${email}`;
      return result.recordset[0] ? new User(result.recordset[0]) : null;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }

  async updateField(field, value) {
    try {
      const validFields = [
        'firstname', 'lastname', 'avatar', 'bio', 'email', 'github_url', 
        'recruiter_id', 'leetcode_url', 'linkedin_url', 'zipcode', 'password', 
        'profile_border_color', 'link', 'link2', 'settings_PrivateJobNames', 
        'settings_PrivateSchoolNames', 'jobPreferredTitle', 'jobPreferredSkills', 
        'jobPreferredLocation', 'jobExperienceLevel', 'jobPreferredIndustry', 
        'jobPreferredSalary', 'githubCommitData', 'githubCommitDataLastUpdated',
      ];

      if (!validFields.includes(field)) {
        throw new Error(`Invalid field name: ${field}`);
      }

      if (['leetcode_url', 'linkedin_url', 'github_url'].includes(field)) {
        value = value.replace(/^https?:\/\/(www\.)?(leetcode|linkedin|github)\.com\/(in\/)?/i, '');
      }

      let sqlType = sql.VarChar;
      if (['settings_PrivateJobNames', 'settings_PrivateSchoolNames'].includes(field)) {
        sqlType = sql.Bit;
        value = value === true || value === 'true';
      } else if (typeof value === 'number') {
        sqlType = sql.Int;
      } else if (Array.isArray(value)) {
        value = value.join(',');
      }

      const query = `
        UPDATE users
        SET ${field} = @value
        WHERE id = @userId`;

      const request = new sql.Request();
      request.input('value', sqlType, value);
      request.input('userId', sql.VarChar, this.id);
      const result = await request.query(query);

      if (result && result.rowsAffected === 0) {
        console.warn(`No rows updated. User ID ${this.id} might not exist.`);
      }
    }
    catch (err) {
      console.error('Database update error:', err);
      throw err;
    }
  }

  static async updateField(userId, field, value) {
    try {
      const validFields = [
        'firstname', 'lastname', 'avatar', 'bio', 'email', 'github_url', 
        'recruiter_id', 'leetcode_url', 'linkedin_url', 'zipcode', 'password', 
        'profile_border_color', 'link', 'link2', 'settings_PrivateJobNames', 
        'settings_PrivateSchoolNames', 'jobPreferredTitle', 'jobPreferredSkills', 
        'jobPreferredLocation', 'jobExperienceLevel', 'jobPreferredIndustry', 
        'jobPreferredSalary', 'githubCommitData', 'githubCommitDataLastUpdated',
      ];

      if (!validFields.includes(field)) {
        throw new Error(`Invalid field name: ${field}`);
      }

      if (['leetcode_url', 'linkedin_url', 'github_url'].includes(field)) {
        value = value.replace(/^https?:\/\/(www\.)?(leetcode|linkedin|github)\.com\/(in\/)?/i, '');
      }

      let sqlType = sql.VarChar;
      if (['settings_PrivateJobNames', 'settings_PrivateSchoolNames'].includes(field)) {
        sqlType = sql.Bit;
        value = value === true || value === 'true';
      } else if (typeof value === 'number') {
        sqlType = sql.Int;
      } else if (Array.isArray(value)) {
        value = value.join(',');
      }

      const query = `
        UPDATE users
        SET ${field} = @value
        WHERE id = @userId`;

      const request = new sql.Request();
      request.input('value', sqlType, value);
      request.input('userId', sql.VarChar, userId);
      const result = await request.query(query);

      if (result && result.rowsAffected === 0) {
        console.warn(`No rows updated. User ID ${userId} might not exist.`);
      }
    } catch (err) {
      console.error('Database update error:', err);
      throw err;
    }
  }

  static async followUser(followerId, followedId) {
    try {
      const existingRelationship = await sql.query`
        SELECT * 
        FROM user_relationships
        WHERE follower_id = ${followerId} AND followed_id = ${followedId}`;

      if (existingRelationship.recordset.length > 0) {
        await sql.query`
          DELETE FROM user_relationships
          WHERE follower_id = ${followerId} AND followed_id = ${followedId}`;
        return false;
      }

      await sql.query`
        INSERT INTO user_relationships (follower_id, followed_id, created_at)
        VALUES (${followerId}, ${followedId}, GETDATE())`;

      return true;
    } catch (err) {
      console.error('Database insert/delete error:', err);
      throw err;
    }
  }

  static async isFollowing(followerId, followedId) {
    try {
      const result = await sql.query`
        SELECT COUNT(*) AS count
        FROM user_relationships
        WHERE follower_id = ${followerId} AND followed_id = ${followedId}`;

      return result.recordset[0].count > 0;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }

  static async getFollowerCount(userId) {
    try {
      const result = await sql.query`
        SELECT COUNT(*) AS count 
        FROM user_relationships
        WHERE followed_id = ${userId}`;

      return result.recordset[0].count;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }

  async getFollowing() {
    try {
      const result = await sql.query`
        SELECT u.id, u.username, u.avatar, u.firstname, u.lastname
        FROM users u
        JOIN user_relationships r ON u.id = r.followed_id
        WHERE r.follower_id = ${this.id}`;

      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }

  async getFollowers() {
    try {
      const result = await sql.query`
        SELECT u.id, u.username, u.avatar, u.firstname, u.lastname
        FROM users u
        JOIN user_relationships r ON u.id = r.follower_id
        WHERE r.followed_id = ${this.id}`;

      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }

  static async updateProfilePicture(userId, profilePicturePath) {
    try {
      const result = await sql.query`
        UPDATE users 
        SET avatar = ${profilePicturePath}
        WHERE id = ${userId}`;

      if (result.rowsAffected[0] === 0) {
        throw new Error(`User ID ${userId} not found`);
      }
    } catch (err) {
      console.error('Database update error:', err);
      throw err;
    }
  }

  // GitHub-related methods
  static async findByGitHubUsername(githubUsername) {
    try {
      const result = await sql.query`
        SELECT * FROM users WHERE github_url = ${githubUsername}`;
      return result.recordset[0] ? new User(result.recordset[0]) : null;
    } catch (err) {
      console.error(`Error finding user by GitHub username: ${githubUsername}`);
      throw err;
    }
  }

  static async findByGithubId(githubId) {
    try {
      const result = await sql.query`
        SELECT * FROM users WHERE github_id = ${githubId}`;
      return result.recordset[0] ? new User(result.recordset[0]) : null;
    } catch (err) {
      console.error(`Error finding user by GitHub ID: ${githubId}`);
      throw err;
    }
  }

  static async updateUserGitHubAccessToken(userId, accessToken) {
    try {
      const result = await sql.query`
        UPDATE users
        SET githubAccessToken = ${accessToken}
        WHERE id = ${userId}`;

      if (result.rowsAffected[0] === 0) {
        throw new Error(`User ID ${userId} not found`);
      }
    } catch (err) {
      console.error('Database update error:', err);
      throw err;
    }
  }

  static async updateGitHubId(userId, githubId) {
    try {
      await sql.query`
        UPDATE users
        SET github_id = ${githubId}
        WHERE id = ${userId}
      `;
    } catch (err) {
      console.error('Database update error:', err);
      throw err;
    }
  }

  static async updateGitHubUsername(userId, githubUsername) {
    try {
      await sql.query`
        UPDATE users
        SET github_url = ${githubUsername}
        WHERE id = ${userId}
      `;
    } catch (err) {
      console.error('Database update error:', err);
      throw err;
    }
  }

  static async removeDuplicateFollows() {
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
  }

  // Helper method to convert user object to JSON
  toJSON() {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      avatar: this.avatar,
      isAdmin: this.isAdmin,
      isBanned: this.isBanned,
      verified: this.verified,
      bio: this.bio,
      points: this.points,
      createdAt: this.createdAt,
      lastLogin: this.lastLogin,
      firstname: this.firstname,
      lastname: this.lastname,
      leetcode_url: this.leetcode_url,
      linkedin_url: this.linkedin_url,
      github_url: this.githubUrl,
      zipcode: this.zipcode,
      profile_border_color: this.profile_border_color,
      link: this.link,
      link2: this.link2,
      jobPreferredTitle: this.jobPreferredTitle,
      jobPreferredLocation: this.jobPreferredLocation,
      jobExperienceLevel: this.jobExperienceLevel,
      jobPreferredIndustry: this.jobPreferredIndustry,
      jobPreferredSalary: this.jobPreferredSalary,
      followerCount: this.followerCount,
      followingCount: this.followingCount,
      topCommunities: this.topCommunities,
    };
  }
}

module.exports = User;