const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/database"); // Adjust the path as necessary

class Location extends Model {}
Location.init(
  {
    location_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    Address: { type: DataTypes.STRING },
    City: { type: DataTypes.STRING },
    State: { type: DataTypes.STRING },
    Country: { type: DataTypes.STRING },
    postal_code: { type: DataTypes.STRING },
  },
  { sequelize, modelName: "Location" }
);

module.exports = Location;
