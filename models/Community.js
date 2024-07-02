const sql = require("mssql");

class Community {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.shortname = data.shortname;
    this.description = data.description;
    this.rules = data.rules;
    this.PrivacySetting = data.PrivacySetting;
    this.JobsEnabled = data.JobsEnabled;
    this.Tags = data.Tags;
    this.mini_icon = data.mini_icon;
    this.MemberCount = data.MemberCount;
    this.PostCount = data.PostCount;
  }

  static async getById(communityId) {
    try {
      const result = await sql.query`
        SELECT * FROM communities WHERE id = ${communityId}`;
      return result.recordset[0] ? new Community(result.recordset[0]) : null;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  static async getByShortName(shortname) {
    try {
      const result = await sql.query`
        SELECT * FROM communities WHERE shortname = ${shortname}`;
      return result.recordset[0] ? new Community(result.recordset[0]) : null;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  static async getAll() {
    try {
      const result = await sql.query`
        SELECT c.*,
        (SELECT COUNT(DISTINCT user_id) FROM community_memberships WHERE community_id = c.id) AS CommunityMemberCount,
        (SELECT COUNT(*) FROM posts WHERE communities_id = c.id AND deleted = 0) AS PostCount
        FROM communities c`;
      return result.recordset.map(community => new Community(community));
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  async update(updateData) {
    const { description, rules, PrivacySetting, JobsEnabled, Tags, mini_icon } = updateData;

    try {
      if (description !== undefined && description !== this.description) {
        await sql.query`
          UPDATE communities 
          SET description = ${description}
          WHERE id = ${this.id}`;
        this.description = description;
      }

      if (rules !== undefined && rules !== this.rules) {
        await sql.query`
          UPDATE communities 
          SET rules = ${rules}
          WHERE id = ${this.id}`;
        this.rules = rules;
      }

      if (Tags !== undefined && Tags !== this.Tags) {
        await sql.query`
          UPDATE communities 
          SET Tags = ${Tags}
          WHERE id = ${this.id}`;
        this.Tags = Tags;
      }

      if (mini_icon !== undefined && mini_icon !== this.mini_icon) {
        await sql.query`
          UPDATE communities 
          SET mini_icon = ${mini_icon}
          WHERE id = ${this.id}`;
        this.mini_icon = mini_icon;
      }

      return true;
    } catch (err) {
      console.error("Database query error");
      throw err;
    }
  }

  async getMembers() {
    try {
      const result = await sql.query`
        SELECT u.id, u.username, cm.is_moderator, cm.joined_at 
        FROM community_memberships cm
        JOIN users u ON cm.user_id = u.id
        WHERE cm.community_id = ${this.id}
        ORDER BY cm.joined_at`;

      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  static async getUserMemberships(userId) {
    try {
      const result = await sql.query`
        SELECT community_id, is_moderator 
        FROM dbo.community_memberships 
        WHERE user_id = ${userId}
      `;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  static async checkModerator(userId, communityId) {
    try {
      const result = await sql.query`
        SELECT * FROM community_memberships
        WHERE user_id = ${userId} AND community_id = ${communityId} AND is_moderator = 1`;

      return result.recordset.length > 0;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  static async join(userId, communityId) {
    try {
      const checkExistence = await sql.query`
        SELECT * FROM community_memberships 
        WHERE user_id = ${userId} AND community_id = ${communityId}
      `;
      if (checkExistence.recordset.length > 0) {
        throw new Error("User is already a member of this community.");
      }

      await sql.query`
        INSERT INTO community_memberships (user_id, community_id)
        VALUES (${userId}, ${communityId})
      `;

      await sql.query`
        UPDATE communities 
        SET MemberCount = (
          SELECT COUNT(DISTINCT user_id) 
          FROM community_memberships 
          WHERE community_id = ${communityId}
        )
        WHERE id = ${communityId}
      `;

      return "User successfully joined the community.";
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  static async leave(userId, communityId) {
    try {
      await sql.query`
        DELETE FROM community_memberships 
        WHERE user_id = ${userId} AND community_id = ${communityId}`;

      await sql.query`
        UPDATE communities 
        SET MemberCount = (
          SELECT COUNT(DISTINCT user_id) 
          FROM community_memberships 
          WHERE community_id = ${communityId}
        )
        WHERE id = ${communityId}
      `;
      return "User successfully left the community.";
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  static async checkMembership(userId, communityId) {
    try {
      const result = await sql.query`
        SELECT * FROM community_memberships 
        WHERE user_id = ${userId} AND community_id = ${communityId}`;

      return result.recordset.length > 0;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }

  async getPostCount() {
    try {
      const result = await sql.query`
        SELECT COUNT(*) AS count FROM posts 
        WHERE communities_id = ${this.id} AND deleted = 0`;

      return result.recordset[0].count;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  }
}

module.exports = Community;