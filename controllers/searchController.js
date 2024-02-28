const searchService = require('../services/searchService');

exports.searchPosts = async (req, res) => {
    try {
        const { searchTerm } = req.query;
        const results = await searchService.findPosts(searchTerm);
        // Render search results page instead of sending JSON
        res.render('search.ejs', { searchTerm: searchTerm, results: results.recordset, user: req.params.user });
    } catch (error) {
        res.status(500).send(error.toString());
    }
};
