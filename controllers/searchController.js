const searchService = require('../services/searchService');

exports.searchAll = async (req, res) => {
    try {
        const { searchTerm } = req.query;
        // Initiate all search queries in parallel
        const [postResults, userResults, jobResults] = await Promise.all([
            searchService.findPosts(searchTerm),
            searchService.findUsers(searchTerm),
            searchService.findJobs(searchTerm)
        ]);

        // Render search results page with all results
        res.render('search.ejs', {
            searchTerm: searchTerm,
            posts: postResults.recordset,  // Assuming the result structure from mssql
            users: userResults.recordset,
            jobs: jobResults.recordset,
            user: req.user  // Usually, user info is in req.user, not req.params.user
        });

    } catch (error) {
        console.error('Search error:', error);
        res.status(500).send('Server error occurred while searching');
    }
};
