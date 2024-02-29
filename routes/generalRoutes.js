const express = require("express");
const router = express.Router();
const sql = require("mssql");
const {
  checkAuthenticated,
  checkNotAuthenticated,
} = require("../middleware/authMiddleware");
const viewController = require("../controllers/viewController");
const userQueries = require("../queries/userQueries");
const utilFunctions = require("../utils/utilFunctions");
const githubService = require("../services/githubService");
const postQueries = require("../queries/postQueries");
const { util } = require("chai");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const { BlobServiceClient } = require("@azure/storage-blob");
const AZURE_STORAGE_CONNECTION_STRING =
  process.env.AZURE_STORAGE_CONNECTION_STRING; // Ensure this is set in your environment variables

// Home page
router.get("/", viewController.renderHomePage);

router.get("/edits", checkAuthenticated, async (req, res) => {
  const userId = req.user.id;
  const missingFields = await utilFunctions.checkMissingFields(userId);
  res.render("edits.ejs", { user: req.user, missingFields });
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

router.get("/profile/:username", viewController.renderUserProfile);

// Jobs page
router.get("/jobs", (req, res) => {
  res.render("jobs.ejs", { user: req.user });
});

// Learning page
router.get("/learning", checkAuthenticated, (req, res) => {
  res.render("learning.ejs", { user: req.user });
});

router.get("/updates", async (req, res) => {
  try {
    const commits = await githubService.fetchCommits();

    // Resolve the GitHub usernames for each commit
    const commitsWithUsernames = await Promise.all(
      commits.map(async (commit) => {
        const userDetails = await utilFunctions.getUserDetailsFromGithub(
          commit.author.githubUsername
        );
        return {
          ...commit,
          coreUser: userDetails, // or the appropriate property
        };
      })
    );

    res.render("updates.ejs", {
      user: req.user,
      commits: commitsWithUsernames,
    });
  } catch (error) {
    console.error("Error fetching updates:", error);
    res.render("error.ejs", {
      user: req.user,
      error: { message: error.message },
    });
  }
});

// Post creation page
router.get("/post/create", checkAuthenticated, async (req, res) => {
  const tags = await postQueries.getAllTags();
  res.render("create-post.ejs", { user: req.user, tags });
});

// Individual post page
router.get("/post", async (req, res) => {
  res.render("post.ejs", { user: req.user });
});

router.get("/edit-profile", checkAuthenticated, async (req, res) => {
  const full_user = await userQueries.findById(req.user.id);
  res.render("edit-profile.ejs", { user: req.user, edit_user: full_user });
});

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
      }

      console.log("Updates:", updates);

      // Update other user fields
      for (let field in updates) {
        if (Object.hasOwnProperty.call(updates, field)) {
          await userQueries.updateField(userId, field, updates[field]);
        }
      }

      res.redirect("/profile/" + req.user.username);
    } catch (err) {
      console.error("Error updating user fields:", err.message);
      res.status(500).send("Internal Server Error");
    }
  }
);

// Error handling middleware
router.use((error, req, res, next) => {
  console.error(error);
  res
    .status(error.status || 500)
    .render("error.ejs", { user: req.user, error: error.message });
});

module.exports = router;
