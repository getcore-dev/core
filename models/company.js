const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

class Company extends Model {}
Company.init(
  {
    company_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    created_at: { type: DataTypes.DATE, allowNull: false },
  },
  { sequelize, modelName: "Company" }
);

module.exports = Company;
