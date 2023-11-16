const mysql = require("mysql2");

const pool = mysql.createPool({
  host: "localhost",
  user: "dev",
  password: "##",
  database: "core",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool; // Export the pool to use it in other parts of your application
