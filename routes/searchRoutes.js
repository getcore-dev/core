const express = require("express");
const router = express.Router();
const searchController = require("../controllers/searchController");
const cacheMiddleware = require("../middleware/cache");

// Route for search
router.get("/", cacheMiddleware(1200), searchController.searchAll);

module.exports = router;
