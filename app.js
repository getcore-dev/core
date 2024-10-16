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
const communityRoutes = require('./routes/communityRoutes');

const app = express();

// Wait for the pool to connect before setting up the rest of the app
poolConnect.then(() => {
  console.log('Connected to SQL Server successfully.');

  // Set up session store
  const store = new MSSQLStore(dbConfig, pool);

  // Set up view engine
  app.engine('ejs', ejsAsync.renderFile);
  app.set('view-engine', 'ejs');

  // Middleware setup
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(flash());
  app.use(express.static(path.join(__dirname, 'public')));
  app.set('trust proxy', 1);

  app.use(
    session({
      store: store,
      secret: environment.sessionSecret,
      resave: false,
      saveUninitialized: false,
    })
  );

  // Passport configuration
  passportConfig.initialize(passport);
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(methodOverride('_method'));

  // Custom middleware
  app.use((req, res, next) => {
    res.locals.currentPath = req.path;
    next();
  });

  // Routes
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

  // Flash messages middleware
  app.use((req, res, next) => {
    res.locals.error = req.flash('error');
    res.locals.success = req.flash('success');
    next();
  });

  // Error handling
  app.use(errorHandler);

  // Start the server
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
  }).on('error', (err) => {
    console.error('Failed to start server:', err);
  });

}).catch(err => {
  console.error('Failed to connect to SQL Server:', err);
  process.exit(1); // Exit the application if the pool connection fails
});

module.exports = app;