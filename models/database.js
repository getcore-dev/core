require("dotenv").config();
const mysql = require("mysql");
const fs = require("fs");

const dbConfig = {
  host: process.env.AZURE_DB_HOST,
  user: process.env.AZURE_DB_USER,
  password: process.env.AZURE_DB_PASS,
  database: process.env.AZURE_DB_DB,
  port: 3306,
};

const conn = new mysql.createConnection(dbConfig);

if (process.env.NODE_ENV === "production") {
  conn.connect(function (err) {
    if (err) {
      console.log("!!! Cannot connect !! Error:");
      throw err;
    } else {
      console.log("Connection established.");
      queryDatabase();
    }
  });
} else {
  console.log("Skipping database connection in non-production environment.");
}

function queryDatabase() {
  conn.query("DROP TABLES IF EXISTS users;", function (err, results, fields) {
    if (err) throw err;
    console.log("Dropped users table if existed.");
  });
  conn.query(
    "CREATE TABLE users (\n" +
      "    user_id INT AUTO_INCREMENT PRIMARY KEY,\n" +
      "    username VARCHAR(50) NOT NULL UNIQUE,\n" +
      "    email VARCHAR(100) NOT NULL UNIQUE,\n" +
      "    password_hash VARCHAR(255) NOT NULL,\n" +
      "    zip_code VARCHAR(20)\n" +
      ");",
    function (err, results, fields) {
      if (err) throw err;
      console.log("Created users table.");
    }
  );
  conn.query(
    "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?);",
    ["test", "test@gmail.com", "abcde3"],
    function (err, results, fields) {
      if (err) throw err;
      else console.log("Inserted " + results.affectedRows + " rows(s).");
    }
  );
  conn.query(
    "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?);",
    ["test2", "test2@gmail.com", "abcde3"],
    function (err, results, fields) {
      if (err) throw err;
      else console.log("Inserted " + results.affectedRows + " rows(s).");
    }
  );
  conn.query(
    "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?);",
    ["test3", "test3@gmail.com", "abcde3"],
    function (err, results, fields) {
      if (err) throw err;
      else console.log("Inserted " + results.affectedRows + " rows(s).");
    }
  );
  conn.end(function (err) {
    if (err) throw err;
    else console.log("Done.");
  });
}
