require("dotenv").config();
const mysql = require("mysql");
const winston = require('winston'); // logger

// Configure Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'mysql-module' },
  transports: [
    new winston.transports.Console() // log errors to console
  ],
});

var connection = mysql.createConnection({
  dialect: "mysql",
  host: process.env.AZURE_DB_HOST,
  user: process.env.AZURE_DB_USER,
  password: process.env.AZURE_DB_PASSWORD,
  database: process.env.AZURE_DB_NAME,
  port: 3306,
});

connection.connect((error) => {
  if (error) {
    logger.error("Error connecting to Azure MySQL database:", error);
    process.exit(1);  // Exit the process with failure status
  }
  logger.info("Connected to Azure MySQL database");
});

connection.on('error', function(err) {
  logger.error('Database error', err);
  if(err.code === 'PROTOCOL_CONNECTION_LOST') {
    handleDisconnectedConnection();
  } else {
    throw err;
  }
});

function handleDisconnectedConnection() {
  connection = mysql.createConnection(connection.config);
  connection.connect(function(err) {
    if(err) {
      logger.error('Error when reconnecting to the database:', err);
      setTimeout(handleDisconnectedConnection, 2000);
    }
  });

  connection.on('error', function(err) {
    logger.error('Database error', err);
    if(err.code === 'PROTOCOL_CONNECTION_LOST') {
      handleDisconnectedConnection();
    } else {
      throw err;
    }
  });
}

module.exports = connection;