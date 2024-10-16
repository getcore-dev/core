const sql = require('mssql');

class Job {
  constructor(data) {
    this.id = data.id;
    this.title = data.title;
    this.salary = data.salary;
    this.salaryMax = data.salary_max;
    this.experienceLevel = data.experienceLevel;
    this.location = data.location;
    this.postedDate = data.postedDate;
    this.companyId = data.company_id;
    this.link = data.link;
    this.expirationDate = data.expiration_date;
    this.description = data.description;
    this.recruiterId = data.recruiter_id;
    this.additionalInformation = data.additional_information;
    this.benefits = data.benefits;
    this.preferredQualifications = data.preferredQualifications;
    this.minimumQualifications = data.minimumQualifications;
    this.responsibilities = data.responsibilities;
    this.requirements = data.requirements;
    this.niceToHave = data.niceToHave;
    this.schedule = data.schedule;
    this.hoursPerWeek = data.hoursPerWeek;
    this.h1bVisaSponsorship = data.h1bVisaSponsorship;
    this.isRemote = data.isRemote;
    this.equalOpportunityEmployerInfo = data.equalOpportunityEmployerInfo;
    this.relocation = data.relocation;
    this.applicants = data.applicants;
    this.views = data.views;
    this.companyName = data.company_name;
    this.companyLogo = data.company_logo;
    this.companyLocation = data.company_location;
    this.companyDescription = data.company_description;
    this.companyIndustry = data.company_industry;
    this.companySize = data.company_size;
    this.companyStockSymbol = data.company_stock_symbol;
    this.companyFounded = data.company_founded;
    this.recruiterFirstName = data.recruiter_firstname;
    this.recruiterLastName = data.recruiter_lastname;
    this.recruiterImage = data.recruiter_image;
    this.tags = data.tags ? data.tags.split(', ') : [];
    this.skills = data.skills ? data.skills.split(', ') : [];
  }

  static async getAll(limit, offset) {
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
      return result.recordset.map((job) => new Job(job));
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }

  static async getById(id) {
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
      return result.recordset[0] ? new Job(result.recordset[0]) : null;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }

  static async create(jobData) {
    try {
      const result = await sql.query`
        INSERT INTO JobPostings (
          title, salary, experienceLevel, location, postedDate, company_id, link, expiration_date, 
          description, salary_max, recruiter_id, additional_information, benefits, preferredQualifications, 
          minimumQualifications, responsibilities, requirements, niceToHave, schedule, hoursPerWeek, 
          h1bVisaSponsorship, isRemote, equalOpportunityEmployerInfo, relocation, applicants
        )
        OUTPUT INSERTED.id
        VALUES (
          ${jobData.title}, ${jobData.salary}, ${jobData.experienceLevel}, ${jobData.location}, ${jobData.postedDate}, 
          ${jobData.company_id}, ${jobData.link}, ${jobData.expiration_date}, ${jobData.description}, ${jobData.salary_max}, 
          ${jobData.recruiter_id}, ${jobData.additional_information}, ${jobData.benefits}, ${jobData.preferredQualifications}, 
          ${jobData.minimumQualifications}, ${jobData.responsibilities}, ${jobData.requirements}, ${jobData.niceToHave}, 
          ${jobData.schedule}, ${jobData.hoursPerWeek}, ${jobData.h1bVisaSponsorship}, ${jobData.isRemote}, 
          ${jobData.equalOpportunityEmployerInfo}, ${jobData.relocation}, 0
        )
      `;

      const jobId = result.recordset[0].id;

      // Add skills
      if (jobData.skills && jobData.skills.length > 0) {
        for (const skill of jobData.skills) {
          await Job.addSkillToJob(jobId, skill);
        }
      }

      // Add tags
      if (jobData.tags && jobData.tags.length > 0) {
        for (const tag of jobData.tags) {
          await Job.addTagToJob(jobId, tag);
        }
      }

      return jobId;
    } catch (err) {
      console.error('Database insert error:', err);
      throw err;
    }
  }

  async save() {
    try {
      await sql.query`
        UPDATE JobPostings
        SET 
          title = ${this.title},
          salary = ${this.salary},
          experienceLevel = ${this.experienceLevel},
          location = ${this.location},
          link = ${this.link},
          expiration_date = ${this.expirationDate},
          description = ${this.description},
          salary_max = ${this.salaryMax},
          recruiter_id = ${this.recruiterId},
          additional_information = ${this.additionalInformation},
          benefits = ${this.benefits},
          preferredQualifications = ${this.preferredQualifications},
          minimumQualifications = ${this.minimumQualifications},
          responsibilities = ${this.responsibilities},
          requirements = ${this.requirements},
          niceToHave = ${this.niceToHave},
          schedule = ${this.schedule},
          hoursPerWeek = ${this.hoursPerWeek},
          h1bVisaSponsorship = ${this.h1bVisaSponsorship},
          isRemote = ${this.isRemote},
          equalOpportunityEmployerInfo = ${this.equalOpportunityEmployerInfo},
          relocation = ${this.relocation}
        WHERE id = ${this.id}
      `;
    } catch (err) {
      console.error('Database update error:', err);
      throw err;
    }
  }

