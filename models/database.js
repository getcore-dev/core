// establish connection to Azure MySQL database

require("dotenv").config();
const mysql = require("mysql");

var connection = mysql.createConnection({
  dialect: "mysql",
  host: process.env.AZURE_DB_HOST,
  user: process.env.AZURE_DB_USER,
  password: process.env.AZURE_DB_PASSWORD,
  database: process.env.AZURE_DB_NAME,
  port: 3306,
});

connection.connect((error) => {
  if (error) {
    console.error("Error connecting to Azure MySQL database:", error);
    return;
  }
  console.log("Connected to Azure MySQL database");
});

module.exports = connection;
