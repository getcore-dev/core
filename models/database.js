// establish connection to Azure MySQL database

require("dotenv").config();
const mysql = require("mysql");

var connection = mysql.createConnection({
  host: "core-server.mysql.database.azure.com",
  user: "roxfkzgnit",
  password: "{your_password}",
  database: "{your_database}",
  port: 3306,
  ssl: { ca: fs.readFileSync("{ca-cert filename}") },
});

connection.connect((error) => {
  if (error) {
    console.error("Error connecting to Azure MySQL database:", error);
    return;
  }
  console.log("Connected to Azure MySQL database");
});

module.exports = connection;
