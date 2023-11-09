const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 8080; // Use the environment's port if provided.

app.use(express.static(path.join(__dirname, 'public')));

// If you want to use a router for additional paths, you can include them here.
// For example, app.use('/api', apiRoutes);

// Catch-all for any request that doesn't match one above to send back `index.html`.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'core.html'));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
