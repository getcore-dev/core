const sql = require("mssql");
const notificationQueries = require("../queries/notificationQueries");

class User {
  constructor(data) {
    this.id = data.id;
    this.username = data.username;
    this.email = data.email;
    this.avatar = data.avatar;
    this.googleId = data.google_id;
    this.githubId = data.github_id;
    this.githubUsername = data.github_url;
    this.createdAt = data.created_at;
    this.isAdmin = data.isAdmin;
    this.bio = data.bio;
    this.points = data.points;
    this.verified = data.verified;
    this.isBanned = data.isBanned;
    this.lastLogin = data.lastLogin;
    this.firstname = data.firstname;
    this.lastname = data.lastname;
    this.leetcodeUrl = data.leetcode_url;
    this.linkedinUrl = data.linkedin_url;
    this.zipcode = data.zipcode;
    this.profileBorderColor = data.profile_border_color;
    this.link = data.link;
    this.link2 = data.link2;
    this.settingsPrivateJobNames = data.settings_PrivateJobNames;
    this.settingsPrivateSchoolNames = data.settings_PrivateSchoolNames;
    this.jobPreferredTitle = data.jobPreferredTitle;
    this.jobPreferredSkills = data.jobPreferredSkills;
    this.jobPreferredLocation = data.jobPreferredLocation;
    this.jobExperienceLevel = data.jobExperienceLevel;
    this.jobPreferredIndustry = data.jobPreferredIndustry;
    this.jobPreferredSalary = data.jobPreferredSalary;
    this.githubAccessToken = data.githubAccessToken;
    this.recruiterId = data.recruiter_id;
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

      if (result.recordset[0]) {
        const user = new User(result.recordset[0]);
        user.topCommunities = await User.getTopCommunities(user.id);
        return user;
      }
      return null;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  static async findById(id) {
    try {
      const result = await sql.query`SELECT * FROM users WHERE id = ${id}`;
      return result.recordset[0] ? new User(result.recordset[0]) : null;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  static async findByEmail(email) {
    try {
      const result = await sql.query`SELECT * FROM users WHERE email = ${email}`;
      return result.recordset[0] ? new User(result.recordset[0]) : null;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  static async findByGoogleId(googleId) {
    try {
      const result = await sql.query`SELECT * FROM users WHERE google_id = ${googleId}`;
      return result.recordset[0] ? new User(result.recordset[0]) : null;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  static async findByGitHubUsername(githubUsername) {
    try {
      const result = await sql.query`SELECT * FROM users WHERE github_url = ${githubUsername}`;
      return result.recordset[0] ? new User(result.recordset[0]) : null;
    } catch (err) {
      console.error(`Error finding user by GitHub username: ${githubUsername}`);
      throw err;
    }
  }

  static async findByGitHubId(githubId) {
    try {
      const result = await sql.query`SELECT * FROM users WHERE github_id = ${githubId}`;
      return result.recordset[0] ? new User(result.recordset[0]) : null;
    } catch (err) {
      console.error(`Error finding user by GitHub ID: ${githubId}`);
      throw err;
    }
  }

  static async createFromGoogleProfile(profile) {
    try {
      const result = await sql.query`
        INSERT INTO users (username, email, avatar, google_id, created_at, isAdmin, bio, points, verified)
        OUTPUT INSERTED.*
        VALUES (${profile.username.toLowerCase()}, ${profile.emails[0].value}, ${profile.photos[0].value}, ${profile.id}, GETDATE(), 0, '', 0, 0)`;

      return new User(result.recordset[0]);
    } catch (err) {
      console.error("Database insert error:", err);
      throw err;
    }
  }

  static async createFromGitHubProfile(profile) {
    try {
      const result = await sql.query`
        INSERT INTO users (github_url, username, avatar, email, github_id, created_at, isAdmin, bio, points, verified)
        OUTPUT INSERTED.*
        VALUES (${profile.username.toLowerCase()}, ${profile.username}, ${profile.photos[0].value}, ${profile.emails[0].value}, ${profile.id}, GETDATE(), 0, '', 0, 0)`;

      return new User(result.recordset[0]);
    } catch (err) {
      console.error("Database insert error:", err);
      throw err;
    }
  }

  async save() {
    try {
      const result = await sql.query`
        UPDATE users
        SET username = ${this.username},
            email = ${this.email},
            avatar = ${this.avatar},
            google_id = ${this.googleId},
            github_id = ${this.githubId},
            github_url = ${this.githubUsername},
            isAdmin = ${this.isAdmin},
            bio = ${this.bio},
            points = ${this.points},
            verified = ${this.verified},
            isBanned = ${this.isBanned},
            lastLogin = ${this.lastLogin},
            firstname = ${this.firstname},
            lastname = ${this.lastname},
            leetcode_url = ${this.leetcodeUrl},
            linkedin_url = ${this.linkedinUrl},
            zipcode = ${this.zipcode},
            profile_border_color = ${this.profileBorderColor},
            link = ${this.link},
            link2 = ${this.link2},
            settings_PrivateJobNames = ${this.settingsPrivateJobNames},
            settings_PrivateSchoolNames = ${this.settingsPrivateSchoolNames},
            jobPreferredTitle = ${this.jobPreferredTitle},
            jobPreferredSkills = ${this.jobPreferredSkills},
            jobPreferredLocation = ${this.jobPreferredLocation},
            jobExperienceLevel = ${this.jobExperienceLevel},
            jobPreferredIndustry = ${this.jobPreferredIndustry},
            jobPreferredSalary = ${this.jobPreferredSalary},
            githubAccessToken = ${this.githubAccessToken},
            recruiter_id = ${this.recruiterId}
        WHERE id = ${this.id}`;

      return result.rowsAffected[0] > 0;
    } catch (err) {
      console.error("Database update error:", err);
      throw err;
    }
  }

  async updateLastLogin() {
    try {
      await sql.query`
        UPDATE users
        SET lastLogin = GETDATE()
        WHERE id = ${this.id}`;
      this.lastLogin = new Date();
    } catch (err) {
      console.error("Database update error:", err);
      throw err;
    }
  }

  async toggleAdmin() {
    try {
      const result = await sql.query`
        UPDATE users
        SET isAdmin = CASE WHEN isAdmin = 1 THEN 0 ELSE 1 END
        OUTPUT INSERTED.isAdmin
        WHERE id = ${this.id}`;

      if (result.recordset.length === 0) {
        throw new Error(`User ID ${this.id} not found.`);
      }

      this.isAdmin = result.recordset[0].isAdmin;
      return {
        message: `User ID ${this.id} is now ${this.isAdmin ? "an admin" : "not an admin"}.`,
        success: true,
        isAdmin: this.isAdmin,
      };
    } catch (err) {
      console.error("Database update error:", err);
      throw err;
    }
  }

  async toggleBan() {
    try {
      const result = await sql.query`
        UPDATE users
        SET isBanned = CASE WHEN isBanned = 1 THEN 0 ELSE 1 END
        OUTPUT INSERTED.isBanned
        WHERE id = ${this.id}`;

      if (result.recordset.length === 0) {
        throw new Error(`User ID ${this.id} not found.`);
      }

      this.isBanned = result.recordset[0].isBanned;
      return {
        message: `User ID ${this.id} is now ${this.isBanned ? "banned" : "unbanned"}.`,
        success: true,
        isBanned: this.isBanned,
      };
    } catch (err) {
      console.error("Database update error:", err);
      throw err;
    }
  }

  async toggleVerified() {
    try {
      const result = await sql.query`
        UPDATE users
        SET verified = CASE WHEN verified = 1 THEN 0 ELSE 1 END
        OUTPUT INSERTED.verified
        WHERE id = ${this.id}`;

      if (result.recordset.length === 0) {
        throw new Error(`User ID ${this.id} not found.`);
      }

      this.verified = result.recordset[0].verified;
      return {
        message: `User ID ${this.id} is now ${this.verified ? "verified" : "unverified"}.`,
        success: true,
        verified: this.verified,
      };
    } catch (err) {
      console.error("Database update error:", err);
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
      console.error("Database query error:", err);
      throw err;
    }
  }

  async getPosts(limit = null) {
    try {
      let query = `
        SELECT 
          p.*,
          (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
          (SELECT COUNT(*) FROM UserPostActions upa WHERE upa.post_id = p.id) AS reaction_count
        FROM 
          posts p
        WHERE 
          p.user_id = @userId AND 
          p.deleted = 0 AND
          p.communities_id != 9
        ORDER BY 
          p.created_at DESC`;

      if (limit) {
        query += ` OFFSET 0 ROWS FETCH NEXT @limit ROWS ONLY`;
      }

      const request = new sql.Request();
      request.input('userId', sql.VarChar, this.id);
      if (limit) {
        request.input('limit', sql.Int, limit);
      }

      const result = await request.query(query);
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  async getComments(limit = null) {
    try {
      let query = `
        SELECT comments.*, posts.title 
        FROM comments 
        INNER JOIN posts ON comments.post_id = posts.id 
        WHERE comments.user_id = @userId AND comments.deleted = 0 
        ORDER BY comments.created_at DESC`;

      if (limit) {
        query += ` OFFSET 0 ROWS FETCH NEXT @limit ROWS ONLY`;
      }

      const request = new sql.Request();
      request.input('userId', sql.VarChar, this.id);
      if (limit) {
        request.input('limit', sql.Int, limit);
      }

      const result = await request.query(query);
      const comments = result.recordset;

      const enrichedComments = await Promise.all(
        comments.map(async (comment) => {
          const author = await User.findById(comment.user_id);
          let receiver = null;
          if (comment.parent_comment_id) {
            const parentComment = await sql.query`SELECT user_id FROM comments WHERE id = ${comment.parent_comment_id}`;
            if (parentComment.recordset.length > 0) {
              receiver = await User.findById(parentComment.recordset[0].user_id);
              receiver = receiver ? receiver.username : null;
            }
          }
          return { ...comment, author: author ? author.username : null, receiver };
        })
      );

      return enrichedComments;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  async follow(userToFollow) {
    try {
      // Check if the follow relationship already exists
      const existingRelationship = await sql.query`
        SELECT * 
        FROM user_relationships
        WHERE follower_id = ${this.id} AND followed_id = ${userToFollow.id}`;

      if (existingRelationship.recordset.length > 0) {
        throw new Error("User is already following this user");
      }

      // Insert the new follow relationship
      await sql.query`
        INSERT INTO user_relationships (follower_id, followed_id, created_at)
        VALUES (${this.id}, ${userToFollow.id}, GETDATE())`;

      return true;
    } catch (err) {
      console.error("Database insert error:", err);
      throw err;
    }
  }

  async unfollow(userToUnfollow) {
    try {
      const result = await sql.query`
        DELETE FROM user_relationships
        WHERE follower_id = ${this.id} AND followed_id = ${userToUnfollow.id}`;

      if (result.rowsAffected[0] === 0) {
        throw new Error("User is not following this user");
      }

      return true;
    } catch (err) {
      console.error("Database delete error:", err);
      throw err;
    }
  }

  async isFollowing(userToCheck) {
    try {
      const result = await sql.query`