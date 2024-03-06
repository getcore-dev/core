const sql = require("mssql");

const jobQueries = {
  getJobPostingsByCompany: async (companyId) => {
    try {
      const result = await sql.query`
            SELECT * FROM JobPostings WHERE company_id = ${companyId}`;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },
  addRecruiter: async (id, name, companyId) => {
    try {
      const result = await sql.query`
            INSERT INTO Recruiters (id, name, company_id) 
            VALUES (${id}, ${name}, ${companyId})`;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },
  assignRecruiterToJob: async (jobId, recruiterId) => {
    try {
      const result = await sql.query`
            INSERT INTO JobPostingsRecruiters (JobID, RecruiterID) 
            VALUES (${jobId}, ${recruiterId})`;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },
  getJobPostingsByRecruiter: async (recruiterId) => {
    try {
      const result = await sql.query`
            SELECT jp.* FROM JobPostings jp
            JOIN JobPostingsRecruiters jpr ON jp.id = jpr.JobID
            WHERE jpr.RecruiterID = ${recruiterId}`;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },
  getRecruitersByCompany: async (companyId) => {
    try {
      const result = await sql.query`
            SELECT * FROM Recruiters WHERE company_id = ${companyId}`;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },
  updateRecruiter: async (recruiterId, field, value) => {
    try {
      const validFields = ["name", "company_id"];
      if (!validFields.includes(field)) {
        throw new Error(`Invalid field name: ${field}`);
      }
      const query = `
            UPDATE Recruiters 
            SET ${field} = @value
            WHERE id = @recruiterId`;
      const request = new sql.Request();
      request.input("value", sql.VarChar, value);
      request.input("recruiterId", sql.VarChar, recruiterId);
      const result = await request.query(query);
      if (result && result.rowsAffected === 0) {
        console.warn(
          `No rows updated. Recruiter ID ${recruiterId} might not exist.`
        );
      } else if (result) {
      }
    } catch (err) {
      console.error("Database update error:", err.message);
      console.error("Error stack:", err.stack);
      throw err;
    }
  },
  deleteRecruiter: async (recruiterId) => {
    try {
      const result = await sql.query`
            DELETE FROM Recruiters WHERE id = ${recruiterId}`;
      return result.rowCount;
    } catch (err) {
      console.error("Database delete error:", err);
      throw err;
    }
  },
};
