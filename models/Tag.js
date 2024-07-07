const sql = require('mssql');
const postQueries = require('../queries/postQueries'); // Assuming this exists

class Tag {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    // Add any other properties that a tag might have
  }

  static async getAll() {
    try {
      const result = await sql.query`SELECT * FROM tags`;
      return result.recordset.map(tag => new Tag(tag));
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }

  static async create(tagName) {
    try {
      const result = await sql.query`
        INSERT INTO tags (name) 
        OUTPUT INSERTED.* 
        VALUES (${tagName})`;
      return new Tag(result.recordset[0]);
    } catch (err) {
      console.error('Database insert error:', err);
      throw err;
    }
  }

  static async findById(tagId) {
    try {
      const result = await sql.query`SELECT * FROM tags WHERE id = ${tagId}`;
      return result.recordset[0] ? new Tag(result.recordset[0]) : null;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }

  static async findByName(tagName) {
    try {
      const result = await sql.query`SELECT * FROM tags WHERE name = ${tagName}`;
      return result.recordset[0] ? new Tag(result.recordset[0]) : null;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }

  static async getTagsForPost(postId) {
    try {
      const result = await sql.query`
        SELECT t.* 
        FROM tags t
        JOIN post_tags pt ON t.id = pt.tag_id
        WHERE pt.post_id = ${postId}`;
      return result.recordset.map(tag => new Tag(tag));
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }

  async getPostsForTag() {
    try {
      const result = await sql.query`
        SELECT p.* 
        FROM posts p
        JOIN post_tags pt ON p.id = pt.post_id
        WHERE pt.tag_id = ${this.id}`;
      return result.recordset.map(post => postQueries.createPostObject(post));
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }

  static async addTagToPost(tagId, postId) {
    try {
      await sql.query`
        INSERT INTO post_tags (tag_id, post_id)
        VALUES (${tagId}, ${postId})`;
    } catch (err) {
      console.error('Database insert error:', err);
      throw err;
    }
  }

  static async removeTagFromPost(tagId, postId) {
    try {
      await sql.query`
        DELETE FROM post_tags
        WHERE tag_id = ${tagId} AND post_id = ${postId}`;
    } catch (err) {
      console.error('Database delete error:', err);
      throw err;
    }
  }

  // You might want to add more methods here, such as:
  // - Updating a tag's name
  // - Deleting a tag
  // - Getting popular tags
  // - etc.
}

module.exports = Tag;