const express = require('express');
const router = express.Router();

const { getPostById } = require('./postController');

router.get('/:postId', getPostById);

module.exports = router;