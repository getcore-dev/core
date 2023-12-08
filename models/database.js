require("dotenv").config();
const mysql = require("mysql");

const dbConfig = {
  host: process.env.AZURE_DB_HOST,
  user: process.env.AZURE_DB_USER,
  password: process.env.AZURE_DB_PASS,
  database: process.env.AZURE_DB_DB,
  port: 1433,
  options: {
    encrypt: true,
    trustServerCertificate: false, // change to true for local dev / self-signed certs
  },
};

const conn = mysql.createConnection(dbConfig);

if (process.env.NODE_ENV === "production") {
  conn.connect((err) => {
    if (err) {
      console.error("!!! Cannot connect !! Error:", err);
      return;
    }
    console.log("Connection established.");
    initializeDatabase();
  });
} else {
  console.log("Skipping database connection in non-production environment.");
}

function initializeDatabase() {
  conn.query("DROP TABLE IF EXISTS users;", (err) => {
    if (err) throw err;
    console.log("Dropped users table if existed.");
  });

  const createTableQuery = `
    CREATE TABLE users (
      user_id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      email VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      zip_code VARCHAR(20)
    );
  `;
  conn.query(createTableQuery, (err) => {
    if (err) throw err;
    console.log("Created users table.");
    insertSampleUsers();
  });
}

function insertSampleUsers() {
  const users = [
    ["test", "test@gmail.com", "hashed_password1"],
    ["test2", "test2@gmail.com", "hashed_password2"],
    ["test3", "test3@gmail.com", "hashed_password3"],
  ];

  const insertQuery =
    "INSERT INTO users (username, email, password_hash) VALUES ?;";
  conn.query(insertQuery, [users], (err, results) => {
    if (err) throw err;
    console.log(`Inserted ${results.affectedRows} row(s).`);
    conn.end((err) => {
      if (err) throw err;
      console.log("Done.");
    });
  });
}
