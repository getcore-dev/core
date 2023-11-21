module.exports = (sequelize, DataTypes) => {
  const Recruiter = sequelize.define("User", {
    recruiter_id: DataTypes.INTEGER, // primary key
    company_name: DataTypes.STRING,
    company_email: DataTypes.STRING,
    created_at: DataTypes.DATE,
  });

  return Recruiter;
};
