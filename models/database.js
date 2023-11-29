require("dotenv").config(); // If you're using dotenv to manage environment variables locally

const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.AZURE_DB_NAME,
  process.env.AZURE_DB_USER,
  process.env.AZURE_DB_PASS,
  {
    host: process.env.AZURE_DB_HOST,
    dialect: "mysql", // Azure database is MySQL
    port: 3306, // Azure MySQL default port
    ssl: true, // This enables SSL which is recommended for Azure connections
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false, // You can choose to enforce authorized only if you have a CA certificate
      },
    },
    // ... other Sequelize configuration attributes
  }
);

module.exports = sequelize;
