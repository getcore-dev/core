// database.js
const Sequelize = require("sequelize");

const sequelize = new Sequelize(
  "mysql://dev:Socks!Gloves!4314@host:port/database"
);

module.exports = sequelize;
