const sql = require("mssql");
const utilFunctions = require("../utils/utilFunctions");
const resumeFunctions = require("../utils/resumeFunctions");
const config = require("../config/dbConfig");
const fs = require("fs");
const path = require("path");

/*
CREATE TABLE company_comments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    company_id INT NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT GETDATE(),
    deleted BIT NOT NULL DEFAULT 0,
    parent_comment_id INT,
    is_pinned BIT NOT NULL DEFAULT 0,
    content NVARCHAR(MAX) NOT NULL,
    FOREIGN KEY (company_id) REFERENCES dbo.companies(id),
    FOREIGN KEY (parent_comment_id) REFERENCES dbo.company_comments(id)
);
*/

const jobTitleCategories = {
  "Software Engineer": [
    "Software Developer",
    "Python Developer",
    "Java Developer",
    "Full Stack Developer",
    "Backend Developer",
    "Frontend Developer",
    "iOS Developer",
    "Android Developer",
    "Web Developer",
    "DevOps Engineer",
    "Cloud Engineer",
  ],
  "Data Scientist": [
    "Data Analyst",
    "Machine Learning Engineer",
    "AI Engineer",
    "Business Intelligence Analyst",
    "Data Engineer",
    "Statistician",
  ],
  "Product Manager": [
    "Product Owner",
    "Program Manager",
    "Project Manager",
    "Scrum Master",
    "Agile Coach",
  ],
  // Add more categories as needed
};

// Define experience level adjacency mapping
function expandExperienceLevels(experienceLevels) {
  const experienceLevelAdjacency = {
    'Internship': ['Entry Level'],
    'Entry Level': ['Internship', 'Associate'],
    'Associate': ['Entry Level', 'Mid Level'],
    'Mid Level': ['Associate', 'Senior Level'],
    'Senior Level': ['Mid Level', 'Lead'],
    'Lead': ['Senior Level', 'Manager'],
    'Manager': ['Lead', 'Director'],
    'Director': ['Manager', 'Executive'],
    'Executive': ['Director']
  };

  const expandedLevels = new Set();

  experienceLevels.forEach(level => {
    expandedLevels.add(level);
    const adjacents = experienceLevelAdjacency[level] || [];
    adjacents.forEach(adj => expandedLevels.add(adj));
  });

  return Array.from(expandedLevels);
}


function expandTitles(titles) {
  const titleSynonyms = {
    'software engineer': [
      'software developer',
      'programmer',
      'developer',
      'software architect',
      'full-stack developer',
      'backend developer',
      'frontend developer',
      'python developer',
      'java developer',
      'web developer',
      'application developer',
      'systems engineer',
      'devops engineer',
      "Software Developer",
      "Python Developer",
      "Java Developer",
      "Full Stack Developer",
      "Backend Developer",
      "Frontend Developer",
      "iOS Developer",
      "Android Developer",
      "Web Developer",
      "DevOps Engineer",
      "Cloud Engineer",
      "reliability engineer",
    ],
    'data scientist': [
      'data analyst',
      'machine learning engineer',
      'data engineer',
      'analytics engineer',
      'business intelligence analyst',
      'quantitative analyst',
      'research scientist',
      'ai engineer'
    ],
    'project manager': [
      'program manager',
      'product owner',
      'scrum master',
      'project coordinator',
      'technical project manager',
      'delivery manager',
      'agile project manager',
      'it project manager'
    ],
    'product manager': [
      'product owner',
      'product specialist',
      'product lead',
      'product strategist',
      'technical product manager',
      'digital product manager'
    ],
    'ux designer': [
      'ui designer',
      'user experience designer',
      'interaction designer',
      'user interface designer',
      'product designer',
      'web designer',
      'ux/ui designer',
      'digital designer'
    ],
    'marketing manager': [
      'marketing specialist',
      'digital marketing manager',
      'marketing coordinator',
      'brand manager',
      'marketing director',
      'content marketing manager',
      'growth marketer'
    ],
    'sales representative': [
      'sales executive',
      'account executive',
      'sales consultant',
      'business development representative',
      'sales associate',
      'account manager',
      'sales manager'
    ],
    'human resources manager': [
      'hr manager',
      'hr specialist',
      'hr generalist',
      'talent acquisition manager',
      'recruiting manager',
      'people operations manager',
      'hr business partner'
    ],
    'financial analyst': [
      'finance analyst',
      'business analyst',
      'financial advisor',
      'investment analyst',
      'corporate finance analyst',
      'financial consultant',
      'budget analyst'
    ],
    'operations manager': [
      'operations director',
      'operations coordinator',
      'business operations manager',
      'operations specialist',
      'facilities manager',
      'production manager',
      'operations supervisor'
    ],
    'quantitative analyst': [
      'quant',
      'quantitative developer',
      'quantitative trader',
      'quantitative research',
      'quantitative software',
      'quantitative modeler',
      'quantitative strategist',
      'quantitative consultant',
      'quantitative risk analyst'
    ],
  };

  // Helper function to normalize strings for comparison
  const normalizeString = (str) => str.toLowerCase().trim();

  const expandedTitles = [];
  titles.forEach(title => {
    const normalizedTitle = normalizeString(title);
    
    // Add the original title
    expandedTitles.push({ 
      term: title, 
      isExact: true,
      originalTitle: title
    });

    // Find matching synonyms
    Object.entries(titleSynonyms).forEach(([mainTitle, synonyms]) => {
      if (normalizedTitle === normalizeString(mainTitle)) {
        synonyms.forEach(synonym => {
          expandedTitles.push({ 
            term: synonym, 
            isExact: false,
            originalTitle: title
          });
        });
      }
    });
  });

  return expandedTitles;
}
const titleMappings = {
  // Software Engineering roles
  'software engineer': [
    'software developer',
    'programmer',
    'developer',
    'swe',
    'software development engineer',
    'application developer',
    'full stack developer',
    'full stack engineer',
    'backend developer',
    'backend engineer',
    'frontend developer',
    'frontend engineer'
  ],

  // Product/Program Management roles
  'product manager': [
    'program manager',
    'product owner',
    'technical product manager',
    'product management',
    'pm',
    'program management'
  ],

  // Data Science roles
  'data scientist': [
    'data analyst',
    'data engineer',
    'machine learning engineer',
    'ml engineer',
    'analytics engineer',
    'data science'
  ],

  // Design roles
  'product designer': [
    'ui designer',
    'ux designer',
    'ui/ux designer',
    'web designer',
    'interaction designer',
    'visual designer'
  ],

  // DevOps roles
  'devops engineer': [
    'site reliability engineer',
    'platform engineer',
    'infrastructure engineer',
    'cloud engineer',
    'systems engineer',
    'sre'
  ],

  'financial analyst': [
    'finance analyst',
    'business analyst',
    'financial advisor',
    'investment analyst',
    'corporate finance analyst',
    'financial consultant',
    'budget analyst'
  ],
  'operations manager': [
    'operations director',
    'operations coordinator',
    'business operations manager',
    'operations specialist',
    'facilities manager',
    'production manager',
    'operations supervisor'
  ],
  'quantitative analyst': [
    'quant',
    'quantitative developer',
    'quantitative trader',
    'quantitative research',
    'quantitative software',
    'quantitative modeler',
    'quantitative strategist',
    'quantitative consultant',
    'quantitative risk analyst'
  ],

  'project manager': [
    'program manager',
    'project coordinator',
    'project management',
    'pm',
    'program management'
  ],
};

function buildTitleConditions2(titles, queryParams) {
  if (!titles.length) return [];
  
  const allTitles = new Set();
  
  // Collect all related titles
  titles.forEach(searchTitle => {
    const normalizedSearch = searchTitle.toLowerCase().trim();
    
    // Add the original search term
    allTitles.add(normalizedSearch);
    
    // Add mapped titles
    Object.entries(titleMappings).forEach(([main, variations]) => {
      // If the search term matches main title or any variation
      if (main.includes(normalizedSearch) || 
          variations.some(v => v.includes(normalizedSearch))) {
        // Add main title and all variations
        allTitles.add(main);
        variations.forEach(v => allTitles.add(v));
      }
    });
  });

  // Build the SQL conditions
  const titleConditions = Array.from(allTitles).map((title, index) => {
    const paramName = `title${index}`;
    queryParams.push({ name: paramName, value: `"*${title}*"` });
    return `CONTAINS(title, @${paramName})`;
  });

  return titleConditions;
}

function buildTitleConditions(titles, queryParams) {
  if (!titles.length) return [];
  
  const allTitles = new Set();
  
  // Collect all related titles
  titles.forEach(searchTitle => {
    const normalizedSearch = searchTitle.toLowerCase().trim();
    
    // Add the original search term
    allTitles.add(normalizedSearch);
    
    // Add mapped titles
    Object.entries(titleMappings).forEach(([main, variations]) => {
      // If the search term matches main title or any variation
      if (main.includes(normalizedSearch) || 
          variations.some(v => v.includes(normalizedSearch))) {
        // Add main title and all variations
        allTitles.add(main);
        variations.forEach(v => allTitles.add(v));
      }
    });
  });

  // Build the SQL conditions
  const titleConditions = Array.from(allTitles).map((title, index) => {
    const paramName = `title${index}`;
    queryParams.push({ name: paramName, value: `"*${title}*"` });
    return `CONTAINS(j.title, @${paramName})`;
  });

  return titleConditions;
}

function addTitleMapping(mainTitle, variations) {
  titleMappings[mainTitle.toLowerCase().trim()] = 
    variations.map(v => v.toLowerCase().trim());
}

// Function to get all related titles for a given title
function getRelatedTitles(searchTitle) {
  const normalizedSearch = searchTitle.toLowerCase().trim();
  const related = new Set([normalizedSearch]);
  
  Object.entries(titleMappings).forEach(([main, variations]) => {
    if (main.includes(normalizedSearch) || 
        variations.some(v => v.includes(normalizedSearch))) {
      related.add(main);
      variations.forEach(v => related.add(v));
    }
  });
  
  return Array.from(related);
}

