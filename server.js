const app = require('./app');
const environment = require('./config/environment');
const JobProcessor = require('./services/jobBoardService');
const jobProcessor = new JobProcessor();
const MS_PER_HOUR = 3600000;

async function runJobBoardService() {
  console.log('Job board service started');
  try {
    await jobProcessor.start();
    console.log('Job board service completed successfully');
  } catch (error) {
    console.error('Error running job board service:', error);
  }
  scheduleNextRun();
}

function scheduleNextRun() {
  const delayHours = 12 + Math.random() * 6; // Random delay between 12 and 18 hours
  const delayMs = delayHours * MS_PER_HOUR;
  console.log(`Next job board service run scheduled in ${delayHours.toFixed(2)} hours`);
  setTimeout(runJobBoardService, delayMs);
}

// Start the server
app.listen(environment.port, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${environment.port}`);
  // Schedule the first run of the job board service
  setTimeout(() => {
    runJobBoardService();
   }, 5000); // Wait 5 seconds after server start before first run
});