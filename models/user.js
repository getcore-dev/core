const { Model, DataTypes } = require("sequelize");
const sequelize = require("./database"); // make sure this is the correct path to your sequelize instance
const Job = require("./job"); // make sure this is the correct path to your Job model
class User extends Model {}

User.init(
  {
    user_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW, // Automatically set the date when the row is created
    },
    job_id: {
      type: DataTypes.INTEGER,
      references: {
        model: "job", // This references the imported Job model
        key: "job_id", // The primary key in the Job model
      },
    },
    // This assumes that the code in the Location model is of type STRING
    zip_code: {
      type: DataTypes.STRING,
      allowNull: false, // Make sure to include this to enforce that zip_code must be provided
    },
  },
  {
    sequelize,
    modelName: "user", // The table name will be derived from the model name, unless given as a separate option
    tableName: "users", // Explicitly providing table name
    timestamps: false, // Assuming you are managing created_at and updated_at yourself
    // If you want Sequelize to automatically manage timestamps, remove this line and add 'updatedAt' field
  }
);

module.exports = User;
