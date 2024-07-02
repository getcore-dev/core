module.exports = {
  apps: [
    {
      name: "core-app",
      script: "./server.js",
      instances: 1,
      exec_mode: "fork",
      out_file: "D:\\home\\LogFiles\\Application\\app.log",
      error_file: "D:\\home\\LogFiles\\Application\\app.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      watch: true,
      ignore_watch: ["node_modules", "logs", "sessions"],
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
      max_memory_restart: "1G",
    },
  ],
};
