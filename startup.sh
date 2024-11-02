#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Start the Node.js server
pm2 start server.js --no-daemon &

echo "Installing Chrome dependencies..."

# Update package lists and install dependencies in the background
(
    apt-get update -qq  # Make apt-get quieter and faster
    # Install only the essential dependencies for Puppeteer
    apt-get install -y --no-install-recommends \
        chromium \
        chromium-common \
        fonts-liberation \
        libasound2 \
        libgbm1 \
        libnss3 \
        libxss1 \
        xdg-utils
    echo "Chrome dependencies installed."
) &

# Wait for background processes to finish
wait
