module.exports = (sequelize, DataTypes) => {
  const User_job = sequelize.define("User_job", {
    user_job_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "user", // This is a reference to another model
        key: "id", // This is the column name of the referenced model
      },
    },
    job_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "job", // This is a reference to another model
        key: "id", // This is the column name of the referenced model
      },
    },
    location_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Locations", // This is a reference to another model
        key: "id", // This is the column name of the referenced model
      },
    },
    start_date: {
      type: DataTypes.DATE,
      allowNull: true, // Assuming start_date can be null
    },
    end_date: {
      type: DataTypes.DATE,
      allowNull: true, // Assuming end_date can be null
    },
    is_current: {
      type: DataTypes.BOOLEAN,
      allowNull: false, // Assuming is_current should always have a value (true or false)
      defaultValue: false, // Default value if none is provided
    },
  });

  return User_job;
};
