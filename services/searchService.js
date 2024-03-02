const sql = require("mssql");

exports.findPosts = async (searchTerm) => {
  const query = `
        SELECT * FROM posts
        WHERE title LIKE @searchTerm AND deleted = 0;
    `;
  const pool = await sql.connect(); // Connect using your global or existing connection settings
  const results = await pool
    .request()
    .input("searchTerm", sql.VarChar, `%${searchTerm}%`) // Use parameterized input
    .query(query);
  return results; // Return the results
};

exports.findUsers = async (searchTerm) => {
  const query = `
        SELECT * FROM users
        WHERE username LIKE @searchTerm OR (firstname + ' ' + lastname) LIKE @searchTerm;
    `;
  const pool = await sql.connect(); // Assume global or persistent connection
  const results = await pool
    .request()
    .input("searchTerm", sql.VarChar, `%${searchTerm}%`) // Safe parameterized input
    .query(query);
  return results; // Return the fetched users
};

exports.findJobs = async (searchTerm) => {
  const query = `
        SELECT * FROM JobPostings
        WHERE title LIKE @searchTerm OR description LIKE @searchTerm;
    `;
  const pool = await sql.connect(); // Assume global or persistent connection
  const results = await pool
    .request()
    .input("searchTerm", sql.VarChar, `%${searchTerm}%`) // Safe parameterized input
    .query(query);
  return results; // Return the fetched jobs
};
