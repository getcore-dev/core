const sql = require('mssql');

/*
CREATE TABLE update_post_comments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    update_id INT NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT GETDATE(),
    deleted BIT NOT NULL DEFAULT 0,
    parent_comment_id INT,
    is_pinned BIT NOT NULL DEFAULT 0,
    content NVARCHAR(MAX) NOT NULL,
    FOREIGN KEY (update_id) REFERENCES dbo.update_posts(id),
    FOREIGN KEY (parent_comment_id) REFERENCES dbo.update_post_comments(id)
);
*/
const updateQueries = {
  getUpdates: async () => {
    try {
      const result = await sql.query`
      SELECT 
          up.*,
          u.username AS user_name,
          COALESCE(cc.comment_count, 0) AS comment_count
      FROM 
          dbo.update_posts up
      INNER JOIN 
          dbo.users u ON up.user_id = u.id
      LEFT JOIN 
          (SELECT 
              update_id,
              COUNT(*) AS comment_count
           FROM 
              dbo.update_post_comments
           WHERE 
              deleted = 0
           GROUP BY 
              update_id) cc ON up.id = cc.update_id
      ORDER BY 
          up.post_date DESC
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
  },
  
  getUpdateComments: async (id) => {
    try {
      const result = await sql.query`
        SELECT 
          update_post_comments.*, 
          users.username as user_name, users.avatar as user_avatar
        FROM update_post_comments
        INNER JOIN users ON update_post_comments.user_id = users.id
        WHERE update_post_comments.update_id = ${id}
        ORDER BY update_post_comments.created_at DESC
      `;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  createUpdateComment: async (comment) => {
    try {
      console.log(comment);
      const result = await sql.query`
        INSERT INTO update_post_comments (update_id, user_id, content, parent_comment_id)
        VALUES (${comment.update_id}, ${comment.user_id}, ${comment.body_text}, ${comment.parent_comment_id})
      `;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }
};

module.exports = updateQueries;

