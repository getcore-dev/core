const sql = require("mssql");

exports.findPosts = async (searchTerm) => {
  const query = `
    SELECT 
      posts.*,
      users.username AS [author_username],
      users.avatar AS [author_avatar],
      communities.shortname AS [community_name],
      communities.community_color AS [community_color]
    FROM posts
    JOIN users ON posts.user_id = users.id
    JOIN communities ON posts.communities_id = communities.id
    WHERE posts.title LIKE @searchTerm AND posts.deleted = 0;
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
    SELECT 
      JobPostings.*,
      companies.name AS [company_name],
      companies.logo AS [company_logo],
      companies.location AS [company_location],
      companies.description AS [company_description]
    FROM JobPostings
    JOIN companies ON JobPostings.company_id = companies.id
    WHERE JobPostings.title LIKE @searchTerm OR JobPostings.description LIKE @searchTerm;
  `;
  const pool = await sql.connect(); // Assume global or persistent connection
  const results = await pool
    .request()
    .input("searchTerm", sql.VarChar, `%${searchTerm}%`) // Safe parameterized input
    .query(query);
  return results; // Return the fetched jobs
};
