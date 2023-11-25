const { Model, DataTypes } = require("sequelize");
const sequelize = require("./database"); // make sure this is the correct path to your sequelize instance
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
    },
    company_id: {
      type: DataTypes.INTEGER,
      references: {
        model: "companies", // This references the imported Company model
        key: "company_id", // The primary key in the Company model
      },
    },
    // This assumes that the code in the Location model is of type STRING
    zip_code: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    description: {
      type: DataTypes.TEXT,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW, // Automatically set the date when the row is created
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW, // Automatically set the date when the row is updated
    },
  },
  {
    sequelize,
    modelName: "jobs", // modelName is typically singular
    tableName: "jobs", // This should be the actual table name
    timestamps: true, // This enables Sequelize to manage createdAt and updatedAt automatically
  }
);

Job.sync({ force: false }) // Set force to true to drop the table if it already exists
  .then(() => console.log("jobs table created successfully."))
  .catch((error) => console.error("Error creating the jobs table:", error));

module.exports = Job;
