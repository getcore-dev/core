const sql = require('mssql');

const updateQueries = {
  getUpdates: async () => {
    try {
      const result = await sql.query`
                SELECT 
                update_posts.*,
                users.username as user_name
                FROM update_posts
                INNER JOIN users ON update_posts.user_id = users.id
                ORDER BY update_posts.post_date DESC

            `;

      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },
  
  getUpdateById: async (id) => {
    try {
      const result = await sql.query`
        SELECT 
          update_posts.*, 
          users.username as user_name
        FROM update_posts
        INNER JOIN users ON update_posts.user_id = users.id
        WHERE update_posts.id = ${id}
      `;
      return result.recordset[0];
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }
};

module.exports = updateQueries;

module.exports = updateQueries;