  async delete() {
    try {
      await sql.query`
        DELETE FROM JobPostingsTags WHERE jobId = ${this.id};
        DELETE FROM job_skills WHERE job_id = ${this.id};
        DELETE FROM JobPostings WHERE id = ${this.id};
      `;
    } catch (err) {
      console.error('Database delete error:', err);
      throw err;
    }
  }

  async incrementViewCount() {
    try {
      await sql.query`
        UPDATE JobPostings
        SET views = COALESCE(views, 0) + 1
        WHERE id = ${this.id}`;
      this.views++;
    } catch (err) {
      console.error('Database update error:', err);
      throw err;
    }
  }

  static async getBySearch(searchParams) {
    const {
      title = '',
      location = '',
      experienceLevel = '',
      salary = '',
      limit = 15,
      offset = 0,
      allowedJobLevels = [],
      tags = [],
    } = searchParams;

    try {
      let query = `
        WITH RankedJobs AS (
          SELECT DISTINCT
            j.*, c.name AS company_name, c.logo AS company_logo, c.location AS company_location, 
            c.description AS company_description,
            (
              SELECT STRING_AGG(jt.tagName, ', ')
              FROM JobPostingsTags jpt
              INNER JOIN JobTags jt ON jpt.tagId = jt.id
              WHERE jpt.jobId = j.id
            ) AS tags,
            (
              SELECT STRING_AGG(s.name, ', ')
              FROM job_skills js
              INNER JOIN skills s ON js.skill_id = s.id
              WHERE js.job_id = j.id
            ) AS skills,
            ROW_NUMBER() OVER (PARTITION BY j.id ORDER BY j.postedDate DESC) AS RowNum
          FROM JobPostings j
          LEFT JOIN companies c ON j.company_id = c.id
          WHERE j.postedDate >= DATEADD(month, -3, GETDATE())
      `;

      const queryParams = [];
      let paramIndex = 1;

      if (title) {
        query += ` AND j.title LIKE @p${paramIndex}`;
        queryParams.push({ name: `p${paramIndex++}`, value: `%${title}%` });
      }

      if (location) {
        query += ` AND (j.location LIKE @p${paramIndex} OR j.location LIKE @p${
          paramIndex + 1
        })`;
        queryParams.push({ name: `p${paramIndex++}`, value: `%${location}%` });
        queryParams.push({
          name: `p${paramIndex++}`,
          value: `% ${location.substring(0, 2)},%`,
        });
      }

      if (experienceLevel) {
        query += ` AND j.experienceLevel = @p${paramIndex}`;
        queryParams.push({ name: `p${paramIndex++}`, value: experienceLevel });
      }

      if (salary) {
        query += ` AND j.salary >= @p${paramIndex}`;
        queryParams.push({ name: `p${paramIndex++}`, value: parseInt(salary) });
      }

      if (allowedJobLevels && allowedJobLevels.length > 0) {
        query += ` AND j.experienceLevel IN (${allowedJobLevels
          .map(() => `@p${paramIndex++}`)
          .join(', ')})`;
        allowedJobLevels.forEach((level) =>
          queryParams.push({ name: `p${paramIndex - 1}`, value: level })
        );
      }

      if (tags && tags.length > 0) {
        query += `
          AND EXISTS (
            SELECT 1 FROM JobPostingsTags jpt
            INNER JOIN JobTags jt ON jpt.tagId = jt.id
            WHERE jpt.jobId = j.id AND jt.tagName IN (${tags
    .map(() => `@p${paramIndex++}`)
    .join(', ')})
          )
        `;
        tags.forEach((tag) =>
          queryParams.push({ name: `p${paramIndex - 1}`, value: tag })
        );
      }

      query += `)
        SELECT * FROM RankedJobs
        WHERE RowNum = 1
        ORDER BY postedDate DESC
        OFFSET @p${paramIndex} ROWS
        FETCH NEXT @p${paramIndex + 1} ROWS ONLY
      `;

      queryParams.push({ name: `p${paramIndex++}`, value: parseInt(offset) });
      queryParams.push({ name: `p${paramIndex}`, value: parseInt(limit) });

      const request = new sql.Request();
      queryParams.forEach((param) => request.input(param.name, param.value));

      const result = await request.query(query);
      return result.recordset.map((job) => new Job(job));
    } catch (error) {
      console.error('Error in getBySearch:', error);
      throw error;
    }
  }

