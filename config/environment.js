if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const environmentConfig = {
  port: process.env.PORT || 8080,
  dbUser: process.env.DB_USER,
  dbPassword: process.env.DB_PASSWORD,
  dbName: process.env.DB_NAME,
  dbServer: process.env.DB_SERVER,
  sessionSecret: process.env.SESSION_SECRET || "default_secret_key",
  isProduction: process.env.NODE_ENV === "production",
  geminiKey: process.env.GEMINI_API_KEY,
};

module.exports = environmentConfig;
