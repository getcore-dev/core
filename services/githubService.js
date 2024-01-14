const axios = require("axios");
const NodeCache = require("node-cache");

// Create a cache instance
const cache = new NodeCache({ stdTTL: 3600 }); // Cache for 1 hour

const fetchCommitDetails = async (commitUrl) => {
  try {
    const response = await axios.get(commitUrl);
    return {
      totalLinesAdded: response.data.stats.additions,
      totalLinesDeleted: response.data.stats.deletions,
    };
  } catch (error) {
    console.error("Error in fetchCommitDetails:", error);
    return { totalLinesAdded: 0, totalLinesDeleted: 0 };
  }
};

const fetchCommits = async () => {
  try {
    // Check if data is in cache
    const cachedData = cache.get("commits");
    if (cachedData) {
      return cachedData; // Return cached data if available
    }

    // Fetch data from GitHub API
    const response = await axios.get(
      "https://api.github.com/repos/brycemcole/CORE/commits"
    );

    // Fetch details for each commit
    const detailedCommits = await Promise.all(
      response.data.map(async (commit) => {
        const details = await fetchCommitDetails(commit.url);
        return {
          ...commit,
          linesAdded: details.totalLinesAdded,
          linesDeleted: details.totalLinesDeleted,
        };
      })
    );

    // Save to cache and return
    cache.set("commits", detailedCommits);
    return detailedCommits;
  } catch (error) {
    console.error("Error in fetchCommits:", error);
    return [];
  }
};

module.exports = { fetchCommits };
