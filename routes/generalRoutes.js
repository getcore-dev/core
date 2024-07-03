const express = require("express");
const router = express.Router();
const sql = require("mssql");
const {
  checkAuthenticated,
  checkNotAuthenticated,
} = require("../middleware/authMiddleware");
const viewController = require("../controllers/viewController");
const userQueries = require("../queries/userQueries");
const jobQueries = require("../queries/jobQueries");
const utilFunctions = require("../utils/utilFunctions");
const githubService = require("../services/githubService");
const postQueries = require("../queries/postQueries");
const { util } = require("chai");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const { BlobServiceClient } = require("@azure/storage-blob");
const notificationQueries = require("../queries/notificationQueries");
const cacheMiddleware = require("../middleware/cache");
const { cache } = require("ejs");
const sharp = require("sharp"); // Example library for image processing
const communityQueries = require("../queries/communityQueries");
const updateQueries = require("../queries/updateQueries");
const AZURE_STORAGE_CONNECTION_STRING =
  process.env.AZURE_STORAGE_CONNECTION_STRING; // Ensure this is set in your environment variables

// Home page
router.get("/", viewController.renderHomePage);

router.get("/about", viewController.renderAboutPage);

router.get("/privacy", viewController.renderPrivacyPage);

router.get("/settings", checkAuthenticated, viewController.renderSettingsPage);

router.get("/edits", checkAuthenticated, async (req, res) => {
  const userId = req.user.id;
  const missingFields = await utilFunctions.checkMissingFields(userId);
  res.render("edits.ejs", { user: req.user, missingFields });
});

router.post("/user/:userId/settings", checkAuthenticated, async (req, res) => {
  const userId = req.params.userId;
  const updates = req.body;

  try {
    for (let field in updates) {
      if (Object.hasOwnProperty.call(updates, field)) {
        await userQueries.updateField(userId, field, updates[field]);
      }
    }

    res.redirect("/user/" + req.user.username);
  } catch (err) {
    console.error("Error updating user fields:", err.message);
    res.status(500).send("Internal Server Error");
  }
});

router.post("/edits", checkAuthenticated, async (req, res) => {
  const userId = req.user.id;
  const updates = req.body;

  // Exclude the userId from updates to avoid updating it
  delete updates.id;

  try {
    for (let field in updates) {
      if (Object.hasOwnProperty.call(updates, field)) {
        await userQueries.updateField(userId, field, updates[field]);
      }
    }

    res.redirect("/"); // Redirect to home or a confirmation page
  } catch (err) {
    console.error("Error updating user fields:", err.message);
    res.status(500).send("Internal Server Error");
  }
});

// 404 page
router.get("/404", (req, res) => {
  const error = {
    status: 404,
    message: "Page not found",
  };
  res.render("error.ejs", { user: req.user, error });
});

router.get("/user/:username", viewController.renderUserProfile);

router.get("/user/:username/followers", viewController.renderFollowers);

router.get("/user/:username/following", viewController.renderFollowing);

router.get("/profile/jobs", checkAuthenticated, async (req, res) => {
  const userId = req.user.id;
  res.render("edit-jobs-profile.ejs", { user: req.user });
});

