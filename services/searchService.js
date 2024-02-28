const sql = require("mssql");

exports.findPosts = async (searchTerm) => {
    const query = `
        SELECT * FROM posts
        WHERE title LIKE '%${searchTerm}%';
    `;
    // Add parameterized query to prevent SQL injection if using SQL databases
    const results = await sql.query(query);
    return results; 
};
