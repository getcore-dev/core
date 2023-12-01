require("dotenv").config();
const mysql = require('mysql');

const dbConfig = {
    host: process.env.AZURE_DB_HOST,
    user: process.env.AZURE_DB_USER,
    password: process.env.AZURE_DB_PASS,
    database: process.env.AZURE_DB_DB,
    port: 3306,
    ssl: {
        rejectUnauthorized: true
    }
};

const connection = mysql.createConnection(dbConfig);

connection.connect(error => {
    if (error) {
        console.error('Error connecting to the database: ', error);
        return;
    }
    console.log('Connected to the Azure MySQL database.');
});

module.exports = connection;