router.post("/profile/jobs", checkAuthenticated, async (req, res) => {
  const userId = req.user.id;
  const updates = req.body;
  console.log(updates);

  try {
    for (let field in updates) {
      if (Object.hasOwnProperty.call(updates, field)) {
        await userQueries.updateField(userId, field, updates[field]);
      }
    }

    res.redirect("/jobs");
  } catch (err) {
    console.error("Error updating user fields:", err.message);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/redirect/*", async (req, res) => {
  const link = req.params[0];

  if (!link) {
    return res.status(404).send("Link not found");
  }

  if (!link.startsWith("http")) {
    return res.status(400).send("Invalid link");
  }

  res.render("link-redirect.ejs", { user: req.user, link });
});

router.get("/learning", checkAuthenticated, (req, res) => {
  res.render("learning.ejs", { user: req.user });
});

router.get("/updates", async (req, res) => {
  try {
    const updates = await updateQueries.getUpdates();
    res.render("updates.ejs", { user: req.user, updates });
  } catch (error) {
    console.error("Error fetching updates:", error);
    res.render("error.ejs", {
      user: req.user,
      error: { message: error.message },
    });
  }
});

router.get("/create", checkAuthenticated, async (req, res) => {
  const tags = await postQueries.getAllTags();
  res.render("create-post.ejs", { user: req.user, tags, communityId: null });
});

router.get("/feedback", checkAuthenticated, async (req, res) => {
  res.render("create-feedback.ejs", { user: req.user });
});

router.get("/feedback/success", checkAuthenticated, async (req, res) => {
  res.render("success-feedback.ejs", { user: req.user });
});

router.post("/feedback", checkAuthenticated, async (req, res) => {
  const userId = req.user.id;
  const { title, attachmentUrl, bodyText } = req.body;

  try {
    await postQueries.createFeedback(userId, title, attachmentUrl, bodyText);
    res.redirect("/feedback/success");
  } catch (err) {
    console.error("Error creating feedback:", err);
    res.status(500).send("Error creating feedback");
  }
});

router.get("/edit-profile", checkAuthenticated, async (req, res) => {
  const full_user = await userQueries.findById(req.user.id);
  res.render("edit-profile.ejs", { user: req.user, edit_user: full_user });
});

router.get("/edit-experience", checkAuthenticated, async (req, res) => {
  res.render("edit-experience.ejs", { user: req.user });
});

router.get(
  "/edit-education-experience",
  checkAuthenticated,
  async (req, res) => {
    res.render("edit-education-experience.ejs", { user: req.user });
  }
);

router.post(
  "/edit-profile",
  checkAuthenticated,
  upload.single("avatar"),
  async (req, res) => {
    const updates = req.body;
    const userId = req.user.id;
    const file = req.file; // This contains your uploaded file

    try {
      // Handle file upload to Azure Blob Storage if there's a file
      if (file) {
        const blobServiceClient = BlobServiceClient.fromConnectionString(
          AZURE_STORAGE_CONNECTION_STRING
        );
        const containerClient =
          blobServiceClient.getContainerClient("coreavatars");
        const blobName = "profiles/" + userId + "/" + file.originalname;
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        const containerName = "coreavatars";
        await blockBlobClient.uploadFile(file.path); // Uploads the file to Azure Blob Storage
        const pictureUrl = `https://${blobServiceClient.accountName}.blob.core.windows.net/${containerName}/${blobName}`;
        updates["avatar"] = pictureUrl;

        // get dominant hex color from image

        const dominantColor = await utilFunctions.getDominantColor(pictureUrl);

        updates["profile_border_color"] = dominantColor;
      }

      // Update other user fields
      for (let field in updates) {
        if (Object.hasOwnProperty.call(updates, field)) {
          await userQueries.updateField(userId, field, updates[field]);
        }
      }

      res.redirect("/user/" + req.user.username);
    } catch (err) {
      console.error("Error updating user fields:", err.message);
      res.status(500).send("Internal Server Error");
    }
  }
);

router.post(
  "/users/:followedId/follow",
  checkAuthenticated,
  async (req, res) => {
    try {
      const followerId = req.user.id;
      const followedId = req.params.followedId;
      await userQueries.followUser(followerId, followedId);
      await notificationQueries.createNotification(
        followerId,
        followedId,
        "follow",
        null
      );
      await userQueries.removeDuplicateFollows();
      const updatedFollowerCount = await userQueries.getFollowerCount(
        followedId
      );
      res.json({ buttonText: "Unfollow", followerCount: updatedFollowerCount });
    } catch (err) {
      console.error("Error following user:", err);
      res.status(500).json({ error: "Error following user" });
    }
  }
);

router.post(
  "/users/:followedId/unfollow",
  checkAuthenticated,
  async (req, res) => {
    try {
      const followerId = req.user.id;
      const followedId = req.params.followedId;
      await userQueries.unfollowUser(followerId, followedId);

      await userQueries.removeDuplicateFollows();
      const updatedFollowerCount = await userQueries.getFollowerCount(
        followedId
      );
      res.json({ buttonText: "Follow", followerCount: updatedFollowerCount });
    } catch (err) {
      console.error("Error unfollowing user:", err);
      res.status(500).json({ error: "Error unfollowing user" });
    }
  }
);
router.get(
  "/users/:followedId/is-following",
  checkAuthenticated,
  async (req, res) => {
    try {
      const followerId = req.user.id;
      const followedId = req.params.followedId;

      const isFollowing = await userQueries.isFollowing(followerId, followedId);

      res.json({ isFollowing });
    } catch (err) {
      console.error("Error checking follow status:", err);
      res.status(500).send("Error checking follow status");
    }
  }
);

router.get("/tags/:tagName", async (req, res) => {
  try {
    const tagName = req.params.tagName;
    console.log(tagName);
    const JobTagId = await jobQueries.getTagId(tagName);
    const PostTagId = await postQueries.getTagId(tagName);
    const JobSkillsId = await jobQueries.getSkillsId(tagName);

    let jobs = [];
    let posts = [];

    console.log(JobTagId, PostTagId, JobSkillsId);

    if (!JobTagId && !PostTagId && !JobSkillsId) {
      res.status(404).send("Tag not found");
    }

    if (JobTagId) {
      jobs = await jobQueries.getJobsByTag(JobTagId);
    }

    if (JobSkillsId) {
      jobs = jobs.concat(await jobQueries.getJobsBySkills(JobSkillsId));
    }

    if (PostTagId) {
      posts = await postQueries.getPostsByTag(PostTagId);
    }

    res.render("tag.ejs", { tag: tagName, jobs, posts, user: req.user });
  } catch (err) {
    console.error("Error fetching job postings:");
    res.status(500).send("Error fetching job postings");
  }
});

router.get("/users/:userId/following", async (req, res) => {
  try {
    const userId = req.params.userId;

    const following = await userQueries.getFollowing(userId);

    res.render("following.ejs", { user: req.user, following });
  } catch (err) {
    console.error("Error fetching following users:", err);
    res.status(500).send("Error fetching following users");
  }
});

router.get("/users/:userId/followers", async (req, res) => {
  try {
    const userId = req.params.userId;

    const followers = await userQueries.getFollowers(userId);

    res.render("followers.ejs", { user: req.user, followers });
  } catch (err) {
    console.error("Error fetching followers:", err);
    res.status(500).send("Error fetching followers");
  }
});

router.get("/:whateverbs", async (req, res) => {
  res.redirect("/");
});

// Error handling middleware
router.use((error, req, res, next) => {
  console.error(error);
  res
    .status(error.status || 500)
    .render("error.ejs", { user: req.user, error: error.message });
});

module.exports = router;
