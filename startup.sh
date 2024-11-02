#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Start the Node.js server immediately
pm2 start server.js

# Run the dependency installation in the background
bash install-dependencies.sh &

# Keep the process running and show logs
pm2 logs