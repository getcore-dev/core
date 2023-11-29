const { Model, DataTypes } = require("sequelize");
const sequelize = require("./database"); // make sure this is the correct path to your sequelize instance

class Company extends Model {}
Company.init(
  {
    company_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
    },
    // No need to manually define created_at or updated_at if using Sequelize's timestamps
  },
  {
    sequelize,
    modelName: "companies", // Sequelize uses the modelName to create a table name in plural form by default.
    tableName: "companies", // Explicitly defining table name
    timestamps: true, // Sequelize will add the createdAt and updatedAt fields automatically
  }
);

module.exports = Company;
