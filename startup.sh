#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "Installing Chrome dependencies..."

# Update package lists
apt-get update

# Install dependencies required by Chrome
apt-get install -y wget gnupg ca-certificates fonts-liberation libappindicator3-1 libasound2 \
    libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 \
    libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 \
    libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 \
    libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 \
    lsb-release xdg-utils

apt-get install -y libnss3 libglib2.0-0 libx11-6 libx11-xcb1 libxcb1 \
      libxcomposite1 libxcursor1 libxdamage1 libxext6 libxi6 libxrandr2 \
      libxrender1 libxss1 libxtst6 libatk1.0-0 libatk-bridge2.0-0 libgtk-3-0

# Install Google Chrome
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
apt install -y ./google-chrome-stable_current_amd64.deb || apt-get install -f -y
rm google-chrome-stable_current_amd64.deb

echo "Chrome dependencies installed."

# Start the Node.js server
npm start
