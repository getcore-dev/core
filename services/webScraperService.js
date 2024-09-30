const axios = require('axios');
const https = require('https');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

class WebScraper {
  constructor() {
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
    ];
    this.proxyList = [
      'http://proxy1.com:8080',
      'http://proxy2.com:8080',
      // Add more proxies here
    ];
  }

  async getPublicProxies() {
    try {
      const response = await axios.get('https://free-proxy-list.net/');
      const proxyList = response.data.match(/\d+\.\d+\.\d+\.\d+:\d+/g);
      return proxyList || [];
    } catch (error) {
      console.error('Failed to fetch proxy list:', error);
      return [];
    }
  }

  async makeRequest(url, retries = 1, useJavaScript = false) {
    for (let i = 0; i < retries; i++) {
      try {
        if (useJavaScript) {
          return await this.scrapeWithPuppeteer(url);
        } else {
          const proxy = this.getPublicProxies()[Math.floor(Math.random() * this.proxyList.length)];
          const response = await axios.get(url, {
            headers: {
              'User-Agent': this.userAgents[Math.floor(Math.random() * this.userAgents.length)],
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
              'Accept-Encoding': 'gzip, deflate, br',
              'DNT': '1',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1',
              'Referer': url, // Randomized or related referer can help avoid detection
              'Origin': url.split('/')[0] // Same-origin strategy for requests
            },
            proxy: {
              host: proxy.split(':')[1].replace('//', ''),
              port: parseInt(proxy.split(':')[2])
            },
            httpsAgent: new https.Agent({
              rejectUnauthorized: false
            }),
            maxRedirects: 5,
            validateStatus: function (status) {
              return status >= 200 && status < 300;
            },
          });

          console.log(`Successfully retrieved data from ${url}`);
          return response.data;
        }
      } catch (error) {
        console.error(`Attempt ${i + 1} failed:`, error.message);
        if (i === retries - 1) throw error;
        await this.delay(10000 * (i + 1)); // Exponential backoff
      }
    }
  }

  async scrapeWithPuppeteer(url) {
    const browser = await puppeteer.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setUserAgent(this.userAgents[Math.floor(Math.random() * this.userAgents.length)]);
      await page.goto(url, { waitUntil: 'networkidle2' });
      
      // Optional: Interact with page, e.g., scrolling, clicking buttons
      const content = await page.content();
      console.log(`Successfully retrieved data from ${url} with JavaScript enabled.`);
      return content;
    } catch (error) {
      console.error(`Puppeteer scraping failed: ${error.message}`);
      throw error;
    } finally {
      await browser.close();
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = WebScraper;
