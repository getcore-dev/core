const sql = require('mssql');

const userRecentQueries = {
    isJobInRecentViews: async (jobId, userId) => {
        try {
            const result = await sql.query`
                SELECT * FROM user_recent_viewed_jobs
                WHERE user_id = ${userId} AND jobPostings_id = ${jobId}`;
            return result.recordset.length > 0;
        } catch (err) {
            console.error('Database query error:', err);
            throw err;
        }
    },

    getRecentViews: async (userId) => {
        try {
            const result = await sql.query`
                SELECT urvj.* , jp.title, jp.description, jp.salary, jp.location, jp.postedDate, jp.applicants,
                c.name as company_name, 
                c.logo as company_logo
                FROM user_recent_viewed_jobs urvj
                JOIN companies c ON urvj.company_id = c.id
                JOIN jobPostings jp ON urvj.jobPostings_id = jp.id
                WHERE urvj.user_id = ${userId}
                ORDER BY urvj.viewed_at DESC`;
            return result.recordset;
        } catch (err) {
            console.error('Database query error:', err);
            throw err;
        }
    },

    addViewedJob: async (jobId, companyId, userId) => {
        try {
            await sql.query`
                INSERT INTO user_recent_viewed_jobs (jobPostings_id, company_id, user_id, created_at)
                VALUES (${jobId}, ${companyId}, ${userId}, GETDATE())`;
        } catch (err) {
            console.error('Database query error:', err);
            throw err;
        }
    },
}

module.exports = userRecentQueries;