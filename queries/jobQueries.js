const sql = require("mssql");

const jobQueries = {
  getJobs: async (limit, offset) => {
    try {
      const result = await sql.query(`
        SELECT JobPostings.*, companies.name AS company_name, companies.logo AS company_logo, companies.location AS company_location, companies.description AS company_description,
        (
          SELECT STRING_AGG(JobTags.tagName, ', ')
          FROM JobPostingsTags
          INNER JOIN JobTags ON JobPostingsTags.tagId = JobTags.id
          WHERE JobPostingsTags.jobId = JobPostings.id
        ) AS tags
        FROM JobPostings
        LEFT JOIN companies ON JobPostings.company_id = companies.id
        ORDER BY JobPostings.postedDate DESC
        OFFSET ${offset} ROWS
        FETCH NEXT ${limit} ROWS ONLY
      `);
      const jobs = result.recordset;
      return jobs;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getJobPostingByLink: async (link) => {
    try {
      const result = await sql.query`
        SELECT * FROM JobPostings WHERE link = ${link}
      `;
      return result.recordset[0];
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },
  getAllCompanies: async () => {
    try {
      const result = await sql.query`
        SELECT * FROM companies
      `;
      const companies = result.recordset;
      console.log(companies);
      return companies;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  updateCompany: async (
    id,
    name,
    location,
    description,
    logo,
    logo_url,
    industry,
    founded,
    size,
    stock_symbol,
    job_board_url
  ) => {
    // Construct the SET clause dynamically
    const fields = [];
    const values = {};

    if (name !== undefined) {
      fields.push("name = @name");
      values.name = { value: name, type: sql.NVarChar };
    }
    if (location !== undefined) {
      fields.push("location = @location");
      values.location = { value: location, type: sql.NVarChar };
    }
    if (description !== undefined) {
      fields.push("description = @description");
      values.description = { value: description, type: sql.NVarChar };
    }
    if (logo !== undefined) {
      fields.push("logo = @logo");
      values.logo = { value: logo, type: sql.VarChar };
    }
    if (logo_url !== undefined) {
      fields.push("logo_url = @logo_url");
      values.logo_url = { value: logo_url, type: sql.VarChar };
    }
    if (industry !== undefined) {
      fields.push("industry = @industry");
      values.industry = { value: industry, type: sql.VarChar };
    }
    if (founded !== undefined) {
      fields.push("founded = @founded");
      values.founded = { value: founded, type: sql.DateTime };
    }
    if (size !== undefined) {
      fields.push("size = @size");
      values.size = { value: size, type: sql.VarChar };
    }
    if (stock_symbol !== undefined) {
      fields.push("stock_symbol = @stock_symbol");
      values.stock_symbol = { value: stock_symbol, type: sql.VarChar };
    }
    if (job_board_url !== undefined) {
      fields.push("job_board_url = @job_board_url");
      values.job_board_url = { value: job_board_url, type: sql.VarChar };
    }

    if (fields.length === 0) {
      throw new Error("No fields to update");
    }

    const query = `
        UPDATE companies
        SET ${fields.join(", ")}
        WHERE id = @id
      `;

    const request = new sql.Request();
    request.input("id", sql.Int, id);
    Object.entries(values).forEach(([key, { value, type }]) => {
      request.input(key, type, value);
    });

    await request.query(query);
  },

  getJobsBySearch: async (
    title = "",
    location = "",
    experienceLevel = "",
    salary = 0,
    limit,
    offset
  ) => {
    try {
      let fullStateName = location;
      let stateAbbreviation = location;

      if (location !== "") {
        const stateMappings = {
          Alabama: "AL",
          Alaska: "AK",
          Arizona: "AZ",
          Arkansas: "AR",
          California: "CA",
          Colorado: "CO",
          Connecticut: "CT",
          Delaware: "DE",
          Florida: "FL",
          Georgia: "GA",
          Hawaii: "HI",
          Idaho: "ID",
          Illinois: "IL",
          Indiana: "IN",
          Iowa: "IA",
          Kansas: "KS",
          Kentucky: "KY",
          Louisiana: "LA",
          Maine: "ME",
          Maryland: "MD",
          Massachusetts: "MA",
          Michigan: "MI",
          Minnesota: "MN",
          Mississippi: "MS",
          Missouri: "MO",
          Montana: "MT",
          Nebraska: "NE",
          Nevada: "NV",
          "New Hampshire": "NH",
          "New Jersey": "NJ",
          "New Mexico": "NM",
          "New York": "NY",
          "North Carolina": "NC",
          "North Dakota": "ND",
          Ohio: "OH",
          Oklahoma: "OK",
          Oregon: "OR",
          Pennsylvania: "PA",
          "Rhode Island": "RI",
          "South Carolina": "SC",
          "South Dakota": "SD",
          Tennessee: "TN",
          Texas: "TX",
          Utah: "UT",
          Vermont: "VT",
          Virginia: "VA",
          Washington: "WA",
          "West Virginia": "WV",
          Wisconsin: "WI",
          Wyoming: "WY",
          "United States": "US",
        };

        // Check if the location is an abbreviation or full state name
        fullStateName =
          Object.keys(stateMappings).find(
            (key) => stateMappings[key] === location
          ) || location;
        stateAbbreviation = stateMappings[location] || location;

        // Ensure abbreviation for full state name
        if (fullStateName === location && stateMappings[location]) {
          fullStateName = location;
          stateAbbreviation = stateMappings[location];
        }
      }

      const result = await sql.query(`
        SELECT JobPostings.*, companies.name AS company_name, companies.logo AS company_logo, companies.location AS company_location, companies.description AS company_description,
        (
          SELECT STRING_AGG(JobTags.tagName, ', ')
          FROM JobPostingsTags
          INNER JOIN JobTags ON JobPostingsTags.tagId = JobTags.id
          WHERE JobPostingsTags.jobId = JobPostings.id
        ) AS tags
        FROM JobPostings
        LEFT JOIN companies ON JobPostings.company_id = companies.id
        WHERE JobPostings.title LIKE '%${title}%' 
        AND (JobPostings.location LIKE '%${fullStateName}%' OR JobPostings.location LIKE '% ${stateAbbreviation}, %')
        AND JobPostings.experienceLevel LIKE '%${experienceLevel}%' 
        AND JobPostings.salary >= ${salary}
        AND JobPostings.postedDate >= DATEADD(day, -30, GETDATE())
        ORDER BY JobPostings.postedDate DESC
        OFFSET ${offset} ROWS
        FETCH NEXT ${limit} ROWS ONLY
      `);
      const jobs = result.recordset;
      return jobs;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getRandomJobs: async (limit) => {
    try {
      const result = await sql.query(`
        SELECT TOP ${limit} JobPostings.*, companies.name AS company_name, companies.logo AS company_logo, companies.location AS company_location, companies.description AS company_description,
        (
          SELECT STRING_AGG(JobTags.tagName, ', ')
          FROM JobPostingsTags
          INNER JOIN JobTags ON JobPostingsTags.tagId = JobTags.id
          WHERE JobPostingsTags.jobId = JobPostings.id
        ) AS tags
        FROM JobPostings
        LEFT JOIN companies ON JobPostings.company_id = companies.id
        ORDER BY NEWID()
      `);
      const jobs = result.recordset;
      return jobs;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getJobsCount: async () => {
    try {
      const result = await sql.query(`
        SELECT COUNT(*) AS count
        FROM JobPostings
      `);
      return result.recordset[0].count;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getRecentJobCount: async () => {
    try {
      const result = await sql.query(`
        SELECT COUNT(*) AS jobCount
        FROM JobPostings
        WHERE postedDate >= DATEADD(day, -30, GETDATE())
      `);
      const jobCount = result.recordset[0].jobCount;
      return jobCount;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getJobsByTag: async (tagId, limit = 10, offset = 0) => {
    try {
      const result = await sql.query(`
        SELECT JobPostings.*, companies.name AS company_name, companies.logo AS company_logo, companies.location AS company_location, companies.description AS company_description,
        (
          SELECT STRING_AGG(JobTags.tagName, ', ')
          FROM JobPostingsTags
          INNER JOIN JobTags ON JobPostingsTags.tagId = JobTags.id
          WHERE JobPostingsTags.jobId = JobPostings.id
        ) AS tags
        FROM JobPostings
        LEFT JOIN companies ON JobPostings.company_id = companies.id
        WHERE JobPostings.id IN (
          SELECT jobId
          FROM JobPostingsTags
          WHERE tagId = ${tagId}
        )
        ORDER BY JobPostings.postedDate DESC
        OFFSET ${offset} ROWS
        FETCH NEXT ${limit} ROWS ONLY
      `);

      const jobs = result.recordset;
      return jobs;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },
  getTagId: async (tagName) => {
    try {
      const pool = await sql.connect();

      const jobTagResult = await pool
        .request()
        .input("tagName", sql.NVarChar, tagName)
        .query("SELECT id FROM JobTags WHERE tagName = @tagName");

      if (jobTagResult.recordset.length > 0) {
        return jobTagResult.recordset[0].id;
      }

      return null;
    } catch (err) {
      console.error("Error in getTagId:", err);
      throw err;
    }
  },

  getJobsByTags: async (tags) => {
    try {
      // Convert tags array to a format suitable for SQL IN clause
      const formattedTags = tags
        .map((tag) => `'${tag.replace(/'/g, "''")}'`)
        .join(",");

      const result = await sql.query(`
        SELECT JobPostings.*, companies.name AS company_name, companies.logo AS company_logo, companies.location AS company_location, companies.description AS company_description,
        (
          SELECT STRING_AGG(JobTags.tagName, ', ')
          FROM JobPostingsTags
          INNER JOIN JobTags ON JobPostingsTags.tagId = JobTags.id
          WHERE JobPostingsTags.jobId = JobPostings.id
        ) AS tags
        FROM JobPostings
        LEFT JOIN companies ON JobPostings.company_id = companies.id
        WHERE JobPostings.id IN (
          SELECT DISTINCT jobId
          FROM JobPostingsTags
          WHERE tagId IN (
            SELECT id FROM JobTags WHERE tagName IN (${formattedTags})
          )
        )
        ORDER BY JobPostings.postedDate DESC
      `);
      const jobs = result.recordset;
      return jobs;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getJobsCountByTags: async (tags) => {
    try {
      const tagIds = await Promise.all(
        tags.map(async (tag) => {
          const result = await sql.query`
            SELECT id FROM JobTags WHERE tagName = ${tag}
          `;
          return result.recordset[0].id;
        })
      );

      const result = await sql.query(`
        SELECT COUNT(*) AS count
        FROM JobPostings
        WHERE id IN (
          SELECT jobId
          FROM JobPostingsTags
          WHERE tagId IN (${tagIds.join(",")})
        )
      `);
      return result.recordset[0].count;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  // get jobs with similar tags/skills
  getSimilarJobs: async (jobId) => {
    try {
      const result = await sql.query(`
        SELECT TOP 5
          JobPostings.*, 
          companies.name AS company_name, 
          companies.logo AS company_logo, 
          companies.location AS company_location, 
          companies.description AS company_description,
          (
            SELECT STRING_AGG(JobTags.tagName, ', ') 
            FROM JobPostingsTags 
            INNER JOIN JobTags ON JobPostingsTags.tagId = JobTags.id
            WHERE JobPostingsTags.jobId = JobPostings.id
          ) AS tags,
          (
            SELECT STRING_AGG(skills.name, ', ')
            FROM job_skills
            INNER JOIN skills ON job_skills.skill_id = skills.id
            WHERE job_skills.job_id = JobPostings.id
          ) AS skills,
          (
            SELECT COUNT(*)
            FROM JobPostingsTags AS jpt1
            WHERE jpt1.jobId = JobPostings.id AND jpt1.tagId IN (
              SELECT tagId
              FROM JobPostingsTags AS jpt2
              WHERE jpt2.jobId = ${jobId}
            )
          ) AS similar_tag_count
        FROM JobPostings
        LEFT JOIN companies ON JobPostings.company_id = companies.id
        WHERE JobPostings.id != ${jobId}
        ORDER BY similar_tag_count DESC, JobPostings.postedDate DESC
      `);

      const jobs = result.recordset;
      return jobs;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  // get jobs with similar tags/skills by the same company
  getSimilarJobsByCompany: async (companyId, jobId) => {
    try {
      const result = await sql.query(`
      SELECT TOP 5
      JobPostings.*,
      companies.name AS company_name,
      companies.logo AS company_logo,
      companies.location AS company_location,
      companies.description AS company_description,
      (
        SELECT STRING_AGG(JobTags.tagName, ', ') 
        FROM JobPostingsTags 
        INNER JOIN JobTags ON JobPostingsTags.tagId = JobTags.id
        WHERE JobPostingsTags.jobId = JobPostings.id
      ) AS tags,
      (
        SELECT STRING_AGG(skills.name, ', ')
        FROM job_skills
        INNER JOIN skills ON job_skills.skill_id = skills.id
        WHERE job_skills.job_id = JobPostings.id
      ) AS skills
    FROM JobPostings
    LEFT JOIN companies ON JobPostings.company_id = companies.id
    WHERE JobPostings.company_id = ${companyId}
      AND JobPostings.id != ${jobId}
      AND JobPostings.id IN (
        SELECT jobId
        FROM JobPostingsTags
        WHERE tagId IN (
          SELECT tagId
          FROM JobPostingsTags
          WHERE jobId = ${jobId}
        )
      )
    ORDER BY JobPostings.postedDate DESC
    
    `);

      const jobs = result.recordset;
      return jobs;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getJobsByCompany: async (companyId) => {
    try {
      const result = await sql.query`
        SELECT
          JobPostings.*,
          companies.name AS company_name,
          companies.logo AS company_logo,
          companies.location AS company_location,
          companies.description AS company_description,
          (
            SELECT STRING_AGG(JobTags.tagName, ', ') 
            FROM JobPostingsTags 
            INNER JOIN JobTags ON JobPostingsTags.tagId = JobTags.id
            WHERE JobPostingsTags.jobId = JobPostings.id
          ) AS tags,
          (
            SELECT STRING_AGG(skills.name, ', ')
            FROM job_skills
            INNER JOIN skills ON job_skills.skill_id = skills.id
            WHERE job_skills.job_id = JobPostings.id
          ) AS skills
        FROM JobPostings
        LEFT JOIN companies ON JobPostings.company_id = companies.id
        WHERE JobPostings.company_id = ${companyId}
        ORDER BY JobPostings.postedDate DESC
      `;
      const jobs = result.recordset;
      return jobs;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getCompanies: async () => {
    try {
      const pool = await sql.connect();
      const result = await pool.request().query(`
        SELECT * FROM companies
      `);
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getSkills: async () => {
    try {
      const result = await sql.query`SELECT * FROM JobTags`;
      const skills = result.recordset;
      return skills;
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
          companies.description AS company_description,
          companies.industry AS company_industry,
          companies.size AS company_size,
          companies.stock_symbol AS company_stock_symbol,
          companies.founded AS company_founded,
          users.firstname AS recruiter_firstname,
          users.lastname AS recruiter_lastname,
          users.avatar AS recruiter_image,

          (
            SELECT STRING_AGG(JobTags.tagName, ', ') 
            FROM JobPostingsTags 
            INNER JOIN JobTags ON JobPostingsTags.tagId = JobTags.id
            WHERE JobPostingsTags.jobId = JobPostings.id
          ) AS tags,
          (
            SELECT STRING_AGG(skills.name, ', ')
            FROM job_skills
            INNER JOIN skills ON job_skills.skill_id = skills.id
            WHERE job_skills.job_id = JobPostings.id
          ) AS skills
        FROM JobPostings
        LEFT JOIN companies ON JobPostings.company_id = companies.id
        LEFT JOIN users ON users.recruiter_id = JobPostings.recruiter_id
        WHERE JobPostings.id = ${id}
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
    salary = "",
    experienceLevel,
    location,
    postedDate,
    company_id,
    link = "",
    expiration_date = null,
    tags = [],
    description,
    salary_max = null,
    recruiter_id,
    skills = [],
    benefits = [],
    additional_information = "",
    preferredQualifications,
    minimumQualifications,
    responsibilities,
    requirements,
    niceToHave,
    schedule,
    hoursPerWeek,
    h1bVisaSponsorship,
    isRemote,
    equalOpportunityEmployerInfo,
    relocation
  ) => {
    if (typeof link !== "string") {
      throw new Error("Link must be a string");
    }
    if (!Array.isArray(skills)) {
      skills = skills ? skills.split(",").map((skill) => skill.trim()) : [];
    }

    if (!Array.isArray(tags)) {
      tags = tags ? tags.split(",").map((tag) => tag.trim()) : [];
    }

    const benefitsArray = benefits
      ? benefits.split(",").map((benefit) => benefit.trim())
      : [];

    // Format the benefits array for SQL query
    const formattedBenefits = benefitsArray
      .map((benefit) => `'${benefit.replace(/'/g, "''")}'`)
      .join(",");

    try {
      // Check for exact duplicates based on title and company ID
      const exactDuplicateCheck = await sql.query`
        SELECT COUNT(*) AS count
        FROM JobPostings
        WHERE title = ${title} AND company_id = ${company_id}
      `;

      const exactDuplicateCount = exactDuplicateCheck.recordset[0].count;

      // If an exact duplicate exists, return null
      if (exactDuplicateCount > 0) {
        console.log("Exact duplicate job posting detected, not inserting.");
        return null;
      }

      // Check for potential duplicates based on additional criteria
      const duplicateCheck = await sql.query`
        SELECT COUNT(*) AS count
        FROM JobPostings
        WHERE
          title = ${title} AND
          experienceLevel = ${experienceLevel} AND
          location = ${location} AND
          company_id = ${company_id} AND
          description = ${description} AND
          (
            (salary IS NULL AND ${salary} IS NULL) OR
            (salary IS NOT NULL AND ${salary} IS NOT NULL AND salary = ${salary})
          ) AND
          (
            (salary_max IS NULL AND ${salary_max} IS NULL) OR
            (salary_max IS NOT NULL AND ${salary_max} IS NOT NULL AND salary_max = ${salary_max})
          )
      `;

      const duplicateCount = duplicateCheck.recordset[0].count;

      // If there are at least 5 matching columns, consider it a duplicate
      if (duplicateCount >= 5) {
        console.log("Potential duplicate job posting detected, not inserting.");
        return null;
      }

      // Insert the job posting into the JobPostings table
      const result = await sql.query`
        INSERT INTO JobPostings (
          title,
          salary,
          experienceLevel,
          location,
          postedDate,
          company_id,
          link,
          expiration_date,
          description,
          salary_max,
          recruiter_id,
          additional_information,
          benefits,
          preferredQualifications,
          minimumQualifications,
          responsibilities,
          requirements,
          niceToHave,
          schedule,
          hoursPerWeek,
          h1bVisaSponsorship,
          isRemote,
          equalOpportunityEmployerInfo,
          relocation
        )
        OUTPUT INSERTED.id
        VALUES (
          ${title},
          ${salary},
          ${experienceLevel},
          ${location},
          ${postedDate},
          ${company_id},
          ${link},
          ${expiration_date},
          ${description},
          ${salary_max},
          ${recruiter_id},
          ${additional_information},
          ${formattedBenefits},
          ${preferredQualifications},
          ${minimumQualifications},
          ${responsibilities},
          ${requirements},
          ${niceToHave},
          ${schedule},
          ${hoursPerWeek},
          ${h1bVisaSponsorship},
          ${isRemote},
          ${equalOpportunityEmployerInfo},
          ${relocation}
        )
      `;

      const jobPostingId = result.recordset[0].id;

      if (skills && skills.length > 0) {
        for (const skill of skills) {
          let skillId;
          const skillRecord = await sql.query`
            SELECT id FROM skills WHERE name = ${skill}
          `;
          if (skillRecord.recordset.length > 0) {
            skillId = skillRecord.recordset[0].id;
          } else {
            const newSkill = await sql.query`
              INSERT INTO skills (name)
              OUTPUT INSERTED.id
              VALUES (${skill})
            `;
            skillId = newSkill.recordset[0].id;
          }

          // Associate the skill with the job posting
          await sql.query`
            INSERT INTO job_skills (job_id, skill_id)
            VALUES (${jobPostingId}, ${skillId})
          `;
        }
      }

      if (tags && tags.length > 0) {
        for (const tag of tags) {
          let tagId;
          const tagRecord = await sql.query`
            SELECT id FROM JobTags WHERE tagName = ${tag}
          `;
          if (tagRecord.recordset.length > 0) {
            tagId = tagRecord.recordset[0].id;
          } else {
            const newTag = await sql.query`
              INSERT INTO JobTags (tagName)
              OUTPUT INSERTED.id
              VALUES (${tag})
            `;
            tagId = newTag.recordset[0].id;
          }

          // Associate the tag with the job posting
          await sql.query`
            INSERT INTO JobPostingsTags (jobId, tagId)
            VALUES (${jobPostingId}, ${tagId})
          `;
        }
      }

      return jobPostingId;
    } catch (err) {
      console.error(`Database insert error: ${err} in createJobPosting`);
      throw err; // Rethrow the error for the caller to handle
    }
  },

  getCompanyByName: async (name) => {
    try {
      const result = await sql.query`
        SELECT * FROM companies WHERE name = ${name}
      `;
      return result.recordset[0];
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },
  getCompanyById: async (id) => {
    try {
      const result = await sql.query`
        SELECT * FROM companies WHERE id = ${id}
      `;
      return result.recordset[0];
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },
  getCompanyIdByName: async (name) => {
    try {
      const result = await sql.query`
        SELECT * FROM companies WHERE name = ${name}
      `;

      if (result.recordset.length === 0) {
        return null;
      }

      return result.recordset[0];
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  createCompany: async (
    name,
    logo_url,
    location,
    description,
    industry,
    size,
    stock_symbol,
    founded
  ) => {
    try {
      const result = await sql.query`
        INSERT INTO companies (name, logo, location, description, industry, size, stock_symbol, founded)
        OUTPUT INSERTED.id
        VALUES (${name}, ${logo_url}, ${location}, ${description}, ${industry}, ${size}, ${stock_symbol}, ${founded})
      `;
      const companyObject = result.recordset[0];
      return companyObject;
    } catch (err) {
      console.error(`Database insert error: ${err} in createCompany`);
      throw err;
    }
  },
  deleteJob: async (jobId) => {
    try {
      await sql.query`
        DELETE FROM JobPostingsTags WHERE jobId = ${jobId}
      `;
      await sql.query`
        DELETE FROM job_skills WHERE job_id = ${jobId}
      `;
      await sql.query`
      DELETE FROM JobPostings WHERE id = ${jobId}
    `;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },
  getCountOfTopJobTags: async () => {
    try {
      const result = await sql.query`
        SELECT TOP 9 tagName, COUNT(tagId) AS count
        FROM JobPostingsTags
        INNER JOIN JobTags ON JobPostingsTags.tagId = JobTags.id
        GROUP BY tagId, tagName
        ORDER BY count DESC
      `;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getUserJobExperience: async (userId) => {
    try {
      const result = await sql.query`
        SELECT * FROM job_experiences WHERE userId = ${userId}
      `;

      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getUserEducationExperience: async (userId) => {
    try {
      const result = await sql.query`
        SELECT * FROM education_experiences WHERE userId = ${userId}
      `;

      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  clearUserJobExperience: async (userId) => {
    try {
      await sql.query`
        DELETE FROM job_experiences WHERE userId = ${userId}
      `;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  clearUserEducationExperience: async (userId) => {
    try {
      await sql.query`
        DELETE FROM education_experiences WHERE userId = ${userId}
      `;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  clearUserJobExperienceTags: async (userId) => {
    try {
      await sql.query`
        DELETE FROM job_experiences_tags WHERE experienceId IN (
          SELECT id FROM job_experiences WHERE userId = ${userId}
        )
      `;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

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
      const result = await sql.query`
        INSERT INTO job_experiences (userId, title, employmentType, companyName, location, startDate, endDate, description, tags)
        OUTPUT INSERTED.id
        VALUES (${userId}, ${title}, ${employmentType}, ${companyName}, ${location}, ${startDate}, ${endDate}, ${description}, ${tags})
      `;

      const newExperienceId = result.recordset[0].id;
      return newExperienceId;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  /* 
  CREATE TABLE education_experiences (
    id INT PRIMARY KEY IDENTITY(1,1),
    userId NVARCHAR(255) NOT NULL,
    institutionName NVARCHAR(255) NOT NULL,
    degree NVARCHAR(255) NULL,
    fieldOfStudy NVARCHAR(255) NULL,
    startDate DATE NULL,
    endDate DATE NULL,
    isCurrent BIT NOT NULL DEFAULT 0,
    grade NVARCHAR(50) NULL,
    activities NVARCHAR(255) NULL,
    description NVARCHAR(MAX) NULL
);
*/

  addEducationExperience: async (
    userId,
    institutionName,
    degree,
    fieldOfStudy,
    isCurrent,
    startDate,
    endDate = null,
    description,
    grade = null,
    activities
  ) => {
    try {
      const result = await sql.query`
        INSERT INTO education_experiences (userId, institutionName, degree, fieldOfStudy, startDate, endDate, isCurrent, grade, activities, description)
        OUTPUT INSERTED.id
        VALUES (${userId}, ${institutionName}, ${degree}, ${fieldOfStudy}, ${startDate}, ${endDate}, ${isCurrent}, ${grade}, ${activities}, ${description})
      `;

      const newExperienceId = result.recordset[0].id;
      return newExperienceId;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getJobsByState: async (state) => {
    try {
      const stateMappings = {
        Alabama: "AL",
        Alaska: "AK",
        Arizona: "AZ",
        Arkansas: "AR",
        California: "CA",
        Colorado: "CO",
        Connecticut: "CT",
        Delaware: "DE",
        Florida: "FL",
        Georgia: "GA",
        Hawaii: "HI",
        Idaho: "ID",
        Illinois: "IL",
        Indiana: "IN",
        Iowa: "IA",
        Kansas: "KS",
        Kentucky: "KY",
        Louisiana: "LA",
        Maine: "ME",
        Maryland: "MD",
        Massachusetts: "MA",
        Michigan: "MI",
        Minnesota: "MN",
        Mississippi: "MS",
        Missouri: "MO",
        Montana: "MT",
        Nebraska: "NE",
        Nevada: "NV",
        "New Hampshire": "NH",
        "New Jersey": "NJ",
        "New Mexico": "NM",
        "New York": "NY",
        "North Carolina": "NC",
        "North Dakota": "ND",
        Ohio: "OH",
        Oklahoma: "OK",
        Oregon: "OR",
        Pennsylvania: "PA",
        "Rhode Island": "RI",
        "South Carolina": "SC",
        "South Dakota": "SD",
        Tennessee: "TN",
        Texas: "TX",
        Utah: "UT",
        Vermont: "VT",
        Virginia: "VA",
        Washington: "WA",
        "West Virginia": "WV",
        Wisconsin: "WI",
        Wyoming: "WY",
        "United States": "US",
      };

      const fullStateName =
        Object.keys(stateMappings).find(
          (key) => stateMappings[key] === state
        ) || state;
      const stateAbbreviation = stateMappings[state] || state;

      const query = `
        SELECT JobPostings.*, companies.name AS company_name, companies.logo AS company_logo, companies.location AS company_location, companies.description AS company_description,
        (
          SELECT STRING_AGG(JobTags.tagName, ', ')
          FROM JobPostingsTags
          INNER JOIN JobTags ON JobPostingsTags.tagId = JobTags.id
          WHERE JobPostingsTags.jobId = JobPostings.id
        ) AS tags
        FROM JobPostings
        LEFT JOIN companies ON JobPostings.company_id = companies.id
        WHERE JobPostings.location LIKE '%${fullStateName}%' 
           OR JobPostings.location LIKE '% ${stateAbbreviation}%'
        ORDER BY JobPostings.postedDate DESC
      `;

      console.log("SQL Query: ", query);

      const result = await sql.query(query);

      const jobs = result.recordset;
      return jobs;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getSkillsId: async (tagName) => {
    try {
      const pool = await sql.connect();

      const jobTagResult = await pool
        .request()
        .input("tagName", sql.NVarChar, tagName)
        .query("SELECT id FROM skills WHERE name = @tagName");

      if (jobTagResult.recordset.length > 0) {
        return jobTagResult.recordset[0].id;
      }

      return null;
    } catch (err) {
      console.error("Error in getTagId:", err);
      throw err;
    }
  },

  getJobsBySkills: async (tagId) => {
    try {
      const result = await sql.query(`
        SELECT JobPostings.*, companies.name AS company_name, companies.logo AS company_logo, companies.location AS company_location, companies.description AS company_description,
        (
          SELECT STRING_AGG(JobTags.tagName, ', ')
          FROM JobPostingsTags
          INNER JOIN JobTags ON JobPostingsTags.tagId = JobTags.id
          WHERE JobPostingsTags.jobId = JobPostings.id
        ) AS tags
        FROM JobPostings
        LEFT JOIN companies ON JobPostings.company_id = companies.id
        WHERE JobPostings.id IN (
          SELECT job_id
          FROM job_skills
          WHERE skill_id = '${tagId}'
        )
        ORDER BY JobPostings.postedDate DESC
      `);

      const jobs = result.recordset;
      return jobs;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },
};

module.exports = jobQueries;
