const { Model, DataTypes } = require("sequelize");
const sequelize = require("./database"); // Ensure this is the correct path to your sequelize instance

class Job extends Model {}

Job.init(
  {
    job_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true, // Validation to prevent empty string
      },
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false, // Adding this if company_id should not be null
      references: {
        model: "companies",
        key: "company_id",
      },
    },
    zip_code: {
      type: DataTypes.STRING,
      allowNull: true, // ZIP code can be null, but you might want validation if a value is provided
      validate: {
        isPostalCode(value) {
          // Optionally, add a validation for ZIP code format (this is a stub example)
          if (value && !/^\d{5}(-\d{4})?$/.test(value)) {
            throw new Error("Invalid ZIP code format.");
          }
        },
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true, // Explicitly allow null if description is optional
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: "job", // Typically singular; change if needed based on your DB structure
    tableName: "jobs",
    timestamps: true,
    updatedAt: "updated_at",
    createdAt: "created_at",
  }
);

// You might not want to sync in this file if you sync somewhere else in your codebase
Job.sync({ alter: true }) // Prefer `alter` over `force` to avoid dropping tables accidentally
  .then(() => console.log("Jobs table synced successfully."))
  .catch((error) => console.error("Error syncing the jobs table:", error));

module.exports = Job;
