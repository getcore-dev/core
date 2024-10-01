const Queue = require('bull');
const jobProcessor = require('../services/jobBoardService');

const jobExtractionQueue = new Queue('jobExtraction', {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  },
  limiter: {
    max: 10,
    duration: 1000
  }
});

jobExtractionQueue.process('extractJob', async (job) => {
  const { link } = job.data;
  job.progress(0);
  console.log(job);
  const extractedData = await jobProcessor.processJobLink(link);
  job.progress(100);
  return extractedData;
});

jobExtractionQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed with result:`, result);
});

jobExtractionQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed with error:`, err);
});

module.exports = {
  addJob: (jobData) => jobExtractionQueue.add('extractJob', jobData, { 
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }),
  getJobs: async (jobIds) => {
    return Promise.all(jobIds.map(id => jobExtractionQueue.getJob(id)));
  }
};
