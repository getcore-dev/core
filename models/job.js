const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

class Job extends Model {}
Job.init(
  {
    job_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, allowNull: false },
    company_id: { type: DataTypes.INTEGER },
    location_id: { type: DataTypes.INTEGER },
    description: { type: DataTypes.TEXT },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE },
  },
  { sequelize, modelName: "Job" }
);

module.exports = Job;
