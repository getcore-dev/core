module.exports = {
  apps: [
    {
      name: "core-app",
      script: "./server.js",
      instances: 1,
      exec_mode: "cluster",
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
