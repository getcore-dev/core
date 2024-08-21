const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 1200 });

const cacheMiddleware = (duration, keyPrefix = '') => {
  return (req, res, next) => {
    // Generate a unique cache key based on the route and query parameters
    const queryString = Object.keys(req.query)
      .sort()
      .map(key => `${key}=${req.query[key]}`)
      .join('&');
    const key = `${keyPrefix}${req.path}?${queryString}`;

    let cachedBody = cache.get(key);

    if (cachedBody) {
      return res.json(cachedBody);
    } else {
      res.sendResponse = res.json;
      res.json = (body) => {
        cache.set(key, body, duration);
        res.sendResponse(body);
      };
      next();
    }
  };
};

module.exports = cacheMiddleware;