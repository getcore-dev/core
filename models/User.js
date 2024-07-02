const sql = require("mssql");
const bcrypt = require("bcrypt");

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
      const result =
        await sql.query`SELECT * FROM users WHERE email = ${email}`;
      return result.recordset[0] ? new User(result.recordset[0]) : null;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  static async findByGoogleId(googleId) {
    try {
      const result =
        await sql.query`SELECT * FROM users WHERE google_id = ${googleId}`;
      return result.recordset[0] ? new User(result.recordset[0]) : null;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  static async findByGitHubId(githubId) {
    try {
      const result =
        await sql.query`SELECT * FROM users WHERE github_id = ${githubId}`;
      return result.recordset[0] ? new User(result.recordset[0]) : null;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  static async create(userData) {
    try {
      const result = await sql.query`
        INSERT INTO users (
          username, email, avatar, google_id, github_id, github_url, created_at, 
          isAdmin, bio, points, verified, isBanned, lastLogin, firstname, lastname, 
          leetcode_url, linkedin_url, zipcode, profile_border_color, link, link2, 
          settings_PrivateJobNames, settings_PrivateSchoolNames, jobPreferredTitle, 
          jobPreferredSkills, jobPreferredLocation, jobExperienceLevel, jobPreferredIndustry, 
          jobPreferredSalary, githubAccessToken, recruiter_id
        ) 
        OUTPUT INSERTED.*
        VALUES (
          ${userData.username}, ${userData.email}, ${userData.avatar}, ${userData.googleId}, 
          ${userData.githubId}, ${userData.githubUsername}, GETDATE(), 0, '', 0, 0, 0, GETDATE(), 
          ${userData.firstname}, ${userData.lastname}, ${userData.leetcodeUrl}, ${userData.linkedinUrl}, 
          ${userData.zipcode}, ${userData.profileBorderColor}, ${userData.link}, ${userData.link2}, 
          ${userData.settingsPrivateJobNames}, ${userData.settingsPrivateSchoolNames}, 
          ${userData.jobPreferredTitle}, ${userData.jobPreferredSkills}, ${userData.jobPreferredLocation}, 
          ${userData.jobExperienceLevel}, ${userData.jobPreferredIndustry}, ${userData.jobPreferredSalary}, 
          ${userData.githubAccessToken}, ${userData.recruiterId}
        )`;

      return new User(result.recordset[0]);
    } catch (err) {
      console.error("Database insert error:", err);
      throw err;
    }
  }

  async save() {
    try {
      await sql.query`
        UPDATE users
        SET 
          username = ${this.username},
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
        message: `User ID ${this.id} is now ${
          this.isAdmin ? "an admin" : "not an admin"
        }.`,
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
        message: `User ID ${this.id} is now ${
          this.isBanned ? "banned" : "unbanned"
        }.`,
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
        message: `User ID ${this.id} is now ${
          this.verified ? "verified" : "unverified"
        }.`,
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
      request.input("userId", sql.VarChar, this.id);
      if (limit) {
        request.input("limit", sql.Int, limit);
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
      request.input("userId", sql.VarChar, this.id);
      if (limit) {
        request.input("limit", sql.Int, limit);
      }

      const result = await request.query(query);
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  async follow(userToFollow) {
    try {
      const existingRelationship = await sql.query`
        SELECT * 
        FROM user_relationships
        WHERE follower_id = ${this.id} AND followed_id = ${userToFollow.id}`;

      if (existingRelationship.recordset.length > 0) {
        throw new Error("User is already following this user");
      }

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
        SELECT COUNT(*) AS count
        FROM user_relationships
        WHERE follower_id = ${this.id} AND followed_id = ${userToCheck.id}`;

      return result.recordset[0].count > 0;
    } catch (err) {
      console.error("Database query error:", err);
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
      console.error("Database query error:", err);
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
      console.error("Database query error:", err);
      throw err;
    }
  }

  async updateProfilePicture(profilePicturePath) {
    try {
      const result = await sql.query`
        UPDATE users 
        SET avatar = ${profilePicturePath}
        WHERE id = ${this.id}`;

      if (result.rowsAffected[0] > 0) {
        this.avatar = profilePicturePath;
        return true;
      }
      return false;
    } catch (err) {
      console.error("Database update error:", err);
      throw err;
    }
  }

  async getJobPreferences() {
    try {
      const result = await sql.query`
        SELECT jobPreferredTitle, jobPreferredSkills, jobPreferredLocation, jobExperienceLevel, jobPreferredIndustry, jobPreferredSalary 
        FROM users 
        WHERE id = ${this.id}`;
      return result.recordset[0];
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  async getJobExperience() {
    try {
      const result = await sql.query`
        SELECT * FROM job_experiences WHERE userId = ${this.id}`;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  async getEducationExperience() {
    try {
      const result = await sql.query`
        SELECT * FROM education_experiences WHERE userId = ${this.id}`;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  async clearJobExperience() {
    try {
      await sql.query`DELETE FROM job_experiences WHERE userId = ${this.id}`;
      await sql.query`
        DELETE FROM job_experiences_tags WHERE experienceId IN (
          SELECT id FROM job_experiences WHERE userId = ${this.id}
        )`;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  async clearEducationExperience() {
    try {
      await sql.query`DELETE FROM education_experiences WHERE userId = ${this.id}`;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  async addJobExperience(jobData) {
    try {
      const result = await sql.query`
        INSERT INTO job_experiences (userId, title, employmentType, companyName, location, startDate, endDate, description, tags)
        OUTPUT INSERTED.id
        VALUES (${this.id}, ${jobData.title}, ${jobData.employmentType}, ${jobData.companyName}, ${jobData.location}, ${jobData.startDate}, ${jobData.endDate}, ${jobData.description}, ${jobData.tags})`;
      return result.recordset[0].id;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  async addEducationExperience(eduData) {
    try {
      const result = await sql.query`
        INSERT INTO education_experiences (userId, institutionName, degree, fieldOfStudy, startDate, endDate, isCurrent, grade, activities, description)
        OUTPUT INSERTED.id
        VALUES (${this.id}, ${eduData.institutionName}, ${eduData.degree}, ${eduData.fieldOfStudy}, ${eduData.startDate}, ${eduData.endDate}, ${eduData.isCurrent}, ${eduData.grade}, ${eduData.activities}, ${eduData.description})`;
      return result.recordset[0].id;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  static async updateGitHubId(userId, githubId) {
    try {
      await sql.query`
        UPDATE users
        SET github_id = ${githubId}
        WHERE id = ${userId}`;
    } catch (err) {
      console.error("Database update error:", err);
      throw err;
    }
  }

  static async updateGitHubUsername(userId, githubUsername) {
    try {
      await sql.query`
        UPDATE users
        SET github_url = ${githubUsername}
        WHERE id = ${userId}`;
    } catch (err) {
      console.error("Database update error:", err);
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
      console.error("Database update error:", err);
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
      console.error("Database delete error:", err);
      throw err;
    }
  }

  async updateField(field, value) {
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
      "settings_PrivateJobNames",
      "settings_PrivateSchoolNames",
      "jobPreferredTitle",
      "jobPreferredSkills",
      "jobPreferredLocation",
      "jobExperienceLevel",
      "jobPreferredIndustry",
      "jobPreferredSalary",
    ];

    if (!validFields.includes(field)) {
      throw new Error(`Invalid field name: ${field}`);
    }

    try {
      if (["leetcode_url", "linkedin_url", "github_url"].includes(field)) {
        value = value.replace(
          /^https?:\/\/(?:www\.)?(?:leetcode\.com|linkedin\.com\/in|github\.com)\//i,
          ""
        );
      }

      if (field === "recruiter_id") {
        const recruiterExists = await sql.query`
          SELECT COUNT(*) AS count
          FROM Recruiters
          WHERE recruiter_id = ${value}`;
        if (recruiterExists.recordset[0].count === 0) {
          throw new Error(`Invalid recruiter_id: ${value}`);
        }
      }

      if (
        field === "settings_PrivateJobNames" ||
        field === "settings_PrivateSchoolNames"
      ) {
        value = value === true || value === "true";
      }

      let sqlType = sql.VarChar;
      if (
        field === "settings_PrivateJobNames" ||
        field === "settings_PrivateSchoolNames"
      ) {
        sqlType = sql.Bit;
      } else if (typeof value === "number") {
        sqlType = sql.Int;
      }

      const query = `
        UPDATE users
        SET ${field} = @value
        WHERE id = @userId`;

      const request = new sql.Request();
      request.input("value", sqlType, value);
      request.input("userId", sql.VarChar, this.id);
      const result = await request.query(query);

      if (result.rowsAffected[0] > 0) {
        this[field] = value;
        return true;
      }
      return false;
    } catch (err) {
      console.error("Database update error:", err);
      throw err;
    }
  }
}

module.exports = User;
