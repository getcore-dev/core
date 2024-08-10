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

router.get('/communities', async (req, res) => {
    const searchTerm = req.query.term;

    try {
        const communities = await communityQueries.searchCommunities(searchTerm);
        res.json(communities);
    } catch (err) {
        console.error('Error searching communities:', err);
        res.status(500).send('Error searching communities');
    }
});

router.get('/skills', async (req, res) => {
    const searchTerm = req.query.term;

    try {
        const skills = await jobQueries.searchSkills(searchTerm);
        res.json(skills);
    } catch (err) {
        console.error('Error searching skills:', err);
        res.status(500).send('Error searching skills');
    }
});

router.get('/companies', async (req, res) => {
    const searchTerm = req.query.term;

    try {
        const companies = await jobQueries.searchCompanies(searchTerm);
        res.json(companies);
    } catch (err) {
        console.error('Error searching companies:', err);
        res.status(500).send('Error searching companies');
    }
});

router.get('/posts', async (req, res) => {
    const searchTerm = req.query.term;

    try {
        const posts = await postQueries.searchPosts(searchTerm);
        res.json(posts);
    } catch (err) {
        console.error('Error searching posts:', err);
        res.status(500).send('Error searching posts');
    }
});

router.get('/all', async (req, res) => {
    const searchTerm = req.query.term;

    try {
        const posts = await postQueries.searchPosts(searchTerm);
        const users = await userQueries.searchUsers(searchTerm);
        const jobs = await jobQueries.searchJobs(searchTerm);
        const communities = await communityQueries.searchCommunities(searchTerm);
        const companies = await jobQueries.searchCompanies(searchTerm);

        res.json({ users, posts, jobs, communities, companies });
    } catch (err) {
        console.error('Error searching all:', err);
        res.status(500).send('Error searching all');
    }
});

module.exports = router;