if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
const redis = require("redis");

// Create and configure the Redis client
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  tls: process.env.NODE_ENV === "production" ? {} : null, // Enable TLS only in production
});

redisClient.on("error", (error) => {
  console.error("Redis error:", error);
});

module.exports = redisClient;
