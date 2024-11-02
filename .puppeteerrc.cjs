const {join} = require("path")


/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
    // Download Chrome (default `skipDownload: false`).
    chrome: {
      skipDownload: false,
    },
    // Download Firefox (default `skipDownload: true`).
    firefox: {
      skipDownload: false,
    },
    cacheDirectory: join(__dirname, "cache", "puppeteer")
  };