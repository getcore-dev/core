const sql = require('mssql');

const updateQueries = {
  getUpdates: async () => {
    try {
      const result = await sql.query`
                SELECT * FROM update_posts
            `;

      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },
};

module.exports = updateQueries;
