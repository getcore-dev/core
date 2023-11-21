const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

class Post extends Model {}
Post.init(
  {
    post_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE },
    original_post_id: { type: DataTypes.INTEGER },
  },
  { sequelize, modelName: "Post" }
);

module.exports = Post;
