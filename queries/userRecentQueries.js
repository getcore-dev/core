const sql = require('mssql');
const { pool } = require('../db'); // Adjust the path as necessary



/*
CREATE TABLE user_recent_viewed_jobs (
    id BIGINT IDENTITY(1,1) PRIMARY KEY, -- Surrogate primary key
    user_id NVARCHAR(255) NOT NULL,
    jobPostings_id INT NOT NULL,
    company_id INT NOT NULL,
    viewed_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (jobPostings_id) REFERENCES jobPostings(id),
    FOREIGN KEY (company_id) REFERENCES companies(id),
    INDEX idx_user_viewed_at (user_id, viewed_at DESC)
);

*/

const userRecentQueries = {
    /**
     * Add a new viewed job for a user.
     * Ensures the recent views limit of 5 by deleting the oldest views if necessary.
     * @param {string} userId - The ID of the user.
     * @param {number} jobId - The ID of the job posting.
     * @param {number} companyId - The ID of the company.
     * @returns {Promise<void>}
     */
    addViewedJob: async (userId, jobId, companyId) => {
        try{
        await pool.request().query(`
            INSERT INTO user_recent_viewed_jobs (user_id, jobPostings_id, company_id)
            VALUES ('${userId}', ${jobId}, ${companyId})
        `);

        const result = await pool.request().query(`
            SELECT COUNT(*) AS count FROM user_recent_viewed_jobs WHERE user_id = '${userId}'
        `);

        if (result.recordset[0].count > 5) {
            await pool.request().query(`
                DELETE FROM user_recent_viewed_jobs
                WHERE id IN (
                    SELECT TOP 1 id FROM user_recent_viewed_jobs
                    WHERE user_id = '${userId}'
                    ORDER BY viewed_at ASC
                )
            `);
        }
    } catch (error) {
        console.error('Error adding viewed job:', error);
    }

    },
  
    /**
     * Get the most recent 5 viewed jobs for a user.
     * @param {string} userId - The ID of the user.
     * @returns {Promise<Array>} - An array of recent viewed jobs.
     */
    getRecentViewedJobs: async (userId) => {
        try {
        const result = await pool.request().query(`
            SELECT TOP 5 j.id, j.title, j.salary, j.applicants,j.location, j.description, j.company_id, j.postedDate, c.name AS company_name, c.logo as company_logo
            FROM user_recent_viewed_jobs AS uvj
            JOIN jobPostings AS j ON uvj.jobPostings_id = j.id
            JOIN companies AS c ON uvj.company_id = c.id
            WHERE uvj.user_id = '${userId}'
            ORDER BY uvj.viewed_at DESC
        `);
        return result.recordset;
        } catch (error) {
        console.error('Error getting recent viewed jobs:', error);
        return [];
        }
    },
  
    /**
     * Remove a specific viewed job for a user.
     * @param {string} userId - The ID of the user.
     * @param {number} jobId - The ID of the job posting to remove.
     * @returns {Promise<void>}
     */
    removeViewedJob: async (userId, jobId) => {
        try {
        await pool.request().query(`
            DELETE FROM user_recent_viewed_jobs
            WHERE user_id = '${userId}' AND jobPostings_id = ${jobId}
        `);
        } catch (error) {
        console.error('Error removing viewed job:', error);
        }
    },
  
    /**
     * Clear all recent viewed jobs for a user.
     * @param {string} userId - The ID of the user.
     * @returns {Promise<void>}
     */
    clearRecentViewedJobs: async (userId) => {
        try {
        await pool.request().query(`
            DELETE FROM user_recent_viewed_jobs
            WHERE user_id = '${userId}'
        `);
        } catch (error) {
        console.error('Error clearing recent viewed jobs:', error);
        }
    },
  
    /**
     * Check if a specific job is already in the user's recent views.
     * @param {string} userId - The ID of the user.
     * @param {number} jobId - The ID of the job posting.
     * @returns {Promise<boolean>} - Returns true if the job is in recent views, else false.
     */
    isJobInRecentViews: async (userId, jobId) => {
        try {
        const result = await pool.request().query(`
            SELECT COUNT(*) AS count
            FROM user_recent_viewed_jobs
            WHERE user_id = '${userId}' AND jobPostings_id = ${jobId}
        `);
        return result.recordset[0].count > 0;
        } catch (error) {
        console.error('Error checking if job is in recent views:', error);
        return false;

        }
    }
};

  

module.exports = userRecentQueries;