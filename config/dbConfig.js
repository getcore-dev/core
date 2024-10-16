const environment = require('./environment');

const dbConfig = {
  user: environment.dbUser,
  password: environment.dbPassword,
  database: environment.dbName,
  server: environment.dbServer,
  connectTimeout: 30000, 
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectionTimeout: 30000,
    requestTimeout: 30000,
  },
};

module.exports = dbConfig;
