const sql = require("mssql");

const jobQueries = {
  getJobs: async () => {
    try {
      const result = await sql.query(`
        SELECT 
          JobPostings.*,
          companies.name AS company_name,
          companies.logo AS company_logo,
          companies.location AS company_location,
          companies.description AS company_description
        FROM 
          JobPostings
        LEFT JOIN 
          companies ON JobPostings.company_id = companies.id
        ORDER BY 
          JobPostings.postedDate DESC
      `);
      const jobs = result.recordset;
      // Cache the result for future requests
      return jobs;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  findById: async (id) => {
    try {
      const result = await sql.query`
        SELECT
          JobPostings.*, 
          companies.name AS company_name,
          companies.logo AS company_logo,
          companies.location AS company_location,
          companies.description AS company_description
        FROM
          JobPostings
        LEFT JOIN
          companies ON JobPostings.company_id = companies.id
        WHERE
          JobPostings.id = ${id}
      `;
      const job = result.recordset[0];
      return job;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  createJobPosting: async (
    title,
    salary,
    experienceLevel,
    location,
    postedDate,
    company_id,
    link = "",
    expiration_date = null,
    tags = [],
    description,
    salary_max = null,
    recruiter_id = null,
    skills = []
  ) => {
    if (typeof link !== "string") {
      throw new Error("Link must be a string");
    }
    if (!Array.isArray(tags)) {
      tags = tags.split(",").map((tag) => tag.trim());
    }
    if (!Array.isArray(skills)) {
      skills = skills.split(",").map((skill) => skill.trim());
    }
    try {
      // Insert the job posting into the JobPostings table
      const result =
        await sql.query`INSERT INTO JobPostings (title, salary, experienceLevel, location, postedDate, company_id, link, expiration_date, description, salary_max, recruiter_id)
                                     OUTPUT INSERTED.id
                                     VALUES (${title}, ${salary}, ${experienceLevel}, ${location}, ${postedDate}, ${company_id}, ${link}, ${expiration_date}, ${description}, ${salary_max}, ${recruiter_id})`;
      const jobPostingId = result.recordset[0].id;

      if (tags && tags.length > 0) {
        for (const tag of tags) {
          // Find or create the tag and get its id
          let tagId;
          const tagRecord =
            await sql.query`SELECT id FROM tags WHERE name = ${tag}`;
          if (tagRecord.recordset.length > 0) {
            tagId = tagRecord.recordset[0].id;
          } else {
            // If tag does not exist, create it
            const newTag =
              await sql.query`INSERT INTO tags (name) OUTPUT INSERTED.id VALUES (${tag})`;
            tagId = newTag.recordset[0].id;
          }
          // Associate the tag with the job posting
          await sql.query`INSERT INTO job_posting_tags (job_posting_id, tag_id) VALUES (${jobPostingId}, ${tagId})`;
        }
      }

      if (skills && skills.length > 0) {
        for (const skill of skills) {
          // Find or create the skill and get its id
          let skillId;
          const skillRecord =
            await sql.query`SELECT id FROM skills WHERE name = ${skill}`;
          if (skillRecord.recordset.length > 0) {
            skillId = skillRecord.recordset[0].id;
          } else {
            // If skill does not exist, create it
            const newSkill =
              await sql.query`INSERT INTO skills (name) OUTPUT INSERTED.id VALUES (${skill})`;
            skillId = newSkill.recordset[0].id;
          }
          // Associate the skill with the job posting
          await sql.query`INSERT INTO job_posting_skills (job_posting_id, skill_id) VALUES (${jobPostingId}, ${skillId})`;
        }
      }

      return jobPostingId;
    } catch (err) {
      console.error("Database insert error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  },
};

module.exports = jobQueries;
