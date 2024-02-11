// communityQueries.js
const sql = require("mssql");
// Assuming you have a users table and a communities table already set up

const communityQueries = {
  joinCommunity: async (userId, communityId) => {
    try {
      // Ensure the user is not already a member
      const checkExistence = await sql.query`
        SELECT * FROM community_memberships 
        WHERE user_id = ${userId} AND community_id = ${communityId}`;

      if (checkExistence.recordset.length > 0) {
        throw new Error("User is already a member of this community.");
      }

      // Add user to the community
      await sql.query`
        INSERT INTO community_memberships (user_id, community_id) 
        VALUES (${userId}, ${communityId})`;

      await sql.query`
    UPDATE communities 
    SET MemberCount = MemberCount + 1 
    WHERE id = ${communityId}`;

      return "User successfully joined the community.";
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
    SET MemberCount = MemberCount - 1 
    WHERE id = ${communityId}`;

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
