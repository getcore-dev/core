const express = require('express');
const path = require('path');
const passport = require('passport');
const flash = require('express-flash');
const session = require('express-session');
const methodOverride = require('method-override');
const ejsAsync = require('ejs-async');
const MSSQLStore = require('connect-mssql-v2');
const environment = require('./config/environment');
const dbConfig = require('./config/dbConfig');
const passportConfig = require('./config/passportConfig');
const errorHandler = require('./middleware/errorHandling');
const { pool, poolConnect } = require('./db');

// Import your route files
const authRoutes = require('./routes/authRoutes');
const jobRoutes = require('./routes/jobRoutes');
const adminRoutes = require('./routes/adminRoutes');
const searchRoutes = require('./routes/searchRoutes');
const postRoutes = require('./routes/postRoutes');
const commentRoutes = require('./routes/commentRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const apiRoutes = require('./routes/apiRoutes');
const generalRoutes = require('./routes/generalRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const rateLimit = require('express-rate-limit');
const communityRoutes = require('./routes/communityRoutes');
const userQueries = require('./queries/userQueries');
const viewLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 3,
  handler: (req, res, next) => {
    req.rateLimit = {
      exceeded: true,
    };
    next();
  },
  keyGenerator: (req) => `${req.ip}_${req.params.jobId}`,
  skip: (req) => {
    if (!req.rateLimit || !req.rateLimit.resetTime) {
      return false; // Don't skip if rateLimit or resetTime is not set
    }
    const eightHoursAgo = Date.now() - 8 * 60 * 60 * 1000;
    return req.rateLimit.resetTime < eightHoursAgo;
  },
});

const app = express();

// Set up view engine
app.engine('ejs', ejsAsync.renderFile);
app.set('view-engine', 'ejs');

// Basic middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', 1);
app.use(methodOverride('_method'));

// Custom middleware
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  next();
});


// Export a function that sets up the app with a connected database
module.exports = async function setupApp() {
  try {
    await poolConnect;
    console.log('Connected to SQL Server successfully.');

    // Set up session store
    const store = new MSSQLStore(dbConfig, pool);

    // Set up session middleware
    app.use(
      session({
        store: store,
        secret: environment.sessionSecret,
        resave: false,
        saveUninitialized: false,
      })
    );

    // Set up flash middleware after session
    app.use(flash());

    // Passport configuration
    passportConfig.initialize(passport,
      userQueries.findByEmail,
      userQueries.findById,
      userQueries.findByUsername,
      userQueries.findByGitHubUsername,
      userQueries.findByGithubId,
      userQueries.updateGitHubId,
      userQueries.updateUserGitHubAccessToken,
      userQueries.updateGitHubUsername,
      userQueries.createUserFromGitHubProfile,
      userQueries.getUserByGoogleId,
      userQueries.createUserFromGoogleProfile);
    app.use(passport.initialize());
    app.use(passport.session());

    app.use(viewLimiter);

    // Flash messages middleware
    app.use((req, res, next) => {
      res.locals.error = req.flash('error');
      res.locals.success = req.flash('success');
      next();
    });
    

    // Set up routes
    app.use(authRoutes);
    app.use(postRoutes);
    app.use(commentRoutes);
    app.use('/admin', adminRoutes);
    app.use('/search', searchRoutes);
    app.use('/jobs', jobRoutes);
    app.use('/api', apiRoutes);
    app.use('/notifications', notificationRoutes);
    app.use('/favorites', favoriteRoutes);
    app.use('/networks', communityRoutes);
    app.use(generalRoutes);

    // Error handling should be the last middleware
    app.use(errorHandler);

    return app;
  } catch (err) {
    console.error('Failed to connect to SQL Server:', err);
    throw err;
  }
  
};