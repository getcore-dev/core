const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const app = require('./app');
const environment = require('./config/environment');
const JobProcessor = require('./services/jobBoardService');
const jobProcessor = new JobProcessor();
const MS_PER_HOUR = 3600000;

let currentProgress = {};

jobProcessor.on('progress', (progress) => {
  currentProgress = progress;
});

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

// Add a new route to view the progress
app.get('/job-processing-progress', (req, res) => {
  if (!req.user) {
    return res.redirect('/login');
  }
  if (!req.user.isAdmin) {
    return res.status(403).redirect('/');
  }
  res.render('progress', { progress: currentProgress });
});

// Add a new route to get the progress as JSON (for AJAX requests)
app.get('/api/job-processing-progress', (req, res) => {
  if (!req.user) {
    return res.redirect('/login');
  }
  if (!req.user.isAdmin) {
    return res.status(403).redirect('/');
  }
  res.json(currentProgress);
});

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  // Fork workers.
  for (let i = 0; i < numCPUs; i++) {
    console.log(`Forking worker ${i}`);
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
    cluster.fork(); // Replace the dead worker
  });

  if (process.env.NODE_ENV !== 'development') {
    setTimeout(() => {
      runJobBoardService();
    }, 5000);
  }
} else {
  // Workers can share any TCP connection
  // In this case it is an HTTP server
  app.listen(environment.port, () => {
    console.log(`Worker ${process.pid} started and running on http://localhost:${environment.port}`);
  });
}