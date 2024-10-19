const express = require('express');
const router = express.Router();
const sql = require('mssql');

router.get('/health', async (req, res) => {
  try {
    // Test database connection
    await sql.query('SELECT 1');
    
    // If the query executes successfully, the database connection is working
    res.sendStatus(200);
  } catch (error) {
    console.error('Health check failed:', error);
    // If there's an error (including database connection issues), send a 500 status
    res.sendStatus(500);
  }
});

module.exports = router;