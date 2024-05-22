// communityQueries.js
const sql = require("mssql");
// Assuming you have a users table and a communities table already set up

const communityQueries = {
  getCommunity: async (communityId) => {
    try {
      const result = await sql.query`
        SELECT * FROM communities WHERE id = ${communityId}`;

      return result.recordset[0];
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  updateCommunityInfo: async (communityId, updateData) => {
    const { description, rules, PrivacySetting, JobsEnabled, Tags, mini_icon } =
      updateData;

    try {
      const community = await sql.query`
          SELECT * FROM communities WHERE id = ${communityId}`;

      if (!community.recordset[0]) {
        throw new Error("Community not found.");
      }

      console.log(community.recordset[0]);

      console.log("Updating community with ID", communityId);

      // compare with the existing data and update only the changed fields
      if (
        description !== undefined &&
        description !== community.recordset[0].description
      ) {
        await sql.query`
          UPDATE communities 
          SET description = ${description}
          WHERE id = ${communityId}`;
      }

      if (rules !== undefined && rules !== community.recordset[0].rules) {
        await sql.query`
          UPDATE communities 
          SET rules = ${rules}
          WHERE id = ${communityId}`;
      }

      if (Tags !== undefined && Tags !== community.recordset[0].Tags) {
        await sql.query`
          UPDATE communities 
          SET Tags = ${Tags}
          WHERE id = ${communityId}`;
      }

      if (
        mini_icon !== undefined &&
        mini_icon !== community.recordset[0].mini_icon
      ) {
        await sql.query`
          UPDATE communities 
          SET mini_icon = ${mini_icon}
          WHERE id = ${communityId}`;
      }
      return true;
    } catch (err) {
      console.error("Database query error");
      throw err;
    }
  },

  getCommunityIdByShortName: async (shortname) => {
    try {
      const result = await sql.query`
        SELECT id FROM communities WHERE shortname = ${shortname}`;

      return result.recordset[0].id;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  checkModerator: async (userId, communityId) => {
    try {
      console.log(
        "Checking moderator status for user",
        userId,
        "in community",
        communityId
      );

      const result = await sql.query`
        SELECT * FROM community_memberships
        WHERE user_id = ${userId} AND community_id = ${communityId} AND is_moderator = 1`;

      return result.recordset.length > 0;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getCommunities: async () => {
    try {
      const result = await sql.query`
        SELECT c.*,
        (SELECT COUNT(DISTINCT user_id) FROM community_memberships WHERE community_id = c.id) AS CommunityMemberCount,
        (SELECT COUNT(*) FROM posts WHERE communities_id = c.id AND deleted = 0) AS PostCount
        FROM communities c`;

      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  checkModerator: async (userId, communityId) => {
    try {
      const result = await sql.query`
        SELECT * FROM community_memberships
        WHERE user_id = ${userId} AND community_id = ${communityId} AND is_moderator = 1`;

      return result.recordset.length > 0;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  joinCommunity: async (userId, communityId) => {
    try {
      // Ensure the user is not already a member
      const checkExistence = await sql.query`
        SELECT * FROM community_memberships 
        WHERE user_id = ${userId} AND community_id = ${communityId}
      `;
      if (checkExistence.recordset.length > 0) {
        throw new Error("User is already a member of this community.");
      }

      // Add user to the community
      await sql.query`
        INSERT INTO community_memberships (user_id, community_id)
        VALUES (${userId}, ${communityId})
      `;

      // Get count of distinct members in the community and set it to the MemberCount column
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
  },

  getCommunityPostCount: async (communityId) => {
    try {
      const result = await sql.query`
        SELECT COUNT(*) FROM posts 
        WHERE communities_id = ${communityId} AND deleted = 0`;

      return result.recordset[0][""];
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  leaveCommunity: async (userId, communityId) => {
    try {
      // Remove user from the community
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
  },

  checkMembership: async (userId, communityId) => {
    try {
      const result = await sql.query`
        SELECT * FROM community_memberships 
        WHERE user_id = ${userId} AND community_id = ${communityId}`;

      return result.recordset.length > 0;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  listCommunityMembers: async (communityId) => {
    try {
      const result = await sql.query`
        SELECT u.id, u.username, cm.is_moderator, cm.joined_at 
        FROM community_memberships cm
        JOIN users u ON cm.user_id = u.id
        WHERE cm.community_id = ${communityId}
        ORDER BY cm.joined_at`;

      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },
};

module.exports = communityQueries;
