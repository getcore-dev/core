const sql = require("mssql");

const experienceQueries = {
  // Fetch job experiences with pagination
  getJobExperiences: async (userId, limit, offset) => {
    try {
      const result = await sql.query(`
        SELECT j.*, STRING_AGG(t.TagName, ', ') AS Skills
        FROM JobExperiences AS j
        JOIN JobTags AS jt ON j.JobExperienceID = jt.JobExperienceID
        JOIN Tags AS t ON jt.TagID = t.TagID
        WHERE j.UserID = ${userId}
        GROUP BY j.JobExperienceID, j.Title, j.EmploymentType, j.CompanyName, j.Location, j.StartDate, j.EndDate, j.Description
        ORDER BY j.StartDate DESC
        OFFSET ${offset} ROWS
        FETCH NEXT ${limit} ROWS ONLY
      `);
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  // Fetch educational experiences
  getEducationExperiences: async (userId, limit, offset) => {
    try {
      const result = await sql.query(`
        SELECT e.*, STRING_AGG(t.TagName, ', ') AS Skills
        FROM EducationExperiences AS e
        JOIN EducationTags AS et ON e.EducationExperienceID = et.EducationExperienceID
        JOIN Tags AS t ON et.TagID = t.TagID
        WHERE e.UserID = ${userId}
        GROUP BY e.EducationExperienceID, e.School, e.Degree, e.FieldOfStudy, e.StartDate, e.EndDate, e.Grade, e.Description
        ORDER BY e.StartDate DESC
        OFFSET ${offset} ROWS
        FETCH NEXT ${limit} ROWS ONLY
      `);
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  // Add a job experience
  addJobExperience: async (
    userId,
    title,
    employmentType,
    companyName,
    location,
    startDate,
    endDate,
    description,
    tags
  ) => {
    try {
      const result = await sql.query(`
        INSERT INTO JobExperiences (UserID, Title, EmploymentType, CompanyName, Location, StartDate, EndDate, Description)
        VALUES (${userId}, '${title}', '${employmentType}', '${companyName}', '${location}', '${startDate}', '${endDate}', '${description}');
        SELECT SCOPE_IDENTITY() AS JobExperienceID;
      `);
      const jobExperienceId = result.recordset[0].JobExperienceID;

      // Link tags
      tags.forEach(async (tag) => {
        await sql.query(`
          INSERT INTO JobTags (JobExperienceID, TagID)
          VALUES (${jobExperienceId}, (SELECT TagID FROM Tags WHERE TagName = '${tag}'))
        `);
      });

      return jobExperienceId;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  // Add an educational experience
  addEducationExperience: async (
    userId,
    school,
    degree,
    fieldOfStudy,
    startDate,
    endDate,
    grade,
    description,
    tags
  ) => {
    try {
      const result = await sql.query(`
        INSERT INTO EducationExperiences (UserID, School, Degree, FieldOfStudy, StartDate, EndDate, Grade, Description)
        VALUES (${userId}, '${school}', '${degree}', '${fieldOfStudy}', '${startDate}', '${endDate}', '${grade}', '${description}');
        SELECT SCOPE_IDENTITY() AS EducationExperienceID;
      `);
      const educationExperienceId = result.recordset[0].EducationExperienceID;

      // Link tags
      tags.forEach(async (tag) => {
        await sql.query(`
          INSERT INTO EducationTags (EducationExperienceID, TagID)
          VALUES (${educationExperienceId}, (SELECT TagID FROM Tags WHERE TagName = '${tag}'))
        `);
      });

      return educationExperienceId;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },
};

module.exports = experienceQueries;
