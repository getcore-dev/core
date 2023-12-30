const environment = require("./environment");

const dbConfig = {
  user: environment.dbUser,
  password: environment.dbPassword,
  database: environment.dbName,
  server: environment.dbServer,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

module.exports = dbConfig;