  static async getCountBySearch(searchParams) {
    // Similar to getBySearch, but returns count instead of job records
    // Implement the counting logic here
  }

  static async getSimilarJobs(jobId) {
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

      return result.recordset.map((job) => new Job(job));
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }

  static async addSkillToJob(jobId, skillName) {
    try {
      let skillId;
      const skillRecord = await sql.query`
        SELECT id FROM skills WHERE name = ${skillName}
      `;
      if (skillRecord.recordset.length > 0) {
        skillId = skillRecord.recordset[0].id;
      } else {
        const newSkill = await sql.query`
          INSERT INTO skills (name)
          OUTPUT INSERTED.id
          VALUES (${skillName})
        `;
        skillId = newSkill.recordset[0].id;
      }

      await sql.query`
        INSERT INTO job_skills (job_id, skill_id)
        VALUES (${jobId}, ${skillId})
      `;
    } catch (err) {
      console.error('Database insert error:', err);
      throw err;
    }
  }

  static async addTagToJob(jobId, tagName) {
    try {
      let tagId;
      const tagRecord = await sql.query`
        SELECT id FROM JobTags WHERE tagName = ${tagName}
      `;
      if (tagRecord.recordset.length > 0) {
        tagId = tagRecord.recordset[0].id;
      } else {
        const newTag = await sql.query`
          INSERT INTO JobTags (tagName)
          OUTPUT INSERTED.id
          VALUES (${tagName})
        `;
        tagId = newTag.recordset[0].id;
      }

      await sql.query`
        INSERT INTO JobPostingsTags (jobId, tagId)
        VALUES (${jobId}, ${tagId})
      `;
    } catch (err) {
      console.error('Database insert error:', err);
      throw err;
    }
  }

  static async getJobsByCompany(companyId) {
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
      return result.recordset.map((job) => new Job(job));
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }

  static async getJobsByTag(tagId, limit = 10, offset = 0) {
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

      return result.recordset.map((job) => new Job(job));
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }

  static async getJobsByState(state) {
    try {
      const stateMappings = {
        Alabama: 'AL',
        Alaska: 'AK',
        Arizona: 'AZ',
        Arkansas: 'AR',
        California: 'CA',
        Colorado: 'CO',
        Connecticut: 'CT',
        Delaware: 'DE',
        Florida: 'FL',
        Georgia: 'GA',
        Hawaii: 'HI',
        Idaho: 'ID',
        Illinois: 'IL',
        Indiana: 'IN',
        Iowa: 'IA',
        Kansas: 'KS',
        Kentucky: 'KY',
        Louisiana: 'LA',
        Maine: 'ME',
        Maryland: 'MD',
        Massachusetts: 'MA',
        Michigan: 'MI',
        Minnesota: 'MN',
        Mississippi: 'MS',
        Missouri: 'MO',
        Montana: 'MT',
        Nebraska: 'NE',
        Nevada: 'NV',
        'New Hampshire': 'NH',
        'New Jersey': 'NJ',
        'New Mexico': 'NM',
        'New York': 'NY',
        'North Carolina': 'NC',
        'North Dakota': 'ND',
        Ohio: 'OH',
        Oklahoma: 'OK',
        Oregon: 'OR',
        Pennsylvania: 'PA',
        'Rhode Island': 'RI',
        'South Carolina': 'SC',
        'South Dakota': 'SD',
        Tennessee: 'TN',
        Texas: 'TX',
        Utah: 'UT',
        Vermont: 'VT',
        Virginia: 'VA',
        Washington: 'WA',
        'West Virginia': 'WV',
        Wisconsin: 'WI',
        Wyoming: 'WY',
        'United States': 'US',
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

      const result = await sql.query(query);
      return result.recordset.map((job) => new Job(job));
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }

  static async getRandomJobs(limit) {
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
      return result.recordset.map((job) => new Job(job));
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }

  static async getRecentJobCount() {
    try {
      const result = await sql.query(`
        SELECT COUNT(*) AS jobCount
        FROM JobPostings
        WHERE postedDate >= DATEADD(day, -30, GETDATE())
      `);
      return result.recordset[0].jobCount;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }

  static async getCountOfTopJobTags() {
    try {
      const result = await sql.query`
        SELECT TOP 30 tagName, COUNT(tagId) AS count
        FROM JobPostingsTags
        INNER JOIN JobTags ON JobPostingsTags.tagId = JobTags.id
        GROUP BY tagId, tagName
        ORDER BY count DESC
      `;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }
}

module.exports = Job;
