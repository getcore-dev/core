const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 1200 });

const cacheMiddleware = (duration) => {
  return (req, res, next) => {
    // Generate a unique cache key based on query parameters
    let key = '__express__' + req.originalUrl || req.url;
    let cachedBody = cache.get(key);

    if (cachedBody) {
      res.send(cachedBody);
      return;
    } else {
      res.sendResponse = res.send;
      res.send = (body) => {
        cache.set(key, body, duration);
        res.sendResponse(body);
      };
      next();
    }
  };
};

module.exports = cacheMiddleware;