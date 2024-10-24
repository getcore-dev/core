const sql = require("mssql");

const reportQueries = {
  saveReport: async ({ jobId, issues, otherReason }) => {
    try {
      const query = `
        INSERT INTO job_reports (job_id, issues, other_reason)
        VALUES (${jobId}, '${issues}', '${otherReason}');
        `;

        await
        sql.query(query);
    } catch (error) {
      console.error("Error saving report:", error);
      throw new Error("Could not save report");
    }
  },

  getReports: async () => {
    try {
      const query = `
        SELECT * FROM job_reports;
        `;

        const result = await sql.query(query);
        return result.recordset;
    } catch (error) {
      console.error("Error getting reports:", error);
      throw new Error("Could not get reports");
    }
  },
};

module.exports = reportQueries;
