const express = require("express");
const router = express.Router();
const sql = require("mssql");
const { checkAuthenticated } = require("../middleware/authMiddleware");
const communityQueries = require("../queries/communityQueries");

router.get("/:communityName", async (req, res) => {
  const communityName = req.params.communityName;

  try {
    const community =
      await sql.query`SELECT * FROM communities WHERE shortname = ${communityName}`;

    if (!community.recordset[0]) {
      return res.render("error.ejs", {
        user: req.user,
        error: { message: "That community was not found." },
      });
    }

    if (community.recordset[0].PrivacySetting === "Private") {
      return res.render("error.ejs", {
        user: req.user,
        error: { message: "That community is private." },
      });
    }

    const communityId = community.recordset[0].id;

    res.render("communities.ejs", {
      user: req.user,
      community: community.recordset[0],
      communityId: communityId,
      communityPostCount: await communityQueries.getCommunityPostCount(
        communityId
      ),
    });
  } catch (err) {
    return res.render("error.ejs", {
      user: req.user,
      error: { message: "Error fetching community" },
    });
  }
});

router.get("/:communityName/isMember", checkAuthenticated, async (req, res) => {
  const userId = req.user.id;
  const communityName = req.params.communityName;

  try {
    const community =
      await sql.query`SELECT id FROM communities WHERE shortname = ${communityName}`;
    if (!community.recordset[0]) {
      return res.status(404).send("Community not found");
    }
    const communityId = community.recordset[0].id;

    const isMember = await communityQueries.checkMembership(
      userId,
      communityId
    );
    res.json({ isMember });
  } catch (error) {
    console.error("Check membership error:", error);
    res.status(500).send("Error checking membership status");
  }
});

router.post("/:communityName/join", checkAuthenticated, async (req, res) => {
  const userId = req.user.id;
  const communityName = req.params.communityName;

  try {
    const community =
      await sql.query`SELECT id FROM communities WHERE shortname = ${communityName}`;
    if (!community.recordset[0]) {
      return res.status(404).send("Community not found");
    }
    const communityId = community.recordset[0].id;

    const message = await communityQueries.joinCommunity(userId, communityId);
    res.status(200).json({ message });
  } catch (error) {
    console.error("Join community error:", error.message);
    return res.status(500).send("Error joining community");
  }
});

router.get("/:communityName/members", async (req, res) => {
  const communityName = req.params.communityName;

  try {
    const community =
      await sql.query`SELECT id FROM communities WHERE shortname = ${communityName}`;
    if (!community.recordset[0]) {
      return res.status(404).send("Community not found");
    }
    const communityId = community.recordset[0].id;

    const members = await communityQueries.getCommunityMembers(communityId);
    res.json({ members });
  } catch (error) {
    console.error("Get community members error:", error.message);
    return res.status(500).send("Error fetching community members");
  }
});

router.get("/:communityName/edit", async (req, res) => {
  const communityName = req.params.communityName;

  try {
    const community =
      await sql.query`SELECT * FROM communities WHERE shortname = ${communityName}`;
    if (!community.recordset[0]) {
      return res.status(404).send("Community not found");
    }

    res.render("edit-community.ejs", {
      user: req.user,
      community: community.recordset[0],
    });
  } catch (error) {
    console.error("Get community error:", error.message);
    return res.status(500).send("Error fetching community");
  }
});

router.get("/", async (req, res) => {
  try {
    const communities = await communityQueries.getCommunities();
    const user = req.user;

    if (user) {
      for (const community of communities) {
        community.isMember = await communityQueries.checkMembership(
          user.id,
          community.id
        );
        community.isModerator = await communityQueries.checkModerator(
          user.id,
          community.id
        );
      }
    }

    res.render("community.ejs", { user: req.user, communities });
  } catch (error) {
    console.error("Get communities error:", error.message);
    return res.status(500).send("Error fetching communities");
  }
});

router.post("/:communityName/leave", checkAuthenticated, async (req, res) => {
  const userId = req.user.id;
  const communityName = req.params.communityName;

  try {
    const community =
      await sql.query`SELECT id FROM communities WHERE shortname = ${communityName}`;
    if (!community.recordset[0]) {
      return res.status(404).send("Community not found");
    }
    const communityId = community.recordset[0].id;

    const message = await communityQueries.leaveCommunity(userId, communityId);
    res.status(200).json({ message });
  } catch (error) {
    console.error("Leave community error:", error.message);
    return res.status(500).send("Error leaving community");
  }
});

module.exports = router;
