const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');

// Route for search
router.get('/', searchController.searchAll);

router.get('/results', searchController.getSearchResults);

router.get('/jobs', searchController.searchJobs);

router.get('/users', searchController.searchUsers);

router.get('/posts', searchController.searchPosts);

router.get('/preview', searchController.searchPreview);

module.exports = router;