const jobQueries = {
  createResume: async (data) => {
    resumeFunctions.createResume(data);
  },

  getJobCountByFilter: async (filters) => {
    try {
      const { experienceLevels = [], titles = [], locations = [] } = filters;
      const queryParams = [];
      const conditions = [];

      if (titles.length) {
        const titleConditions = buildTitleConditions2(titles, queryParams);
        conditions.push(`(${titleConditions.join(' OR ')})`);
      }

      if (experienceLevels.length) {
        const expLevelConditions = experienceLevels.map((level, index) => {
          const paramName = `experienceLevel${index}`;
          queryParams.push({ name: paramName, value: `"*${level}*"` });
          const isInternship = level.toLowerCase() === 'internship' || level.toLowerCase() === 'intern';
          const isEntryLevel = level.toLowerCase() === 'entry level';
          if (isInternship) {
        return `CONTAINS(experienceLevel, '"Internship"') OR CONTAINS(title, '"Intern"') AND NOT CONTAINS(title, '"Internal" OR "International"')`;
          }
          if (isEntryLevel) {
        return `CONTAINS(experienceLevel, '"Entry Level"')`;
          }
          return `CONTAINS(experienceLevel, @${paramName}) OR CONTAINS(title, @${paramName})`;
        });
        conditions.push(`(${expLevelConditions.join(' OR ')})`);
      }

      if (locations.length) {
        const locationConditions = locations.map((location, index) => {
          const paramName = `location${index}`;
          queryParams.push({ name: paramName, value: `"*${location}*"` });
          return `CONTAINS(location, @${paramName})`;
        });

        // Check if 'Remote' is in the locations array
        if (locations.some(location => location.toLowerCase() === 'remote')) {
          locationConditions.push(`CONTAINS(location, '"Virtual" OR "N/A" OR "Remote" OR "Work From Home" OR "Telecommute" OR "Anywhere"')`);
        }

        conditions.push(`(${locationConditions.join(' OR ')})`);
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const query = `
        SELECT COUNT(*) as count
        FROM JobPostings
        ${whereClause}
      `;

      const request = new sql.Request();
      queryParams.forEach(param => {
        request.input(param.name, sql.NVarChar, param.value);
      });

      const result = await request.query(query);
      return result.recordset[0].count;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  addToRecentJobs: async (userId, jobLink) => {
    try {
      const result = await sql.query`
        INSERT INTO dbo.job_links (user_id, job_link)
        VALUES (${userId}, ${jobLink})
      `;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getRecentlyAddedJobs: async () => {
    try {
      const result = await sql.query`
        SELECT TOP 10 job_link, added_at FROM dbo.job_links
        ORDER BY id DESC
      `;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },


  updateCompanyLogo: async (companyId, logo) => {
      try {
        await sql.query`
          UPDATE companies
          SET logo = ${logo}
          WHERE id = ${companyId}
        `;
        
        const result = await sql.query`
          SELECT * FROM companies
          WHERE id = ${companyId}
        `;
        
        return result.recordset[0]; // Assuming you want to return the first (and only) record
      } catch (err) {
        console.error("Database query error:", err);
        throw err;
      }
    },

    updateCompanyDescription: async (companyId, description) => {
      try {
        await sql.query`
          UPDATE companies
          SET description = ${description}
          WHERE id = ${companyId}
        `;
        
        const result = await sql.query`
          SELECT * FROM companies
          WHERE id = ${companyId}
        `;
        
        return result.recordset[0]; // Assuming you want to return the first (and only) record
      } catch (err) {
        console.error("Database query error:", err);
        throw err;
      }
    },

  getCompanyNames: async () => {
    try {
      const result = await sql.query`
        SELECT id, name, logo FROM companies
      `;
      return result.recordset.map((record) => record.name);
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },
  
 getCompaniesWithJobPostings: async (minimumPostings) => {
  try {
    const result = await 
      sql.query(`
        SELECT 
          c.id,
          c.name,
          c.logo,
          c.location,
          c.description,
          c.industry,
          c.size,
          c.stock_symbol,
          c.founded,
          COUNT(jp.id) AS job_count
        FROM 
          companies c
        LEFT JOIN 
          jobPostings jp ON c.id = jp.company_id
        GROUP BY 
          c.id, c.name, c.logo, c.location, c.description, c.industry, c.size, c.stock_symbol, c.founded
        HAVING 
          COUNT(jp.id) >= ${minimumPostings}
        ORDER BY 
          job_count DESC, c.name ASC
      `);

    return result.recordset;
  } catch (err) {
    console.error('Database query error in getCompaniesWithJobPostings:', err);
    throw err;
  }
},

  setJobAsProcessed: async (jobId) => {
    await sql.query`
      UPDATE JobPostings
      SET isProcessed = 1
      WHERE id = ${jobId}
    `;
  },

  setJobRawDescription: async (jobId) => {
    await sql.query`
      UPDATE JobPostings
      SET raw_description_no_format = description
      WHERE id = ${jobId}
    `;
  },

  updateJob: async (jobId, jobInfo) => {
    try {
      let updateQuery = "UPDATE JobPostings SET ";
      const updateValues = [];

      for (const [key, value] of Object.entries(jobInfo)) {
        updateQuery += `${key} = @${key}, `;
        updateValues.push({ name: `@${key}`, value: value });
      }

      updateQuery = updateQuery.slice(0, -2); // Remove the last comma and space
      updateQuery += " WHERE id = @jobId";

      const request = new sql.Request();
      request.input("jobId", sql.Int, jobId);
      updateValues.forEach((param) => {
        request.input(param.name.slice(1), param.value);
      });

      await request.query(updateQuery);
    } catch (error) {
      console.error("Error updating job:", error);
      throw error;
    }
  },

  readResume: async (filePath) => {
    try {
      const data = await resumeFunctions.processResume(filePath);
      return data;
    } catch (error) {
      console.error("Error reading resume:", error);
      throw error;
    }
  },

  getAllCompanies: async () => {
    try {
      const result = await sql.query`
        SELECT * FROM companies
      `;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  updateJobBoardUrl: async (companyId, jobBoardUrl) => {
    try {
      const result = await sql.query`
        UPDATE companies
        SET job_board_url = ${jobBoardUrl}
        WHERE id = ${companyId}
      `;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getAllCompanyJobBoards: async () => {
    try {
      const result = await sql.query`
        SELECT id, job_board_url FROM companies
        WHERE job_board_url IS NOT NULL
      `;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getCompanyJobLinks: async (companyId) => {
    try {
      const result = await sql.query`
        SELECT id, title, link FROM JobPostings WHERE company_id = ${companyId}
      `;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getAllCompanyJobLinks: async () => {
    try {
      const result = await sql.query`
        SELECT id, title, link, company_id FROM JobPostings
      `;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getCompanyJobs: async (companyId) => {
    try {
      const result = await sql.query`
        SELECT id, title, link, company_id FROM JobPostings WHERE company_id = ${companyId}
      `;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  incrementJobApplicantCount: async (jobId) => {
    try {
      if (!jobId) {
        throw new Error("jobId is required");
      }

      await sql.query`
        UPDATE JobPostings
        SET applicants = COALESCE(applicants, 0) + 1
        WHERE id = ${jobId}`;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  decrementJobApplicantCount: async (jobId) => {
    try {
      if (!jobId) {
        throw new Error("jobId is required");
      }

      await sql.query`
        UPDATE JobPostings
        SET applicants = COALESCE(applicants, 0) - 1
        WHERE id = ${jobId}`;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  //const jobPostings = await jobQueries.getJobsByCompanies(parsedCompanies, page, pageSize);

  /*
  parsedCompanies [
  '{"id":"71","name":"Apple","logo":"/src/applelogo.png"}',
  '{"id":"86","name":"Microsoft","logo":"/src/Microsoftlogo.png"}'
  ]
  */

  getJobsByCompanies: async (companyIds, page, pageSize) => {
    try {
      const offset = (page - 1) * pageSize;
      console.log(companyIds);

      // Create a string of @p1, @p2, etc. for each companyId
      const parameterPlaceholders = companyIds
        .map((_, index) => `@p${index + 1}`)
        .join(",");

      const request = new sql.Request();

      // Add parameters for each companyId
      companyIds.forEach((id, index) => {
        request.input(`p${index + 1}`, sql.Int, id);
      });

      // Add parameters for offset and pageSize
      request.input("offset", sql.Int, offset);
      request.input("pageSize", sql.Int, pageSize);

      const query = `
        SELECT
          JobPostings.*, companies.name AS company_name, companies.logo AS company_logo, companies.location AS company_location, companies.description AS company_description,
          (
            SELECT STRING_AGG(JobTags.tagName, ', ')
            FROM JobPostingsTags
            INNER JOIN JobTags ON JobPostingsTags.tagId = JobTags.id
            WHERE JobPostingsTags.jobId = JobPostings.id
          ) AS tags,
          (
            SELECT STRING_AGG(s.name, ', ')
            FROM job_skills js
            JOIN skills s ON js.skill_id = s.id
            WHERE js.job_id = JobPostings.id
          ) AS skills
        FROM JobPostings
        LEFT JOIN companies ON JobPostings.company_id = companies.id
        WHERE JobPostings.company_id IN (${parameterPlaceholders})
        ORDER BY JobPostings.postedDate DESC
        OFFSET @offset ROWS
        FETCH NEXT @pageSize ROWS ONLY
      `;

      const result = await request.query(query);
      const jobs = result.recordset;
      return jobs;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  searchJobLevels: async (searchTerm) => {
    try {
      searchTerm = searchTerm.toLowerCase();
      const result = await sql.query`
        SELECT experienceLevel, COUNT(*) as jobCount
        FROM JobPostings
        WHERE experienceLevel LIKE ${"%" + searchTerm + "%"}
        GROUP BY experienceLevel
      `;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  searchJobLocations: async (searchTerm) => {
    try {
      const result = await sql.query`
        SELECT location, COUNT(*) as jobCount
        FROM JobPostings
        WHERE location LIKE ${"%" + searchTerm + "%"}
        GROUP BY location
      `;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  updateCompanyJobBoards: async (companyId, jobBoardUrl) => {
    try {
      const result = await sql.query`
        UPDATE companies
        SET job_board_url = ${jobBoardUrl}
        WHERE id = ${companyId}
      `;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  searchCompanies: async (searchTerm) => {
    try {
      const result = await sql.query`
        SELECT TOP 5 c.id, c.name, c.logo, COUNT(jp.id) AS job_count
        FROM companies c
        LEFT JOIN JobPostings jp ON c.id = jp.company_id
        WHERE CONTAINS((c.name, c.description, c.company_stage, c.alternate_names, c.industry), ${searchTerm})
        OR FREETEXT((c.name, c.description, c.company_stage, c.alternate_names, c.industry), ${searchTerm})
        GROUP BY c.id, c.name, c.logo
        ORDER BY job_count DESC, c.name
      `;

      return result.recordset.map((record) => ({
        id: record.id,
        name: record.name,
        logo: record.logo,
        jobCount: record.job_count,
      }));
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },
  searchJobs: async (searchTerm) => {
    try {
      const result = await sql.query`
          SELECT * FROM jobPostings WHERE title LIKE ${"%" + searchTerm + "%"}`;

      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getCompaniesCount: async () => {
    try {
      const result = await sql.query`
        SELECT COUNT(*) as count FROM companies
      `;
      return result.recordset[0].count;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

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

  getCompanyComments: async (companyId) => {
    // get company comments and join in user data
    try {
      const result = await sql.query`
        SELECT cc.*, u.username as user_name, u.id as user_id, u.avatar as user_avatar
        FROM company_comments cc
        JOIN users u ON cc.user_id = u.id
        WHERE cc.company_id = ${companyId} AND cc.deleted = 0
      `;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  addCompanyComment: async (comment) => {
    try {
      const result = await sql.query`
        INSERT INTO company_comments (company_id, user_id, content, parent_comment_id)
        VALUES (${comment.company_id}, ${comment.user_id}, ${comment.content}, ${comment.parent_comment_id})
      `;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  deleteCompanyComment: async (commentId) => {
    try {
      const result = await sql.query`
        UPDATE company_comments
        SET deleted = 1
        WHERE id = ${commentId}
      `;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getSkill: async (skillName) => {
    try {
      const result = await sql.query`
        SELECT * FROM skills WHERE name = ${skillName}
      `;
      return result.recordset[0];
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  async getJobsBatch(offset, batchSize) {
    try {
      await sql.connect(config);
      const result = await sql.query`
        SELECT id, title, description
        FROM JobPostings
        ORDER BY id
        OFFSET ${offset} ROWS
        FETCH NEXT ${batchSize} ROWS ONLY
      `;
      return result.recordset;
    } catch (err) {
      console.error("SQL error in getJobsBatch:", err);
      throw err;
    } finally {
      await sql.close();
    }
  },

  async flagJobForReview(jobId) {
    try {
      await sql.connect(config);
      await sql.query`
        UPDATE JobPostings
        SET needs_review = 1
        WHERE id = ${jobId}
      `;
    } catch (err) {
      console.error(`SQL error in flagJobForReview for job ${jobId}:`, err);
      throw err;
    } finally {
      await sql.close();
    }
  },

  getAllJobs: async () => {
    try {
      const result = await sql.query(`
        select * from JobPostings
      `);
      const jobs = result.recordset;
      return jobs;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getRecentJobs: async (page = 1, pageSize = 20) => {
    try {
      const offset = (page - 1) * pageSize;
      const result = await sql.query`
        SELECT
          j.id,
          j.title,
          j.description,
          j.postedDate,
          j.experienceLevel,
          j.salary,
          j.location,
          j.link,
          c.name AS company_name,
          c.logo AS company_logo,
          c.location AS company_location,
          c.description AS company_description,
          -- Aggregating tags using a correlated subquery
          (
            SELECT STRING_AGG(jt.tagName, ', ')
            FROM JobPostingsTags jpt
            JOIN JobTags jt ON jpt.tagId = jt.id
            WHERE jpt.jobId = j.id
          ) AS tags,
          -- Aggregating skills using a correlated subquery
          (
            SELECT STRING_AGG(s.name, ', ')
            FROM job_skills js
            JOIN skills s ON js.skill_id = s.id
            WHERE js.job_id = j.id
          ) AS skills
        FROM JobPostings j
        LEFT JOIN companies c ON j.company_id = c.id
        ORDER BY j.postedDate DESC
        OFFSET ${offset} ROWS
        FETCH NEXT ${pageSize} ROWS ONLY
      `;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getJobCountByCompany: async (companyName) => {
    try {
      const result = await sql.query`
        SELECT COUNT(*) as count
        FROM JobPostings jp
        INNER JOIN companies c ON jp.company_id = c.id
        WHERE c.name = ${companyName}
      `;
      return result.recordset[0].count;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getJobCountByCompanyId: async (companyId) => {
    try {
      const result = await sql.query`
        SELECT COUNT(*) as count
        FROM JobPostings
        WHERE company_id = ${companyId}
      `;
      return result.recordset[0].count;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  deleteJobsOlderThan2Months: async () => {
    try {
      await sql.query`
        DELETE FROM JobPostings
        WHERE postedDate < DATEADD(month, -2, GETDATE())
      `;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getAllJobsFromLast30Days: async (userPreferences, page, pageSize) => {
    try {
      const offset = (page - 1) * pageSize;
      const query = `
        SELECT
          j.id,
          j.title,
          j.description,
          j.postedDate,
          j.experienceLevel,
          j.salary,
          j.location,
          j.link,
          c.name AS company_name,
          c.logo AS company_logo,
          c.location AS company_location,
          c.description AS company_description
        FROM JobPostings j
        JOIN Companies c ON j.company_id = c.id
        WHERE j.postedDate >= DATEADD(day, -30, GETDATE())
        ORDER BY j.postedDate DESC
        OFFSET @offset ROWS
        FETCH NEXT @pageSize ROWS ONLY
      `;

      const request = new sql.Request();
      request.input("offset", sql.Int, offset);
      request.input("pageSize", sql.Int, pageSize);

      const result = await request.query(query);
      return result.recordset;
    } catch (error) {
      console.error("Error in getAllJobsFromLast30Days:", error);
      throw error;
    }
  },

  getTopCompaniesLogos: async () => {
    try {
      const query = `
        SELECT TOP 15
          c.logo,
          c.name,
          COUNT(j.id) AS job_count
        FROM Companies c
        JOIN JobPostings j ON c.id = j.company_id
        WHERE c.logo IS NOT NULL
        GROUP BY c.logo, c.name
        ORDER BY job_count DESC
      `;

      const result = await sql.query(query);
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  searchAllJobsFromLast30Days: async (filters, page, pageSize) => {
    try {
      console.log("Searching for jobs with filters:", filters);
      const {
        titles = [],
        locations = [],
        experienceLevels = [],
        accepted_college_majors = [],
        salary = 0,
        skills = [],
        companies = [],
      } = filters;
  
      const offset = (page - 1) * pageSize;
  
      // Prepare the base query and parameter container
      let baseQuery = `
      SELECT
        j.id,
        j.title,
        j.location,
        j.salary,
        j.postedDate,
        j.applicants,
        j.description,
        j.salary_max,
        j.MinimumQualifications,
        j.PreferredQualifications,
        j.skills_string,
        j.experienceLevel AS cleaned_experience_level,
        c.logo AS company_logo,
        c.name AS company_name
      FROM JobPostings j
      JOIN Companies c ON j.company_id = c.id
      WHERE j.description IS NOT NULL AND j.description <> ''
        AND j.postedDate >= DATEADD(DAY, -30, GETDATE())
    `;
      const queryParams = [];
      const conditions = [];
  
      // Optimize and combine filter conditions
      if (titles.length) {
        const titleConditions = buildTitleConditions(titles, queryParams);
        conditions.push(`(${titleConditions.join(' OR ')})`);
      }

      if (skills.length) {
        // Build full-text search conditions for skills
        const skillConditions = skills.map((skill, index) => {
          const paramName = `skill${index}`;
          queryParams.push({ name: paramName, value: `"*${skill}*"` });
          return `CONTAINS(j.skills_string, @${paramName}) OR CONTAINS(j.description, @${paramName}) OR CONTAINS(j.raw_description_no_format, @${paramName})`;
        });
        conditions.push(`(${skillConditions.join(' OR ')})`);
      }

      if (locations.length) {
        const locationConditions = locations.map((location, index) => {
          const paramName = `location${index}`;
          queryParams.push({ name: paramName, value: `"*${location}*"` });
          return `CONTAINS(j.location, @${paramName})`;
        });

        // Check if 'Remote' is in the locations array
        if (locations.some(location => location.toLowerCase() === 'remote')) {
          locationConditions.push(`CONTAINS(j.location, '"Virtual" OR "N/A" OR "Remote" OR "Work From Home" OR "Telecommute" OR "Anywhere"')`);
        }

        conditions.push(`(${locationConditions.join(' OR ')})`);
      }
  
      if (salary > 0) {
        conditions.push("j.salary >= @salary");
        queryParams.push({ name: "salary", value: salary });
      }
  
      if (companies.length) {
        const companyParams = companies.map((companyId, index) => {
          const paramName = `company${index}`;
          queryParams.push({ name: paramName, value: companyId });
          return `@${paramName}`;
        });
        conditions.push(`j.company_id IN (${companyParams.join(', ')})`);
      }
  
      if (experienceLevels.length) {
        const expLevelConditions = experienceLevels.map((level, index) => {
          const paramName = `experienceLevel${index}`;
          queryParams.push({ name: paramName, value: `"*${level}*"` });
          const isInternship = level.toLowerCase() === 'internship' || level.toLowerCase() === 'intern';
          const isEntryLevel = level.toLowerCase() === 'entry level';
          if (isInternship) {
            return `CONTAINS(experienceLevel, '"Internship"') OR CONTAINS(title, '"Intern"') AND NOT CONTAINS(title, '"Internal" OR "International"')`;
          }
          if (isEntryLevel) {
        return `CONTAINS(j.experienceLevel, '"Entry Level"')`;
          }
          return `CONTAINS(j.experienceLevel, @${paramName}) OR CONTAINS(j.title, @${paramName})`;
        });
        conditions.push(`(${expLevelConditions.join(' OR ')})`);
      }
      
  
      if (accepted_college_majors.length) {
        const majorConditions = accepted_college_majors.map((major, index) => {
          const paramName = `major${index}`;
          queryParams.push({ name: paramName, value: `"*${major}*"` });
          return `CONTAINS(j.accepted_college_majors, @${paramName})`;
        });
        conditions.push(`(${majorConditions.join(' OR ')})`);
      }
  
      if (conditions.length) {
        baseQuery += " AND " + conditions.join(" AND ");
      }
  
      baseQuery += `
        ORDER BY j.postedDate DESC
        OFFSET @offset ROWS
        FETCH NEXT @pageSize ROWS ONLY;
      `;
  
      // Prepare SQL request and input parameters
      const request = new sql.Request();
      queryParams.forEach((param) => {
        request.input(param.name, sql.NVarChar, param.value);
      });
      request.input("salary", sql.Decimal(18, 2), salary);
      request.input("offset", sql.Int, offset);
      request.input("pageSize", sql.Int, pageSize);

      console.log("Query:", baseQuery);
      console.log("Params:", queryParams);
  
      // Execute the query
      const result = await request.query(baseQuery);

      if (result.recordset.length) {
        // Filter out jobs with descriptions that are mostly '?'
        result.recordset = result.recordset.filter(job => {
          const description = job.description || "";
          const questionMarkCount = (description.match(/\?/g) || []).length;
          const totalLength = description.length;

          // Check if the description is mostly '?'
          return totalLength === 0 || (questionMarkCount / totalLength) < 0.5;
        });
      }
  
      return result.recordset;
    } catch (error) {
      console.error("Error in searchAllJobsFromLast30Days:", error);
      throw error;
    }
  },

  searchRankedJobsFromLast30Days: async (filters, page, pageSize) => {
    try {
      console.log("Searching for ranked jobs with filters:", filters);
      const {
        titles = [],
        locations = [],
        experienceLevels = [],
        accepted_college_majors = [],
        salary = 0,
        skills = [],
        companies = [],
      } = filters;

      // Expand titles using the provided expandTitles function
      const expandedTitles = expandTitles(titles);
      const expandedExperienceLevels = expandExperienceLevels(experienceLevels);

      console.log("Expanded titles:", expandedTitles);
      console.log("Expanded experience levels:", expandedExperienceLevels);
  
      const offset = (page - 1) * pageSize;
  
      // Prepare the base query with scoring
      let baseQuery = `
        WITH ScoredJobs AS (
          SELECT
            j.id,
            j.title,
            j.location,
            j.salary,
            j.postedDate,
            j.applicants,
            j.description,
            j.salary_max,
            j.skills_string,
            j.experienceLevel AS cleaned_experience_level,
            c.logo AS company_logo,
            c.name AS company_name,
            (
              CASE
                -- Base score starts at 0
                WHEN 1=1 THEN 0
                ELSE 0
              END
              -- Add title match scores
              ${expandedTitles.map(({ term, isExact }, index) => `
                + CASE WHEN j.title LIKE '%${term}%' THEN ${isExact ? 100 : 60}
                  WHEN j.description LIKE '%${term}%' THEN ${isExact ? 20 : 10}
                  ELSE 0
                END
              `).join('\n')}
              ${expandedExperienceLevels.map((level, index) => `
                + CASE 
                  WHEN j.experienceLevel LIKE '%${level}%' THEN 50
                  WHEN j.title LIKE '%${level}%' THEN 30
                  WHEN j.description LIKE '%${level}%' THEN 10
                  ELSE 0 
                END
              `).join('\n')}
              -- Add location match scores
              ${locations.map((location, index) => `
                + CASE WHEN j.location LIKE '%${location}%' THEN 40 ELSE 0 END
              `).join('\n')}
              -- Add skills match scores
              ${skills.map((skill, index) => `
                + CASE 
                  WHEN j.skills_string LIKE '%${skill}%' THEN 30
                  WHEN j.description LIKE '%${skill}%' THEN 15
                  ELSE 0 
                END
              `).join('\n')}
            ) as relevance_score
          FROM JobPostings j
          JOIN Companies c ON j.company_id = c.id
          WHERE 1 = 1
      `;
  
      const queryParams = [];
      const conditions = [];
  
      // Add filter conditions similar to the original function
      if (expandedTitles.length) {
        const titleConditions = expandedTitles.map(({ term }, index) => {
          const paramName = `title${index}`;
          queryParams.push({ name: paramName, value: `%${term}%` });
          return `j.title LIKE @${paramName} OR j.description LIKE @${paramName}`;
        });
        conditions.push(`(${titleConditions.join(' OR ')})`);
      }
  
      if (skills.length) {
        const skillConditions = skills.map((skill, index) => {
          const paramName = `skill${index}`;
          queryParams.push({ name: paramName, value: `%${skill}%` });
          return `j.skills_string LIKE @${paramName} OR j.description LIKE @${paramName} OR j.raw_description_no_format LIKE @${paramName}`;
        });
        conditions.push(`(${skillConditions.join(' OR ')})`);
      }
  
      if (locations.length) {
        const locationConditions = locations.map((location, index) => {
          const paramName = `location${index}`;
          queryParams.push({ name: paramName, value: `%${location}%` });
          return `j.location LIKE @${paramName}`;
        });
        conditions.push(`(${locationConditions.join(' OR ')})`);
      }
  
      if (salary > 0) {
        conditions.push(`(
          j.salary IS NULL OR 
          j.salary = 0 OR
          j.salary >= @minSalary - 15000 OR 
          (j.salary_max IS NOT NULL AND j.salary_max >= @minSalary)
        )`);
      }
  
      if (companies.length) {
        const companyParams = companies.map((companyId, index) => {
          const paramName = `company${index}`;
          queryParams.push({ name: paramName, value: companyId });
          return `@${paramName}`;
        });
        conditions.push(`j.company_id IN (${companyParams.join(', ')})`);
      }
  
      if (expandedExperienceLevels.length) {
        const expLevelConditions = expandedExperienceLevels.map((level, index) => {
          const paramName = `experienceLevel${index}`;
          queryParams.push({ name: paramName, value: `%${level}%` });
          return `j.experienceLevel LIKE @${paramName} OR j.title LIKE @${paramName}`;
        });
        conditions.push(`(${expLevelConditions.join(' OR ')})`);
      }
  
      if (accepted_college_majors.length) {
        const majorConditions = accepted_college_majors.map((major, index) => {
          const paramName = `major${index}`;
          queryParams.push({ name: paramName, value: `%${major}%` });
          return `j.accepted_college_majors LIKE @${paramName}`;
        });
        conditions.push(`(${majorConditions.join(' OR ')})`);
      }
  
      if (conditions.length) {
        baseQuery += " AND " + conditions.join(" AND ");
      }
  
      baseQuery += `
        )
        SELECT *
        FROM ScoredJobs
        WHERE relevance_score > 0
        ORDER BY relevance_score DESC, postedDate DESC
        OFFSET @offset ROWS
        FETCH NEXT @pageSize ROWS ONLY;
      `;
  
      // Prepare SQL request and input parameters
      const request = new sql.Request();
      queryParams.forEach((param) => {
        request.input(param.name, sql.NVarChar, param.value);
      });
      
      // Add these parameters separately since they're different types
      request.input("minSalary", sql.Decimal(18, 2), salary);
      request.input("offset", sql.Int, offset);
      request.input("pageSize", sql.Int, pageSize);
  
      // Execute the query
      const result = await request.query(baseQuery);
  
      if (result.recordset.length) {
        // Filter out jobs with descriptions that are mostly '?'
        result.recordset = result.recordset.filter(job => {
          const description = job.description || "";
          const questionMarkCount = (description.match(/\?/g) || []).length;
          const totalLength = description.length;
          return totalLength === 0 || (questionMarkCount / totalLength) < 0.5;
        });
      }
  
      return result.recordset;
    } catch (error) {
      console.error("Error in searchRankedJobsFromLast30Days:", error);
      throw error;
    }
  },

  getTrendingJobs: async (limit = 10) => {
    try {
      const result = await sql.query(`
        WITH ScoredJobs AS (
          SELECT 
            j.*,
            c.name AS company_name,
            c.logo AS company_logo,
            c.location AS company_location,
            c.description AS company_description,
            CAST(
              EXP(-DATEDIFF(day, j.postedDate, GETDATE()) * 0.1) AS FLOAT
            ) AS age_factor,
            CAST(
              COALESCE(j.applicants, 0) AS FLOAT
            ) / NULLIF(
              (SELECT MAX(COALESCE(applicants, 0)) FROM JobPostings), 0
            ) AS normalized_applicants,
            CAST(
              COALESCE(j.views, 0) AS FLOAT
            ) / NULLIF(
              (SELECT MAX(COALESCE(views, 0)) FROM JobPostings), 0
            ) AS normalized_views
          FROM JobPostings j
          LEFT JOIN companies c ON j.company_id = c.id
          WHERE 
            j.postedDate >= DATEADD(day, -30, GETDATE()) 
            AND j.deleted = 0
        )
        SELECT 
          id,
          title,
          salary,
          salary_max,
          experienceLevel,
          location,
          postedDate,
          link,
          description,
          company_id,
          applicants,
          views,
          company_name,
          company_logo,
          company_location,
          company_description,
          (
            (normalized_applicants * 0.6) + 
            (normalized_views * 0.4)        
          ) * age_factor AS trending_score
        FROM ScoredJobs
        WHERE 
          -- Ensure we have either applicants or views
          (COALESCE(applicants, 0) > 0 OR COALESCE(views, 0) > 0)
        ORDER BY trending_score DESC
        OFFSET 0 ROWS
        FETCH NEXT ${limit} ROWS ONLY
      `);
  
      if (result.recordset.length) {
        // Filter out jobs with descriptions that are mostly '?'
        result.recordset = result.recordset.filter(job => {
          const description = job.description || "";
          const questionMarkCount = (description.match(/\?/g) || []).length;
          const totalLength = description.length;
          
          return totalLength === 0 || (questionMarkCount / totalLength) < 0.5;
        });
  
        // Clean up markdown from descriptions
        result.recordset = result.recordset.map(job => {
          job.description = job.description ? job.description.replace(/[\*\#]/g, '') : "";
          return job;
        });
      }
  
      return result.recordset;
    } catch (err) {
      console.error("Database query error in getTrendingJobs:", err);
      throw err;
    }
  },

  getTrendingJobsPaginated: async (page = 1, pageSize = 10) => {
    try {
      // Calculate offset from page number
      const offset = (page - 1) * pageSize;
      
      // First query to get total count
      const countResult = await sql.query(`
        WITH ScoredJobs AS (
          SELECT 
            j.*,
            CAST(
              EXP(-DATEDIFF(day, j.postedDate, GETDATE()) * 0.1) AS FLOAT
            ) AS age_factor,
            CAST(
              COALESCE(j.applicants, 0) AS FLOAT
            ) / NULLIF(
              (SELECT MAX(COALESCE(applicants, 0)) FROM JobPostings), 0
            ) AS normalized_applicants,
            CAST(
              COALESCE(j.views, 0) AS FLOAT
            ) / NULLIF(
              (SELECT MAX(COALESCE(views, 0)) FROM JobPostings), 0
            ) AS normalized_views
          FROM JobPostings j
          WHERE 
            j.postedDate >= DATEADD(day, -30, GETDATE())
            AND j.deleted = 0
        )
        SELECT COUNT(*) as total
        FROM ScoredJobs
        WHERE (COALESCE(applicants, 0) > 0 OR COALESCE(views, 0) > 0)
      `);
  
      const total = countResult.recordset[0].total;
      const totalPages = Math.ceil(total / pageSize);
  
      // Main query with pagination
      const result = await sql.query(`
        WITH ScoredJobs AS (
          SELECT 
            j.*,
            c.name AS company_name,
            c.logo AS company_logo,
            c.location AS company_location,
            c.description AS company_description,
            CAST(
              EXP(-DATEDIFF(day, j.postedDate, GETDATE()) * 0.1) AS FLOAT
            ) AS age_factor,
            CAST(
              COALESCE(j.applicants, 0) AS FLOAT
            ) / NULLIF(
              (SELECT MAX(COALESCE(applicants, 0)) FROM JobPostings), 0
            ) AS normalized_applicants,
            CAST(
              COALESCE(j.views, 0) AS FLOAT
            ) / NULLIF(
              (SELECT MAX(COALESCE(views, 0)) FROM JobPostings), 0
            ) AS normalized_views
          FROM JobPostings j
          LEFT JOIN companies c ON j.company_id = c.id
          WHERE 
            j.postedDate >= DATEADD(day, -30, GETDATE())
            AND j.deleted = 0
        )
        SELECT 
          id,
          title,
          salary,
          salary_max,
          experienceLevel,
          location,
          postedDate,
          link,
          description,
          company_id,
          applicants,
          views,
          company_name,
          company_logo,
          company_location,
          company_description,
          (
            (normalized_applicants * 0.6) + 
            (normalized_views * 0.4)        
          ) * age_factor AS trending_score
        FROM ScoredJobs
        WHERE 
          (COALESCE(applicants, 0) > 0 OR COALESCE(views, 0) > 0)
        ORDER BY trending_score DESC
        OFFSET ${offset} ROWS
        FETCH NEXT ${pageSize} ROWS ONLY
      `);
  
      if (result.recordset.length) {
        // Filter out jobs with descriptions that are mostly '?'
        result.recordset = result.recordset.filter(job => {
          const description = job.description || "";
          const questionMarkCount = (description.match(/\?/g) || []).length;
          const totalLength = description.length;
          
          return totalLength === 0 || (questionMarkCount / totalLength) < 0.5;
        });
  
        // Clean up markdown from descriptions
        result.recordset = result.recordset.map(job => {
          job.description = job.description ? job.description.replace(/[\*\#]/g, '') : "";
          return job;
        });
      }
  
      // Return pagination metadata along with the results
      return result.recordset;
    } catch (err) {
      console.error("Database query error in getTrendingJobsPaginated:", err);
      throw err;
    }
  },

  searchRecentJobs: async (page, pageSize) => {
    try {
      const offset = (page - 1) * pageSize;
  
      const query = `
        SELECT
          j.*,
          c.logo AS company_logo,
          c.name AS company_name,
          j.experienceLevel AS cleaned_experience_level
        FROM JobPostings j
        JOIN Companies c ON j.company_id = c.id
        ORDER BY j.postedDate DESC
        OFFSET @offset ROWS
        FETCH NEXT @pageSize ROWS ONLY;
      `;
  
      const request = new sql.Request();
      request.input("offset", sql.Int, offset);
      request.input("pageSize", sql.Int, pageSize);
  
      const result = await request.query(query);

      if (result.recordset.length) {
        // Filter out jobs with descriptions that are mostly empty or contain excessive question marks
        result.recordset = result.recordset.filter(job => {
          const description = job.description || "";
          const questionMarkCount = (description.match(/\?/g) || []).length;
          const totalLength = description.replace(/[^a-zA-Z0-9]/g, '').length; // Remove non-markdown characters

          // Check if the description is mostly '?'
          return totalLength === 0 || (questionMarkCount / totalLength) < 0.5;
        });

      result.recordset = result.recordset.map(job => {
        job.description = job.description ? job.description.replace(/[\*\#]/g, '') : "";
        return job;
      });
      }

      
      
      return result.recordset;
    } catch (error) {
      console.error("Error in getRecentJobs:", error);
      throw error;
    }
  },
  
  

  searchUserPreferredJobs: async (userPreferences, page, pageSize) => {
    try {
      console.log("Searching for jobs with user preferences:", userPreferences);
      const {
        titles = "",
        locations = "",
        experienceLevel = "",
        majors = [],
        salary = 0,
        skills = [],
        companies = [],
      } = userPreferences;

      const offset = (page - 1) * pageSize;

      // Initialize the parameter container
      const queryParams = {};

      // Prepare parameters for titles
      if (titles) {
        const titleKeywords = titles.split(/[,\s]+/);
        titleKeywords.forEach((keyword, i) => {
          queryParams[`title${i}`] = `%${keyword}%`;
        });
      }

      // Prepare parameters for locations
      if (locations && locations.length > 0) {
        console.log("Locations:", locations);
        if (Array.isArray(locations)) {
          locations.forEach((location, i) => {
            queryParams[`location${i}`] = `%${location}%`;
          });
        } else if (typeof locations === "string" && locations.trim() !== "") {
          const locationKeywords = locations.split(/[,\s]+/);
          locationKeywords.forEach((location, i) => {
            queryParams[`location${i}`] = `%${location}%`;
          });
        } else {
          console.log("Locations is empty or invalid. Treating as empty.");
          queryParams.location0 = "%%"; // This will match any location
        }
      } else {
        console.log("Locations is empty or undefined.");
        queryParams.location0 = "%%"; // This will match any location
      }

      // Prepare parameter for experience level
      if (experienceLevel) {
        queryParams.experienceLevel = `%${experienceLevel}%`;
      } else {
        queryParams.experienceLevel = null;
      }

      // Prepare parameters for majors
      if (majors.length) {
        majors.forEach((major, i) => {
          queryParams[`major${i}`] = `%${major}%`;
        });
      }

      // Prepare parameter for salary
      queryParams.salary = salary;

      // Prepare parameters for companies
      if (companies.length) {
        companies.forEach((companyId, i) => {
          queryParams[`company${i}`] = companyId;
        });
      }

      // Prepare parameters for skills
      if (skills.length) {
        skills.forEach((skill, i) => {
          queryParams[`skill${i}`] = skill;
        });
      }

      // Build the SQL query
      let baseQuery = `
        WITH CleanedJobs AS (
          SELECT
            j.*,
            c.logo AS company_logo,
            c.name AS company_name,
            CASE
              WHEN j.title LIKE '%internship%' OR j.experienceLevel LIKE '%internship%' THEN 'Internship'
              WHEN j.title LIKE '%junior%' OR j.experienceLevel LIKE '%junior%' THEN 'Junior'
              WHEN j.title LIKE '%senior%' OR j.experienceLevel LIKE '%senior%' THEN 'Senior'
              WHEN j.title LIKE '%lead%' OR j.experienceLevel LIKE '%lead%' THEN 'Lead'
              WHEN j.title LIKE '%manager%' OR j.experienceLevel LIKE '%manager%' THEN 'Manager'
              ELSE j.experienceLevel
            END AS cleaned_experience_level
          FROM JobPostings j
          JOIN Companies c ON j.company_id = c.id
        ),
        ScoredJobs AS (
          SELECT
            cj.*,
            (
              -- Initialize score to 0
              0
              -- Add points for title matches
              + CASE WHEN ${
                titles
                  ? "(" +
                    titles
                      .split(/[,\s]+/)
                      .map((_, i) => `cj.title LIKE @title${i}`)
                      .join(" OR ") +
                    ")"
                  : "0=1"
              } THEN 1 ELSE 0 END
              -- Add points for location matches
              + CASE WHEN ${
                Object.keys(queryParams).some((key) =>
                  key.startsWith("location"),
                )
                  ? "(" +
                    Object.keys(queryParams)
                      .filter((key) => key.startsWith("location"))
                      .map((key) => `cj.location LIKE @${key}`)
                      .join(" OR ") +
                    ")"
                  : "1=1" // This will always be true if no locations are specified
              } THEN 1 ELSE 0 END
              -- Add points for experience level matches
              + CASE WHEN @experienceLevel IS NOT NULL AND cj.cleaned_experience_level LIKE @experienceLevel THEN 1 ELSE 0 END
              -- Add points for majors matches
              + CASE WHEN ${majors.length ? "(" + majors.map((_, i) => `cj.accepted_college_majors LIKE @major${i}`).join(" OR ") + ")" : "0=1"} THEN 1 ELSE 0 END
              -- Add points for salary match
              + CASE WHEN cj.salary >= @salary THEN 1 ELSE 0 END
              -- Add points for company matches
              + CASE WHEN ${companies.length ? "(" + companies.map((_, i) => `cj.company_id = @company${i}`).join(" OR ") : "0=1"} THEN 1 ELSE 0 END
              -- Add points for skills matches
              + (
                SELECT COUNT(*)
                FROM job_skills js
                JOIN skills s ON js.skill_id = s.id
                WHERE js.job_id = cj.id
                AND s.name IN (${skills.length ? skills.map((_, i) => `@skill${i}`).join(", ") : "NULL"})
              )
            ) AS likeness_score
          FROM CleanedJobs cj
        )
        SELECT sj.*,
          (
            SELECT STRING_AGG(jt.tagName, ', ')
            FROM JobPostingsTags jpt
            JOIN JobTags jt ON jpt.tagId = jt.id
            WHERE jpt.jobId = sj.id
          ) AS tags,
          (
            SELECT STRING_AGG(s.name, ', ')
            FROM job_skills js
            JOIN skills s ON js.skill_id = s.id
            WHERE js.job_id = sj.id
          ) AS skills
        FROM ScoredJobs sj
        WHERE sj.likeness_score > 0
        ORDER BY sj.likeness_score DESC, sj.postedDate DESC
        OFFSET @offset ROWS
        FETCH NEXT @pageSize ROWS ONLY;
      `;

      // Prepare SQL request and input parameters
      const request = new sql.Request();
      Object.entries(queryParams).forEach(([key, value]) => {
        request.input(key, value);
      });
      request.input("offset", sql.Int, offset);
      request.input("pageSize", sql.Int, pageSize);

      // Execute the query
      const result = await request.query(baseQuery);

      return result.recordset;
    } catch (error) {
      console.error("Error in searchUserPreferredJobs:", error);
      throw error;
    }
  },

  getTopJobSuggestions: async (filters, page, pageSize) => {
    try {
      console.log("Searching for jobs with filters:", filters);
      const {
        titles = [],
        locations = [],
        experienceLevels = [],
        majors = [],
        salary = 0,
        skills = [],
        companies = [],
      } = filters;

      const offset = (page - 1) * pageSize;

      // Prepare the base query and parameter container
      let baseQuery = `
        WITH FilteredJobs AS (
          SELECT
            j.*,
            c.logo AS company_logo,
            c.name AS company_name,
            CASE
              WHEN LOWER(j.title) LIKE '%internship%' OR LOWER(j.experienceLevel) LIKE '%internship%' THEN 'Internship'
              WHEN LOWER(j.title) LIKE '%junior%' OR LOWER(j.experienceLevel) LIKE '%junior%' THEN 'Junior'
              WHEN LOWER(j.title) LIKE '%senior%' OR LOWER(j.experienceLevel) LIKE '%senior%' THEN 'Senior'
              WHEN LOWER(j.title) LIKE '%lead%' OR LOWER(j.experienceLevel) LIKE '%lead%' THEN 'Lead'
              WHEN LOWER(j.title) LIKE '%manager%' OR LOWER(j.experienceLevel) LIKE '%manager%' THEN 'Manager'
              ELSE j.experienceLevel
            END AS cleaned_experience_level
          FROM JobPostings j
          JOIN Companies c ON j.company_id = c.id
          WHERE 1=1
      `;
      const queryParams = {};

      // Optimize and combine filter conditions
      if (titles.length) {
        const titleCondition = titles
          .map((title, i) => {
            queryParams[`title${i}`] = `%${title}%`;
            return `j.title LIKE @title${i}`;
          })
          .join(" OR ");

        baseQuery += ` AND (${titleCondition})`;
      }

      if (locations.length) {
        const locationCondition = locations
          .map((location, i) => {
            queryParams[`location${i}`] = `%${location}%`;
            return `j.location LIKE @location${i}`;
          })
          .join(" OR ");

        baseQuery += ` AND (${locationCondition})`;
      }

      baseQuery += `
        )
        SELECT j.*
        FROM FilteredJobs j
        WHERE 1=1
      `;

      // Add experience level filter after defining the CTE
      if (experienceLevels.length) {
        const levelsCondition = experienceLevels
          .map((level, i) => {
            queryParams[`expLevel${i}`] = `%${level}%`;
            return `j.cleaned_experience_level LIKE @expLevel${i}`;
          })
          .join(" OR ");

        baseQuery += ` AND (${levelsCondition})`;
      }

      if (majors.length) {
        const majorsCondition = majors
          .map((major, i) => {
            queryParams[`major${i}`] = `%${major}%`;
            return `j.major LIKE @major${i}`;
          })
          .join(" OR ");

        baseQuery += ` AND (${majorsCondition})`;
      }

      baseQuery += `
        ORDER BY j.postedDate DESC
        OFFSET @offset ROWS
        FETCH NEXT @pageSize ROWS ONLY;
      `;

      // Prepare SQL request and input parameters
      const request = new sql.Request();
      Object.entries(queryParams).forEach(([key, value]) => {
        request.input(key, value);
      });
      request.input("offset", sql.Int, offset);
      request.input("pageSize", sql.Int, pageSize);

      // Execute the query
      const result = await request.query(baseQuery);

      return result.recordset;
    } catch (error) {
      console.error("Error in searchAllJobsFromLast30Days:", error);
      throw error;
    }
  },

  getJobTitles: async () => {
    try {
      const result = await sql.query`
        SELECT DISTINCT title FROM JobPostings
      `;
      const seenTitles = new Set();
      const jobTitles = result.recordset.reduce((acc, job, index) => {
        if (!seenTitles.has(job.title)) {
          seenTitles.add(job.title);
          acc.push({ id: acc.length + 1, name: job.title });
        }
        return acc;
      }, []);
      return jobTitles;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  incrementJobViewCount: async (postId) => {
    try {
      if (!postId) {
        throw new Error("postId is required");
      }

      await sql.query`
        UPDATE JobPostings
        SET views = COALESCE(views, 0) + 1
        WHERE id = ${postId}`;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getJobById: async (id) => {
    try {
      const result = await sql.query`
        SELECT * FROM JobPostings WHERE id = ${id}
      `;
      return result.recordset[0];
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  updateCompany: async (
    id,
    name = undefined,
    location = undefined,
    description = undefined,
    logo = undefined,
    logo_url = undefined,
    industry = undefined,
    founded = undefined,
    size = undefined,
    stock_symbol = undefined,
    alternate_names = undefined,
    job_board_url = undefined,
  ) => {
    // Construct the SET clause dynamically
    const fields = [];
    const values = {};

    if (name !== undefined) {
      fields.push("name = @name");
      values.name = { value: name || null, type: sql.NVarChar };
    }
    if (location !== undefined) {
      fields.push("location = @location");
      values.location = { value: location || null, type: sql.NVarChar };
    }
    if (description !== undefined) {
      fields.push("description = @description");
      values.description = { value: description || null, type: sql.NVarChar };
    }
    if (logo !== undefined) {
      fields.push("logo = @logo");
      values.logo = { value: logo || null, type: sql.VarChar };
    }
    if (logo_url !== undefined) {
      fields.push("logo_url = @logo_url");
      values.logo_url = { value: logo_url || null, type: sql.VarChar };
    }
    if (industry !== undefined) {
      fields.push("industry = @industry");
      values.industry = { value: industry || null, type: sql.VarChar };
    }
    if (alternate_names !== undefined) {
      fields.push("alternate_names = @alternate_names");
      values.alternate_names = {
        value: alternate_names || null,
        type: sql.VarChar,
      };
    }
    if (founded !== undefined) {
      fields.push("founded = @founded");
      values.founded = { value: founded || null, type: sql.DateTime };
    }
    if (size !== undefined) {
      fields.push("size = @size");
      values.size = { value: size || null, type: sql.VarChar };
    }
    if (stock_symbol !== undefined) {
      fields.push("stock_symbol = @stock_symbol");
      values.stock_symbol = { value: stock_symbol || null, type: sql.VarChar };
    }
    if (job_board_url !== undefined) {
      fields.push("job_board_url = @job_board_url");
      values.job_board_url = {
        value: job_board_url || null,
        type: sql.VarChar,
      };
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

  forceUpdateCompany: async (id, companyData) => {
    // Construct the SET clause dynamically
    const fields = [];
    const values = {};

    // List of valid fields that can be updated
    const validFields = [
      "name",
      "location",
      "description",
      "logo",
      "logo_url",
      "industry",
      "founded",
      "size",
      "stock_symbol",
      "job_board_url",
      "new_id",
      "company_stage",
      "company_recent_news_sentiment",
      "company_sentiment",
      "company_issues",
      "company_engineer_choice",
      "company_website",
      "job_board_url2",
      "job_board_url3",
      "company_linkedin_page",
      "twitter_username",
    ];

    // Function to determine SQL type based on field name
    const getSqlType = (fieldName) => {
      if (fieldName === "founded") return sql.DateTime;
      if (fieldName === "new_id") return sql.UniqueIdentifier;
      if (
        [
          "description",
          "company_recent_news_sentiment",
          "company_sentiment",
          "company_issues",
          "company_engineer_choice",
        ].includes(fieldName)
      ) {
        return sql.NVarChar;
      }
      return sql.VarChar;
    };

    // Iterate over valid fields and add them to the update if present in companyData
    for (const field of validFields) {
      if (companyData[field] !== undefined) {
        fields.push(`${field} = @${field}`);
        values[field] = { value: companyData[field], type: getSqlType(field) };
      }
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

  getUserJobPreferences: async (userId) => {
    try {
      const result = await sql.query`
        SELECT jobPreferredTitle, jobPreferredSkills, jobPreferredLocation, jobExperienceLevel, jobPreferredIndustry, jobPreferredSalary FROM users WHERE id = ${userId}
      `;
      return result.recordset[0];
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getRandomJobs: async (limit) => {
    try {
      const result = await sql.query(`
SELECT TOP ${limit}
  jp.*,
  c.name AS company_name,
  c.logo AS company_logo,
  c.location AS company_location,
  c.description AS company_description,
  s.job_skills
FROM JobPostings jp
LEFT JOIN companies c ON jp.company_id = c.id
LEFT JOIN (
  SELECT job_id, STRING_AGG(s.name, ', ') AS job_skills
  FROM job_skills js
  INNER JOIN skills s ON js.skill_id = s.id
  GROUP BY job_id
) s ON jp.id = s.job_id
WHERE jp.id >= (ABS(CHECKSUM(NEWID())) % (SELECT COUNT(*) FROM JobPostings))
ORDER BY jp.postedDate DESC
      `);
      const jobs = result.recordset;
      return jobs;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getRecent10Jobs: async () => {
    try {
      const result = await sql.query(`
        WITH RecentJobs AS (
          SELECT TOP 100
            JobPostings.*,
            companies.name AS company_name,
            companies.logo AS company_logo,
            companies.location AS company_location,
            companies.description AS company_description,
            (
              SELECT STRING_AGG(skills.name, ', ')
              FROM job_skills
              INNER JOIN skills ON job_skills.skill_id = skills.id
              WHERE job_skills.job_id = JobPostings.id
            ) AS job_skills
          FROM JobPostings
          LEFT JOIN companies ON JobPostings.company_id = companies.id
          ORDER BY JobPostings.postedDate DESC
        )
        SELECT TOP 10 *
        FROM RecentJobs
        ORDER BY NEWID()
      `);

      const jobs = result.recordset;
      return jobs;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },
  getJobsBySearch: async (
    title = "",
    location = "",
    experienceLevel = "",
    salary = "",
    limit = null,
    offset = 0,
    allowedJobLevels = [],
    tags = [],
  ) => {
    try {
      let query = `
        WITH FilteredJobs AS (
          SELECT j.id, j.title, j.salary, j.salary_max, j.experienceLevel, j.location, j.postedDate,
                 j.link, j.description, j.company_id, j.recruiter_id, j.views
          FROM JobPostings j
          WHERE 1=1
      `;

      const queryParams = {};
      const whereConditions = [];

      if (title) {
        whereConditions.push("j.title LIKE @title");
        queryParams.title = `%${title}%`;
      }

      if (location) {
        whereConditions.push(
          "(j.location LIKE @location OR j.location LIKE @stateAbbr)",
        );
        queryParams.location = `%${location}%`;
        queryParams.stateAbbr = `% ${location.substring(0, 2)},%`;
      }

      if (experienceLevel) {
        whereConditions.push("j.experienceLevel = @experienceLevel");
        queryParams.experienceLevel = experienceLevel;
      }

      if (salary) {
        whereConditions.push("j.salary >= @salary");
        queryParams.salary = parseInt(salary);
      }

      if (allowedJobLevels && allowedJobLevels.length > 0) {
        whereConditions.push(
          `j.experienceLevel IN (${allowedJobLevels
            .map((_, i) => `@level${i}`)
            .join(", ")})`,
        );
        allowedJobLevels.forEach((level, i) => {
          queryParams[`level${i}`] = level;
        });
      }

      if (tags && tags.length > 0) {
        whereConditions.push(`
          EXISTS (
            SELECT 1
            FROM JobPostingsTags jpt
            JOIN JobTags jt ON jpt.tagId = jt.id
            WHERE jpt.jobId = j.id AND jt.tagName IN (${tags
              .map((_, i) => `@tag${i}`)
              .join(", ")})
            GROUP BY jpt.jobId
            HAVING COUNT(DISTINCT jt.tagName) = ${tags.length}
          )
        `);
        tags.forEach((tag, i) => {
          queryParams[`tag${i}`] = tag;
        });
      }

      if (whereConditions.length > 0) {
        query += ` AND ${whereConditions.join(" AND ")}`;
      }

      query += `
        )
        SELECT f.*,
               c.name AS company_name, c.logo AS company_logo, c.location AS company_location,
               c.description AS company_description,
               (
                 SELECT STRING_AGG(jt.tagName, ', ')
                 FROM JobPostingsTags jpt
                 JOIN JobTags jt ON jpt.tagId = jt.id
                 WHERE jpt.jobId = f.id
               ) AS tags,
               (
                 SELECT STRING_AGG(s.name, ', ')
                 FROM job_skills js
                 JOIN skills s ON js.skill_id = s.id
                 WHERE js.job_id = f.id
               ) AS skills
        FROM FilteredJobs f
        LEFT JOIN companies c ON f.company_id = c.id
        ORDER BY f.postedDate DESC
      `;

      if (limit !== null) {
        query += " OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY";
        queryParams.offset = offset;
        queryParams.limit = limit;
      }

      const request = new sql.Request();
      Object.entries(queryParams).forEach(([key, value]) => {
        request.input(key, value);
      });

      const result = await request.query(query);
      return result.recordset;
    } catch (error) {
      console.error("Error in getJobsBySearch:", error);
      throw error;
    }
  },

  getJobsCount: async (allowedJobLevels, tags) => {
    try {
      let query = `
        SELECT COUNT(DISTINCT j.id) as count
        FROM JobPostings j
        WHERE 1=1
      `;

      const queryParams = {};

      if (allowedJobLevels && allowedJobLevels.length > 0) {
        query += ` AND j.experienceLevel IN (${allowedJobLevels
          .map((_, i) => `@level${i}`)
          .join(", ")})`;
        allowedJobLevels.forEach((level, i) => {
          queryParams[`level${i}`] = level;
        });
      }

      if (tags && tags.length > 0) {
        query += `
          AND EXISTS (
            SELECT 1 FROM JobPostingsTags jpt
            INNER JOIN JobTags jt ON jpt.tagId = jt.id
            WHERE jpt.jobId = j.id AND jt.tagName IN (${tags
              .map((_, i) => `@tag${i}`)
              .join(", ")})
          )
        `;
        tags.forEach((tag, i) => {
          queryParams[`tag${i}`] = tag;
        });
      }

      const request = new sql.Request();
      Object.entries(queryParams).forEach(([key, value]) => {
        request.input(key, value);
      });

      const result = await request.query(query);
      return result.recordset[0].count;
    } catch (error) {
      console.error("Error in getJobsCount:", error);
      throw error;
    }
  },

  simpleGetJobsCount: async () => {
    try {
      const result = await sql.query`
        SELECT
          COUNT(*) as totalCount,
          SUM(CASE WHEN CAST(postedDate AS DATE) = CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) as todayCount
        FROM JobPostings
      `;
      return {
        totalCount: result.recordset[0].totalCount,
        todayCount: result.recordset[0].todayCount,
      };
    } catch (error) {
      console.error("Error in simpleGetJobsCount:", error);
      throw error;
    }
  },

  applyForJob: async (userId, jobId) => {
    try {
      const result = await sql.query`
        INSERT INTO user_jobs (user_id, job_id)
        VALUES (${userId}, ${jobId})
      `;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  changeJobStatus: async (userId, jobId, status) => {
    try {
      if (!userId || !jobId || !status) {
        throw new Error("userId, jobId, and status are required");
      }

      status = status.toLowerCase();
      if (
        status !== "pending" &&
        status !== "responded" &&
        status !== "expired"
      ) {
        return null;
      }

      const result = await sql.query`
        UPDATE user_jobs
        SET job_status = ${status}
        WHERE user_id = ${userId} AND job_id = ${jobId}
      `;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  removeJobApplication: async (userId, jobId) => {
    try {
      const result = await sql.query`
        DELETE FROM user_jobs
        WHERE user_id = ${userId} AND job_id = ${jobId}
      `;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getUserAppliedJobs: async (userId) => {
    try {
      const result = await sql.query`
        SELECT
          j.*,
          uj.applied_at,
          uj.status,
          uj.job_status,
          c.name AS company_name,
          c.logo AS company_logo,
          c.location AS company_location,
          c.description AS company_description,
          c.industry AS company_industry,
          c.size AS company_size,
          c.stock_symbol AS company_stock_symbol,
          c.founded AS company_founded,
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
          ) AS skills
        FROM user_jobs uj
        JOIN JobPostings j ON uj.job_id = j.id
        LEFT JOIN companies c ON j.company_id = c.id
        WHERE uj.user_id = ${userId}
        ORDER BY uj.applied_at DESC
      `;
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getUserAppliedJobsCount: async (userId) => {
    try {
      const result = await sql.query`
        SELECT COUNT(*) as count
        FROM user_jobs
        WHERE user_id = ${userId}
      `;
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
      `);
      const jobCount = result.recordset[0].jobCount;
      return jobCount;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getJobsByTag: async (tagId, page, pageSize) => {
    try {
      const offset = (page - 1) * pageSize;

      const query = `
        SELECT JobPostings.*,
               companies.name AS company_name,
               companies.logo AS company_logo,
               companies.location AS company_location,
               companies.description AS company_description,
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
          WHERE tagId = @tagId
        )
        ORDER BY JobPostings.postedDate DESC
        OFFSET @offset ROWS
        FETCH NEXT @pageSize ROWS ONLY
      `;

      const result = await sql.query({
        text: query,
        parameters: [
          { name: "tagId", type: sql.Int, value: tagId },
          { name: "offset", type: sql.Int, value: offset },
          { name: "pageSize", type: sql.Int, value: pageSize },
        ],
      });

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
        }),
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
        WITH OriginalJob AS (
          SELECT id, title, location FROM JobPostings WHERE id = ${jobId}
        )
        SELECT TOP 15
          jp.id,
          jp.title,
          jp.description,
          jp.salary,
          jp.experienceLevel,
          jp.salary_max,
          jp.postedDate,
          jp.location,
          jp.company_id,
          c.name AS company_name,
          c.logo AS company_logo,
          c.location AS company_location,
          c.description AS company_description
        FROM JobPostings jp
        LEFT JOIN companies c ON jp.company_id = c.id
        WHERE jp.id != (SELECT id FROM OriginalJob) 
          AND (jp.location = (SELECT location FROM OriginalJob) OR jp.title LIKE '%' + (SELECT title FROM OriginalJob) + '%')
        ORDER BY jp.postedDate DESC
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
      SELECT TOP 15
      JobPostings.*,
      companies.name AS company_name,
      companies.logo AS company_logo,
      companies.location AS company_location,
      companies.description AS company_description
    FROM JobPostings
    LEFT JOIN companies ON JobPostings.company_id = companies.id
    WHERE JobPostings.company_id = ${companyId}
      AND JobPostings.id != ${jobId}
    ORDER BY NEWID()
    `);

      const jobs = result.recordset;
      return jobs;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getJobsByCompany: async (companyId, page, pageSize) => {
    try {
      const offset = (page - 1) * pageSize;
      const result = await sql.query`
        SELECT
          JobPostings.*,
          companies.name AS company_name,
          companies.logo AS company_logo,
          companies.location AS company_location,
          companies.description AS company_description
        FROM JobPostings
        LEFT JOIN companies ON JobPostings.company_id = companies.id
        WHERE JobPostings.company_id = ${companyId}
        ORDER BY JobPostings.postedDate DESC
                OFFSET ${offset} ROWS
        FETCH NEXT ${pageSize} ROWS ONLY
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
        ORDER BY name
      `);
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getAllJobLinks: async () => {
    try {
      const pool = await sql.connect();
      const result = await pool.request().query(`
        SELECT link from JobPostings
      `);
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getCompaniesWithJobBoard: async () => {
    try {
      const pool = await sql.connect();
      const result = await pool.request().query(`
        SELECT companies.id, companies.name, companies.job_board_url FROM companies
        WHERE companies.job_board_url IS NOT NULL AND companies.job_board_url != ''
      `);
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  // function to get the 10 recent job companies
  // get the most recent 40 job postings
  // and then look at their companies and get the 10 most recent companies
  getRecentCompanies: async () => {
    try {
      const result = await sql.query(`
        WITH RecentCompanies AS (
          SELECT TOP 100
            company_id
          FROM JobPostings
          ORDER BY postedDate DESC
        )
        SELECT TOP 10
          companies.id,
          companies.name,
          companies.logo,
          companies.location,
          companies.description,
          companies.industry,
          companies.size,
          companies.stock_symbol,
          companies.founded,
          ISNULL(job_counts.job_count, 0) AS job_count
        FROM companies
        LEFT JOIN (
          SELECT
            company_id,
            COUNT(*) AS job_count
          FROM JobPostings
          GROUP BY company_id
        ) AS job_counts ON companies.id = job_counts.company_id
        WHERE companies.id IN (SELECT company_id FROM RecentCompanies)
      `);
      const companies = result.recordset;
      return companies;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getSkills: async () => {
    try {
      const result = await sql.query`SELECT * FROM skills`;
      const skills = result.recordset;
      return skills;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  findPreviewById: async (id) => {
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
        FROM JobPostings
        LEFT JOIN companies ON JobPostings.company_id = companies.id
        WHERE JobPostings.id = ${id}
      `;
      const job = result.recordset[0];
      return job;
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
          users.username AS recruiter_username
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

  simpleFindById: async (id) => {
    try {
      const result = await sql.query`
        SELECT
          JobPostings.*,
          companies.name AS company_name,
          companies.logo AS company_logo
        FROM JobPostings
        LEFT JOIN companies ON JobPostings.company_id = companies.id
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
    salary = 0,
    experienceLevel,
    location,
    postedDate = new Date(),
    company_id = 99999,
    link,
    expiration_date = null,
    tags = [],
    description,
    salary_max = null,
    recruiter_id = "1",
    skills = [],
    benefits = [],
    additional_information = "",
    preferredQualifications = "",
    minimumQualifications = "",
    responsibilities = "",
    requirements = "",
    niceToHave = "",
    schedule = "9 - 5",
    hoursPerWeek = 40,
    h1bVisaSponsorship = false,
    isRemote = false,
    equalOpportunityEmployerInfo = "",
    relocation = false,
    isProcessed = 0,
    employmentType = "Traditional",
    sourcePostingDate = "",
  ) => {
    try {
      
      const checkForQuestionMarks = (text) => {
        const questionMarkCount = (text.match(/\?/g) || []).length;
        return questionMarkCount > (text.length * 0.5); // Adjust threshold as needed
      };

      if (checkForQuestionMarks(title) || checkForQuestionMarks(description)) {
        throw new Error("Title or description contains too many question marks.");
      }

      if (typeof link !== "string") {
        throw new Error("Link must be a string");
      }

      // check if type of salary, and salary_max is a string, if so attempt to convert to int fail to 0
      if (typeof salary === "string") {
        salary = parseInt(salary) || 0;
      }
      if (typeof salary_max === "string") {
        salary_max = parseInt(salary_max) || 0;
      }

      if (typeof title !== "string") {
        throw new Error("Title must be a string");
      }

      skills = Array.isArray(skills)
        ? skills
        : typeof skills === "string"
          ? skills.split(",").map((skill) => skill.trim())
          : [];
      tags = Array.isArray(tags)
        ? tags
        : typeof tags === "string"
          ? tags.split(",").map((tag) => tag.trim())
          : [];

      let benefitsArray = [];
      if (Array.isArray(benefits)) {
        benefitsArray = benefits;
      } else if (typeof benefits === "string") {
        benefitsArray = benefits.split(",").map((benefit) => benefit.trim());
      } else if (benefits) {
        console.warn("Unexpected benefits format. Using empty array.");
      }

      // Format the benefits array for SQL query
      const formattedBenefits = benefitsArray
        .map((benefit) => `'${benefit.replace(/'/g, "''")}'`)
        .join(",");

      // check if link already in database
      const linkExists = await utilFunctions.checkForDuplicateLink(link);
      if (linkExists) {
        console.log("Link already exists in database, not inserting.");
        return { error: "Link already exists in database, not inserting." };
      }

      let jobPostingId;
      try {
        // Insert the job posting into the JobPostings table
        // Define a table variable to hold the inserted IDs
        const result = await sql.query`
  DECLARE @InsertedJobPostings TABLE (id INT);

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
    relocation,
    applicants,
    isProcessed,
    employmentType,
    sourcePostingDate
  )
  OUTPUT INSERTED.id INTO @InsertedJobPostings
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
    ${relocation},
    0,
    ${isProcessed},
    ${employmentType},
    ${sourcePostingDate}
  );

  SELECT id FROM @InsertedJobPostings;
`;

        jobPostingId = result.recordset[0].id;
      } catch (err) {
        console.error(`Error inserting job posting: ${err.message}`);
        throw err;
      }

      if (skills && skills.length > 0) {
        for (const skill of skills) {
          try {
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
          } catch (err) {
            console.error(`Error processing skill '${skill}': ${err.message}`);
            throw err;
          }
        }
      }

      if (tags && tags.length > 0) {
        for (const tag of tags) {
          try {
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
          } catch (err) {
            console.error(`Error processing tag '${tag}': ${err.message}`);
            throw err;
          }
        }
      }

      return jobPostingId;
    } catch (err) {
      /*
      console.log(
        `Error creating job posting with information:

        title: ${title},
        salary: ${salary},
        experienceLevel: ${experienceLevel},
        location: ${location},
        postedDate: ${postedDate},
        company_id: ${company_id},
        link: ${link},
        expiration_date: ${expiration_date},
        tags: ${tags},
        description: ${description},
        salary_max: ${salary_max},
        recruiter_id: ${recruiter_id},
        skills: ${skills},
        benefits: ${benefits},
        additional_information: ${additional_information},
        preferredQualifications: ${preferredQualifications},
        minimumQualifications: ${minimumQualifications},
        responsibilities: ${responsibilities},
        requirements: ${requirements},
        niceToHave: ${niceToHave},
        schedule: ${schedule},
        hoursPerWeek: ${hoursPerWeek},
        h1bVisaSponsorship: ${h1bVisaSponsorship},
        isRemote: ${isRemote},
        equalOpportunityEmployerInfo: ${equalOpportunityEmployerInfo},
        relocation: ${relocation}`,
      );
      */
      console.error(
        `Database insert error: ${err.message} in createJobPosting`,
      );
      throw err; // Rethrow the error for the caller to handle
    }
  },

  searchSkills: async (searchTerm) => {
    try {
      const result = await sql.query`
        SELECT TOP 5 s.name, s.id, COUNT(js.job_id) AS job_count
        FROM skills s
        LEFT JOIN job_skills js ON s.id = js.skill_id
        WHERE s.name LIKE ${searchTerm + "%"}
        GROUP BY s.name, s.id
        ORDER BY job_count DESC, s.name
      `;
      return result.recordset.map((record) => ({
        name: record.name,
        id: record.id,
        jobCount: record.job_count,
      }));
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getCompanyByName: async (name) => {
    try {
      const nameWithoutSpaces = name.replace(/[\s']/g, "");
      const result = await sql.query`
        SELECT TOP 1 * FROM companies
        WHERE name = ${name}
        OR CHARINDEX(${name}, alternate_names) > 0
        OR ${name} IN (
          SELECT value
          FROM STRING_SPLIT(alternate_names, ',')
        )
        OR REPLACE(REPLACE(name, ' ', ''), '''', '') = ${nameWithoutSpaces}
        OR CHARINDEX(${nameWithoutSpaces}, REPLACE(REPLACE(alternate_names, ' ', ''), '''', '')) > 0
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
      // Normalize the input name
      const normalizedName = name.toLowerCase().replace(/[^a-z0-9&]/g, "");

      // Define the minimum length for partial matching
      const MIN_PARTIAL_LENGTH = 3;

      // First, try to find an exact match
      const exactMatchResult = await sql.query`
        SELECT TOP 1
          c.id,
          c.name,
          c.logo,
          c.location,
          c.description,
          c.industry,
          c.size,
          c.stock_symbol,
          c.founded,
          COUNT(jp.id) as job_count
        FROM companies c
        LEFT JOIN JobPostings jp ON c.id = jp.company_id
        WHERE
          dbo.NormalizeCompanyName(c.name) = ${normalizedName}
          OR (
            dbo.NormalizeCompanyName(c.name) LIKE '%' + ${normalizedName} + '%'
            AND LEN(${normalizedName}) >= ${MIN_PARTIAL_LENGTH}
          )
        GROUP BY
          c.id, c.name, c.logo, c.location,
          c.description, c.industry, c.size,
          c.stock_symbol, c.founded
        ORDER BY job_count DESC
      `;
      if (exactMatchResult.recordset.length > 0) {
        return exactMatchResult.recordset[0];
      }

      // If no exact match, try partial matches with stricter conditions
      const partialMatchResult = await sql.query`
        SELECT TOP 5
          c.id,
          c.name,
          c.logo,
          c.location,
          c.description,
          c.industry,
          c.size,
          c.stock_symbol,
          c.founded,
          COUNT(jp.id) as job_count,
          LEN(c.name) as name_length,
          LEN(${normalizedName}) as input_length
        FROM companies c
        LEFT JOIN JobPostings jp ON c.id = jp.company_id
        WHERE
          (
            /* Match if the normalized company name contains the input */
            LOWER(REPLACE(c.name, ' ', '')) LIKE '%' + ${normalizedName} + '%'
            /* Or if the input contains the normalized company name,
               but only if the company name is at least 5 characters long */
            OR (
              ${normalizedName} LIKE '%' + LOWER(REPLACE(c.name, ' ', '')) + '%'
              AND LEN(REPLACE(c.name, ' ', '')) >= 5
            )
          )
          /* Ensure the input name meets the minimum length for partial matching */
          AND LEN(${normalizedName}) >= ${MIN_PARTIAL_LENGTH}
        GROUP BY
          c.id, c.name, c.logo, c.location,
          c.description, c.industry, c.size,
          c.stock_symbol, c.founded
        HAVING
          /* Ensure the match is at least 50% of the longer string's length */
          LEN(LOWER(REPLACE(c.name, ' ', ''))) >= 0.5 *
            CASE
              WHEN LEN(${normalizedName}) > LEN(LOWER(REPLACE(c.name, ' ', '')))
                THEN LEN(${normalizedName})
              ELSE LEN(LOWER(REPLACE(c.name, ' ', '')))
            END
        ORDER BY
          CASE
            WHEN LOWER(REPLACE(c.name, ' ', '')) = ${normalizedName} THEN 1
            WHEN LOWER(REPLACE(c.name, ' ', '')) LIKE ${normalizedName} + '%' THEN 2
            WHEN LOWER(REPLACE(c.name, ' ', '')) LIKE '%' + ${normalizedName} + '%' THEN 3
            WHEN ${normalizedName} LIKE '%' + LOWER(REPLACE(c.name, ' ', '')) + '%' THEN 4
            ELSE 5
          END,
          COUNT(jp.id) DESC,
          ABS(LEN(LOWER(REPLACE(c.name, ' ', ''))) - LEN(${normalizedName})) ASC
      `;
      if (partialMatchResult.recordset.length > 0) {
        return partialMatchResult.recordset[0];
      }

      // If still no match, return null
      return null;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  createCompany: async (
    name,
    logo_url,
    location,
    job_board_url,
    description,
    industry,
    size,
    stock_symbol,
    founded,
  ) => {
    try {
      const result = await sql.query`
        INSERT INTO companies (name, logo, location, description, job_board_url, industry, size, stock_symbol, founded)
        OUTPUT INSERTED.id
        VALUES (${name}, ${logo_url}, ${location}, ${description}, ${job_board_url}, ${industry}, ${size}, ${stock_symbol}, ${founded})
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
      DELETE FROM user_jobs WHERE job_id = ${jobId}
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

  automatedDeleteJob: async (jobId) => {
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

  mergeJobs: async (primaryJobId, duplicateJobId) => {
    try {
      // Update applied jobs
      await sql.query`
          UPDATE user_jobs
          SET job_id = ${primaryJobId}
          WHERE job_id = ${duplicateJobId}
        `;

      // Delete the duplicate job from related tables
      await sql.query`
          DELETE FROM JobPostingsTags WHERE jobId = ${duplicateJobId}
          DELETE FROM job_skills WHERE job_id = ${duplicateJobId}
          DELETE FROM JobPostings WHERE id = ${duplicateJobId}
        `;

    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getDuplicateJobPostings: async () => {
    try {
      const result = await sql.query(`
        WITH DuplicateJobPostings AS (
          SELECT title, company_id, salary, location, COUNT(*) AS duplicate_count
          FROM JobPostings
          GROUP BY title, company_id, salary, location
          HAVING COUNT(*) > 1
        )
        SELECT jp.id, jp.title, jp.company_id, jp.salary, jp.location, jp.postedDate
        FROM JobPostings jp
        JOIN DuplicateJobPostings d
        ON jp.title = d.title
        AND jp.company_id = d.company_id
        AND jp.salary = d.salary
        AND jp.location = d.location
        ORDER BY jp.title, jp.company_id, jp.salary, jp.location, jp.postedDate DESC
      `);

      // Group the results
      const groupedResults = result.recordset.reduce((acc, job) => {
        const key = `${job.title}-${job.company_id}-${job.salary}-${job.location}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(job);
        return acc;
      }, {});

      return Object.values(groupedResults);
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getDirectDuplicateCompanies: async () => {
    try {
      const result = await sql.query(`
        WITH DuplicateCompanies AS (
          SELECT name
          FROM companies
          GROUP BY name
          HAVING COUNT(*) > 1
        )
        SELECT MIN(c.id) AS id, c.name,
               COUNT(*) AS duplicate_count,
               STRING_AGG(CAST(c.id AS NVARCHAR(MAX)), ',') WITHIN GROUP (ORDER BY c.id) AS duplicate_ids
        FROM companies c
        JOIN DuplicateCompanies dc ON c.name = dc.name
        GROUP BY c.name
        ORDER BY c.name
      `);
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  combineDuplicateCompaniesAndJobs: async (companyId, duplicateCompanyId) => {
    try {
      await sql.query(`
        UPDATE JobPostings
        SET company_id = ${companyId}
        WHERE company_id = ${duplicateCompanyId}
      `);

      await sql.query(`
        DELETE FROM companies WHERE id = ${duplicateCompanyId}
      `);

      return {
        error: false,
        message: "Duplicate companies combined successfully",
      };
    } catch (err) {
      return { error: true, message: "Error combining duplicate companies" };
    }
  },

  getDuplicateCompanies: async () => {
    try {
      const result = await sql.query(`
        SELECT job_board_url, COUNT(*) AS duplicate_count
        FROM companies
        GROUP BY job_board_url
        HAVING COUNT(*) > 1
      `);
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  // return list of ids of jobs that are older than 60 days
  getOldJobs: async () => {
    try {
      const result = await sql.query(`
        SELECT id
        FROM JobPostings
        WHERE postedDate < DATEADD(day, -60, GETDATE())
      `);
      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getCountOfTopJobTags: async () => {
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
      console.error("Database query error in getCountOfTopJobTags:", err);
      throw err;
    }
  },

  getCountOfTopJobSkills: async () => {
    try {
      const result = await sql.query`
        SELECT TOP 30 skills.name, COUNT(skill_id) AS count, skills.id
        FROM job_skills
        INNER JOIN skills ON job_skills.skill_id = skills.id
        GROUP BY skill_id, skills.name, skills.id
        ORDER BY count DESC
      `;
      return result.recordset;
    } catch (err) {
      console.error("Database query error in getCountOfTopJobSkills:", err);
      throw err;
    }
  },

  getCountOfTopJobTagsByCompany: async (companyId) => {
    try {
      const result = await sql.query`
        SELECT TOP 30 tagName, COUNT(tagId) AS count
        FROM JobPostingsTags
        INNER JOIN JobTags ON JobPostingsTags.tagId = JobTags.id
        WHERE jobId IN (
          SELECT id FROM JobPostings WHERE company_id = ${companyId}
        )
        GROUP BY tagId, tagName
        ORDER BY count DESC
      `;
      return result.recordset;
    } catch (err) {
      console.error(
        "Database query error in getCountOfTopJobTagsByCompany:",
        err,
      );
      throw err;
    }
  },

  getUserJobExperience: async (userId) => {
    try {
      const result = await sql.query`
        SELECT
          je.id,
          je.userId,
          je.title,
          je.startDate,
          je.isCurrent,
          je.employmentHours,
          je.tags,
          je.endDate,
          je.description,
          je.employmentType,
          je.companyName AS userEnteredCompanyName,
          COALESCE(c.name, je.companyName) AS companyName,
          c.logo AS companyLogo
        FROM job_experiences je
        OUTER APPLY (
          SELECT TOP 1 name, logo
          FROM companies
          WHERE LOWER(TRIM(companies.name)) = LOWER(TRIM(je.companyName))
             OR (
               LEN(je.companyName) > 3
               AND (
                 LOWER(TRIM(je.companyName)) LIKE LOWER(TRIM(companies.name)) + ' %'
                 OR LOWER(TRIM(companies.name)) LIKE LOWER(TRIM(je.companyName)) + ' %'
                 OR LOWER(TRIM(je.companyName)) LIKE '% ' + LOWER(TRIM(companies.name))
                 OR LOWER(TRIM(companies.name)) LIKE '% ' + LOWER(TRIM(je.companyName))
               )
             )
          ORDER BY
            CASE
              WHEN LOWER(TRIM(companies.name)) = LOWER(TRIM(je.companyName)) THEN 1
              ELSE 2
            END
        ) c
        WHERE je.userId = ${userId}
        ORDER BY je.startDate DESC
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
    isCurrent,
    startDate,
    endDate,
    description,
    tags,
  ) => {
    try {
      const result = await sql.query`
        INSERT INTO job_experiences (userId, title, employmentType, companyName, isCurrent, location, startDate, endDate, description, tags)
        OUTPUT INSERTED.id
        VALUES (${userId}, ${title}, ${employmentType}, ${companyName}, ${isCurrent}, ${location}, ${startDate}, ${endDate}, ${description}, ${tags})
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
    activities,
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

  getAllCompaniesAndJobCount: async () => {
    try {
      const result = await sql.query`
      SELECT companies.id, companies.name, companies.logo, companies.location, companies.description, companies.industry, companies.size, companies.stock_symbol, companies.founded, COUNT(JobPostings.id) AS jobCount
      FROM companies
      LEFT JOIN JobPostings ON companies.id = JobPostings.company_id AND JobPostings.deleted = 0
      GROUP BY companies.id, companies.name, companies.logo, companies.location, companies.description, companies.industry, companies.size, companies.stock_symbol, companies.founded
      ORDER BY companies.name
    `;

      return result.recordset;
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
          (key) => stateMappings[key] === state,
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

      const jobs = result.recordset;
      return jobs;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getSkillsId: async (skillName) => {
    try {
      const jobTagResult = await sql.query`
        SELECT id FROM skills WHERE name LIKE '%' + ${skillName} + '%'
      `;

      if (jobTagResult.recordset.length > 0) {
        return jobTagResult.recordset[0].id;
      }

      return null;
    } catch (err) {
      console.error("Error in getTagId:", err);
      throw err;
    }
  },

  getSimilarSkills: async (skillId) => {
    try {
      const result = await sql.query(`
        SELECT TOP 9 s.name, COUNT(*) as skill_count
        FROM job_skills js
        JOIN skills s ON js.skill_id = s.id
        WHERE js.job_id IN (
          SELECT job_id
          FROM job_skills
          WHERE skill_id = '${skillId}'
        )
        AND js.skill_id != '${skillId}'
        GROUP BY s.id, s.name
        ORDER BY skill_count DESC
      `);

      return result.recordset;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },

  getJobsBySkills: async (skillId, page = 1, pageSize = 15) => {
    try {
      const offset = (page - 1) * pageSize;
      const result = await sql.query(`
        SELECT JobPostings.*, companies.name AS company_name, companies.logo AS company_logo, companies.location AS company_location, companies.description AS company_description,
(
  SELECT STRING_AGG(skills.name, ', ') WITHIN GROUP (ORDER BY skills.name)
  FROM job_skills
  INNER JOIN skills ON job_skills.skill_id = skills.id
  WHERE job_skills.job_id = JobPostings.id
) AS skills
        FROM JobPostings
        LEFT JOIN companies ON JobPostings.company_id = companies.id
        WHERE JobPostings.id IN (
          SELECT job_id
          FROM job_skills
          WHERE skill_id = '${skillId}'
        )
        ORDER BY JobPostings.postedDate DESC
        OFFSET ${offset} ROWS
        FETCH NEXT ${pageSize} ROWS ONLY
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