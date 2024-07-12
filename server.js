const app = require('./app');
const environment = require('./config/environment');
const cluster = require('cluster');
const JobProcessor = require('./services/jobBoardService');
const jobProcessor = new JobProcessor();

const MS_PER_HOUR = 3600000;

function runJobBoardService() {
  console.log('Job board service started');
  jobProcessor
    .start()
    .then(() => {
      console.log('Job board service completed successfully');
    })
    .catch((error) => {
      console.error('Error running job board service:', error);
    })
    .finally(() => {
      scheduleNextRun();
    });
}

function scheduleNextRun() {
  const delayHours = 12 + Math.random() * 6;
  const delayMs = delayHours * MS_PER_HOUR;

  console.log(
    `Next job board service run scheduled in ${delayHours.toFixed(2)} hours`
  );

  setTimeout(runJobBoardService, delayMs);
}

app.listen(environment.port, () => {
  console.log(
    `Worker ${
      cluster.worker ? cluster.worker.id : 'Master'
    } running on http://localhost:${environment.port}`
  );
  setTimeout(runJobBoardService, 1500);
});
