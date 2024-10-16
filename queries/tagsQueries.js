const sql = require('mssql');
const postQueries = require('./postQueries');

const tagQueries = {
  getTags: async () => {
    try {
      const result = await sql.query`SELECT * FROM tags`;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  createTag: async (tagName) => {
    try {
      const result =
        await sql.query`INSERT INTO tags (name) OUTPUT INSERTED.* VALUES (${tagName})`; // Make sure the column name is correct
      return result.recordset[0];
    } catch (err) {
      console.error('Database insert error:', err);
      throw err;
    }
  },

  findByTagId: async (tagId) => {
    try {
      const result = await sql.query`SELECT * FROM tags WHERE id = ${tagId}`;
      return result.recordset[0];
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getTagsForPost: async (postId) => {
    try {
      const result =
        await sql.query`SELECT * FROM post_tags WHERE post_id = ${postId}`;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getPostsForTag: async (tagId) => {
    try {
      const result =
        await sql.query`SELECT * FROM post_tags WHERE tag_id = ${tagId}`;
      const posts = [];
      for (let i = 0; i < result.recordset.length; i++) {
        const post = await postQueries.findByPostId(
          result.recordset[i].post_id
        );
        posts.push(post);
      }
      return posts;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },
  findTagByName: async (tag) => {
    try {
      const result = await sql.query`SELECT * FROM tags WHERE name = ${tag}`;
      return result.recordset[0];
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },
};

module.exports = tagQueries;
