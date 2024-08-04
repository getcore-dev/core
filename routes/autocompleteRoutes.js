// autocompleteRoutes.js

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { checkAuthenticated } = require('../middleware/authMiddleware');
const communityQueries = require('../queries/communityQueries');
const postQueries = require('../queries/postQueries');
const jobQueries = require('../queries/jobQueries');
const userQueries = require('../queries/userQueries');

router.get('/users', async (req, res) => {
    const searchTerm = req.query.term;
    
    try {
        const users = await userQueries.searchUsers(searchTerm);
        res.json(users);
    } catch (err) {
        console.error('Error searching users:', err);
        res.status(500).send('Error searching users');
    }
});

router.get('/jobs', async (req, res) => {
    const searchTerm = req.query.term;

    try {
        const jobs = await jobQueries.searchJobs(searchTerm);
        res.json(jobs);
    } catch (err) {
        console.error('Error searching jobs:', err);
        res.status(500).send('Error searching jobs');
    }
});

module.exports = router;