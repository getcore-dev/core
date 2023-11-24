const path = require("path");
const fs = require("fs");

// This function is a very basic example. You should enhance it to fit your security needs.
function isValidPath(requestedPath) {
  const normalizedPath = path.normalize(requestedPath);
  // Only allow file requests in the "public" directory
  const basePath = path.join(__dirname, "../public");
  const fullPath = path.join(basePath, normalizedPath);

  // Prevent directory traversal, and only serve files that exist and are within the "public" directory
  return (
    fullPath.startsWith(basePath) &&
    fullPath.indexOf("..") === -1 &&
    fs.existsSync(fullPath)
  );
}

module.exports = { isValidPath };
