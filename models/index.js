const Sequelize = require("sequelize");
const { DB_NAME, DB_USER, DB_PASS, DB_HOST, DB_DIALECT } = process.env;

// Create a Sequelize instance with your database configuration
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  dialect: DB_DIALECT,
});

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Define your models and associate them here
db.User = require("./user")(sequelize, Sequelize);

// Add any other models as needed

module.exports = db;
