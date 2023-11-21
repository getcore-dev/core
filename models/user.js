const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/database"); // Adjust the path as necessary

class User extends Model {}
User.init(
  {
    user_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    username: { type: DataTypes.STRING, allowNull: false, unique: true },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password_hash: { type: DataTypes.STRING, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
    job_id: { type: DataTypes.INTEGER },
    location_id: { type: DataTypes.INTEGER },
  },
  { sequelize, modelName: "User" }
);

module.exports = User;
