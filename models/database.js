// database.js
const Sequelize = require("sequelize");

const sequelize = new Sequelize("core", "dev", "Socks!Gloves!4314", {
  host: "localhost",
  dialect: "mysql",
});

module.exports = sequelize;
