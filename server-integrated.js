const express = require('express');
const cors = require('cors');
const path = require('path');
const { chromium } = require('playwright');

const app = express();
const PORT = process.env.PORT || 3003;

// Enhanced CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://detach.app', 'exp://192.168.1.1:8081', 'exp://localhost:8081', /\.exp\.direct$/]
    : true,
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Integrated Playwright Downloader Class
 * Uses the working Playwright scripts directly in the backend
 */
class IntegratedPlaywrightDownloader {
  constructor() {
    this.browser = null;
    this.downloadTimeout = 45000;
    this.retryAttempts = 2;
  }

  async initialize() {
    if (!this.browser) {
      console.log('🚀 Initializing Playwright browser...');
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled'
        ]
      });
    }
    return this.browser;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  detectPlatform(url) {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('tiktok.com')) return 'tiktok';
    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'youtube';
    if (urlLower.includes('instagram.com')) return 'instagram';
    if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) return 'twitter';
    if (urlLower.includes('pinterest.com')) return 'pinterest';
    if (urlLower.includes('facebook.com')) return 'facebook';
    if (urlLower.includes('linkedin.com')) return 'linkedin';
    if (urlLower.includes('vimeo.com')) return 'vimeo';
    if (urlLower.includes('dailymotion.com')) return 'dailymotion';
    if (urlLower.includes('reddit.com')) return 'reddit';
    if (urlLower.includes('soundcloud.com')) return 'soundcloud';
    return 'unknown';
  }

  /**
   * TIER 1: GetLoady.com - Premium quality downloads
   */
  async downloadWithGetLoady(url, platform) {
    try {
      console.log(`🎯 Tier 1: GetLoady download for ${platform}`);
      
      const platformUrls = {
        'tiktok': 'https://getloady.com/tiktok',
        'instagram': 'https://getloady.com/instagram',
        'pinterest': 'https://getloady.com/pinterest',
        'reddit': 'https://getloady.com/reddit',
        'youtube': 'https://getloady.com/youtube',
        'twitter': 'https://getloady.com/twitter',
        'facebook': 'https://getloady.com/facebook'
      };

      if (!platformUrls[platform]) {
        throw new Error(`GetLoady doesn't support ${platform}`);
      }

      await this.initialize();
      const page = await this.browser.newPage();
      
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      console.log(`🌐 Navigating to ${platformUrls[platform]}`);
      await page.goto(platformUrls[platform], { waitUntil: 'networkidle' });

      // Wait for input field and paste URL
      const inputSelector = 'input[type="text"], input[placeholder*="URL"], input[placeholder*="url"], input[placeholder*="link"]';
      await page.waitForSelector(inputSelector, { timeout: 10000 });
      
      await page.fill(inputSelector, url);
      console.log(`📝 Pasted URL: ${url}`);

      // Find and click download button
      const downloadButtonSelectors = [
        'button:has-text("Download")',
        'button:has-text("Get")',
        'input[type="submit"]',
        'button[type="submit"]',
        '.download-btn',
        '#download-btn'
      ];

      let downloadButton = null;
      for (const selector of downloadButtonSelectors) {
        try {
          downloadButton = await page.waitForSelector(selector, { timeout: 2000 });
          if (downloadButton) break;
        } catch (e) {
          continue;
        }
      }

      if (!downloadButton) {
        throw new Error('Download button not found');
      }

      await downloadButton.click();
      console.log('🔄 Clicked download button');

      // Wait for download link to appear
      const downloadLinkSelector = 'a[href*="download"], a[href*=".mp4"], a[href*=".mp3"], a[download]';
      const downloadLink = await page.waitForSelector(downloadLinkSelector, { 
        timeout: this.downloadTimeout 
      });

      const downloadUrl = await downloadLink.getAttribute('href');
      
      await page.close();
      
      console.log('✅ GetLoady download successful');
      return {
        success: true,
        url: downloadUrl,
        source: 'getloady',
        tier: 1,
        tierInfo: 'Tier 1: GetLoady (Premium)',
        downloadMethod: 'Playwright automation'
      };

    } catch (error) {
      console.log(`❌ GetLoady failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        source: 'getloady',
        tier: 1
      };
    }
  }

  /**
   * TIER 2: SSVid.net - Reliable fallback
   */
  async downloadWithSSVid(url, platform) {
    try {
      console.log(`🎯 Tier 2: SSVid download for ${platform}`);
      
      await this.initialize();
      const page = await this.browser.newPage();
      
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      console.log('🌐 Navigating to ssvid.net');
      await page.goto('https://ssvid.net', { waitUntil: 'networkidle' });

      // Find input field and paste URL
      const inputSelector = '#url, input[name="url"], input[placeholder*="URL"], input[type="text"]';
      await page.waitForSelector(inputSelector, { timeout: 10000 });
      
      await page.fill(inputSelector, url);
      console.log(`📝 Pasted URL: ${url}`);

      // Click download button
      const submitButton = await page.waitForSelector('button[type="submit"], input[type="submit"], .btn-download', { timeout: 5000 });
      await submitButton.click();
      console.log('🔄 Clicked download button');

      // Wait for download options to appear
      await page.waitForTimeout(3000);

      // Look for download links
      const downloadLinks = await page.$$('a[href*="download"], a[href*=".mp4"], a[href*=".mp3"]');
      
      if (downloadLinks.length === 0) {
        throw new Error('No download links found');
      }

      const downloadUrl = await downloadLinks[0].getAttribute('href');
      
      await page.close();
      
      console.log('✅ SSVid download successful');
      return {
        success: true,
        url: downloadUrl,
        source: 'ssvid',
        tier: 2,
        tierInfo: 'Tier 2: SSVid (Reliable)',
        downloadMethod: 'Playwright automation'
      };

    } catch (error) {
      console.log(`❌ SSVid failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        source: 'ssvid',
        tier: 2
      };
    }
  }

  /**
   * TIER 3: Squidlr.com - Alternative option
   */
  async downloadWithSquidlr(url, platform) {
    try {
      console.log(`🎯 Tier 3: Squidlr download for ${platform}`);
      
      // Squidlr doesn't support all platforms
      const supportedPlatforms = ['youtube', 'tiktok', 'instagram', 'twitter'];
      if (!supportedPlatforms.includes(platform)) {
        throw new Error(`Squidlr doesn't support ${platform}`);
      }
      
      await this.initialize();
      const page = await this.browser.newPage();
      
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      console.log('🌐 Navigating to squidlr.com');
      await page.goto('https://squidlr.com', { waitUntil: 'networkidle' });

      // Find input field and paste URL
      const inputSelector = 'input[type="text"], input[placeholder*="URL"], textarea';
      await page.waitForSelector(inputSelector, { timeout: 10000 });
      
      await page.fill(inputSelector, url);
      console.log(`📝 Pasted URL: ${url}`);

      // Click download button
      const downloadButton = await page.waitForSelector('button:has-text("Download"), input[type="submit"]', { timeout: 5000 });
      await downloadButton.click();
      console.log('🔄 Clicked download button');

      // Wait for processing and download link
      await page.waitForTimeout(5000);

      const downloadLinks = await page.$$('a[href*="download"], a[download]');
      
      if (downloadLinks.length === 0) {
        throw new Error('No download links found');
      }

      const downloadUrl = await downloadLinks[0].getAttribute('href');
      
      await page.close();
      
      console.log('✅ Squidlr download successful');
      return {
        success: true,
        url: downloadUrl,
        source: 'squidlr',
        tier: 3,
        tierInfo: 'Tier 3: Squidlr (Alternative)',
        downloadMethod: 'Playwright automation'
      };

    } catch (error) {
      console.log(`❌ Squidlr failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        source: 'squidlr',
        tier: 3
      };
    }
  }

  /**
   * Main download method with tier fallback system
   */
  async download(url) {
    const platform = this.detectPlatform(url);
    console.log(`🎬 Starting download for ${platform}: ${url}`);

    const tierResults = [];
    
    // Try each tier in order
    const tiers = [
      () => this.downloadWithGetLoady(url, platform),
      () => this.downloadWithSSVid(url, platform),
      () => this.downloadWithSquidlr(url, platform)
    ];

    for (let i = 0; i < tiers.length; i++) {
      try {
        console.log(`🔄 Attempting Tier ${i + 1}...`);
        const result = await tiers[i]();
        tierResults.push(result);
        
        if (result.success) {
          console.log(`✅ Success with ${result.source}!`);
          return {
            success: true,
            url: result.url,
            platform: platform,
            tier: result.tier,
            source: result.source,
            tierInfo: result.tierInfo,
            downloadMethod: result.downloadMethod,
            metadata: {
              title: `Downloaded from ${platform}`,
              actualFormat: 'video'
            },
            allTiers: tierResults,
            timestamp: new Date().toISOString()
          };
        }
      } catch (error) {
        console.log(`❌ Tier ${i + 1} failed: ${error.message}`);
        tierResults.push({
          success: false,
          error: error.message,
          tier: i + 1,
          source: ['getloady', 'ssvid', 'squidlr'][i]
        });
      }
    }

    // All tiers failed
    console.log('❌ All tiers failed');
    return {
      success: false,
      error: 'All download methods failed',
      platform: platform,
      allTiers: tierResults,
      timestamp: new Date().toISOString()
    };
  }
}

// Global downloader instance
let downloader = null;

// Initialize downloader
async function getDownloader() {
  if (!downloader) {
    downloader = new IntegratedPlaywrightDownloader();
  }
  return downloader;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    tiers: [
      { tier: 1, source: 'getloady', status: 'active' },
      { tier: 2, source: 'ssvid', status: 'active' },
      { tier: 3, source: 'squidlr', status: 'active' }
    ]
  });
});

// Universal download endpoint
app.post('/download', async (req, res) => {
  const { url, format = 'video' } = req.body;

  if (!url) {
    return res.status(400).json({ 
      error: 'Missing URL parameter',
      message: 'Please provide a valid URL to download'
    });
  }

  try {
    console.log(`🚀 Processing download request: ${url}`);
    
    const downloaderInstance = await getDownloader();
    const result = await downloaderInstance.download(url);
    
    if (result.success) {
      console.log('✅ Download successful!');
      res.json(result);
    } else {
      console.log('❌ Download failed');
      res.status(500).json(result);
    }
    
  } catch (error) {
    console.error('❌ Server error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  if (downloader) {
    await downloader.cleanup();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  if (downloader) {
    await downloader.cleanup();
  }
  process.exit(0);
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Integrated Playwright Downloader Server running on port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`⬇️  Download endpoint: POST http://localhost:${PORT}/download`);
  console.log('🎯 Available tiers:');
  console.log('  1. GetLoady.com (Premium quality)');
  console.log('  2. SSVid.net (Reliable fallback)');
  console.log('  3. Squidlr.com (Alternative option)');
});

module.exports = app;
