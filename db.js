// db.js
const sql = require('mssql');
const dbConfig = require('./config/dbConfig');

// Initialize the connection pool
const pool = new sql.ConnectionPool(dbConfig);
const poolConnect = pool.connect();

// Event listener for connection errors
pool.on('error', err => {
  console.error('SQL Pool Error: ', err);
});

poolConnect.then(() => {
  console.log('Connected to database successfully');
}).catch(err => {
  console.error('Failed to connect to database:', err);
});

// Export the pool and the connection promise
module.exports = {
  pool,
  poolConnect
};
