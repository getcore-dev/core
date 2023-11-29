require("dotenv").config(); // Load environment variables from .env

const Sequelize = require("sequelize");

const { DB_NAME, DB_USER, DB_PASS, DB_HOST, DB_DIALECT } = process.env;

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  dialect: DB_DIALECT,
  // Add any other Sequelize options you need here
});

module.exports = sequelize;
