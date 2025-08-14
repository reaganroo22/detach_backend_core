const { chromium } = require('playwright');

class GetloadyDownloader {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    this.browser = await chromium.launch({ 
      headless: false,  // Use visible browser for testing
      channel: 'chrome', // Use Chrome instead of Chromium
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    this.page = await this.browser.newPage();
    
    // Set user agent to look more like a real browser
    await this.page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
  }

  async downloadFromTikTok(url) {
    try {
      console.log(`Downloading TikTok video: ${url}`);
      
      // Go directly to TikTok downloader page
      await this.page.goto('https://getloady.com/tiktok', { waitUntil: 'networkidle' });
      
      // Wait for input field and fill it
      await this.page.waitForSelector('#youtube-url, input[type="text"], input[type="url"], input[placeholder*="URL"]', { timeout: 10000 });
      await this.page.fill('#youtube-url, input[type="text"], input[type="url"], input[placeholder*="URL"]', url);
      
      // Click download button (YouTube uses "Get YouTube Video Link")
      await this.page.click('button:has-text("Get YouTube Video Link"), button:has-text("Download"), input[type="submit"], button[type="submit"]');
      
      // Wait for processing to complete (look for success message or progress indicators)
      try {
        await this.page.waitForSelector('div:has-text("Success"), div:has-text("Download"), div:has-text("Ready")', { 
          timeout: 10000 
        });
      } catch (e) {
        // Continue if no success message found
      }
      
      // Wait a bit for download link generation
      await this.page.waitForTimeout(3000);
      
      // Wait for download link to appear (including hidden ones)
      await this.page.waitForSelector('a[href*="download"], a[href*=".mp4"], a[href*=".mov"], a[download], a[href^="blob:"]', { 
        timeout: 30000,
        state: 'attached'  // Wait for element to exist, not necessarily visible
      });
      
      // Extract download URL (including blob URLs)
      const downloadLink = await this.page.getAttribute('a[href*="download"], a[href*=".mp4"], a[href*=".mov"], a[download], a[href^="blob:"]', 'href');
      
      if (downloadLink) {
        console.log(`Download link found: ${downloadLink}`);
        return {
          success: true,
          downloadUrl: downloadLink,
          platform: 'tiktok'
        };
      } else {
        throw new Error('No download link found');
      }
      
    } catch (error) {
      console.error('Error downloading from TikTok:', error);
      return {
        success: false,
        error: error.message,
        platform: 'tiktok'
      };
    }
  }

  async downloadFromInstagram(url) {
    try {
      console.log(`Downloading Instagram content: ${url}`);
      
      await this.page.goto('https://getloady.com/instagram', { waitUntil: 'networkidle' });
      await this.page.waitForSelector('input[type="text"], input[type="url"], input[placeholder*="URL"]');
      await this.page.fill('input[type="text"], input[type="url"], input[placeholder*="URL"]', url);
      await this.page.click('button:has-text("Download"), input[type="submit"], button[type="submit"]');
      
      await this.page.waitForSelector('a[href*="download"], a[href*=".mp4"], a[href*=".jpg"], a[download], a[href^="blob:"]', { 
        timeout: 30000,
        state: 'attached'
      });
      
      const downloadLink = await this.page.getAttribute('a[href*="download"], a[href*=".mp4"], a[href*=".jpg"], a[download], a[href^="blob:"]', 'href');
      
      return {
        success: true,
        downloadUrl: downloadLink,
        platform: 'instagram'
      };
      
    } catch (error) {
      console.error('Error downloading from Instagram:', error);
      return {
        success: false,
        error: error.message,
        platform: 'instagram'
      };
    }
  }

  async downloadFromYouTube(url) {
    try {
      console.log(`Downloading YouTube video: ${url}`);
      
      await this.page.goto('https://getloady.com/youtube', { waitUntil: 'networkidle' });
      await this.page.waitForSelector('#youtube-url, input[type="text"], input[type="url"], input[placeholder*="URL"]');
      await this.page.fill('#youtube-url, input[type="text"], input[type="url"], input[placeholder*="URL"]', url);
      await this.page.click('button:has-text("Get YouTube Video Link"), button:has-text("Download"), input[type="submit"], button[type="submit"]');
      
      await this.page.waitForSelector('a[href*="download"], a[href*=".mp4"], a[download], a[href^="blob:"]', { 
        timeout: 30000,
        state: 'attached'
      });
      
      const downloadLink = await this.page.getAttribute('a[href*="download"], a[href*=".mp4"], a[download], a[href^="blob:"]', 'href');
      
      return {
        success: true,
        downloadUrl: downloadLink,
        platform: 'youtube'
      };
      
    } catch (error) {
      console.error('Error downloading from YouTube:', error);
      return {
        success: false,
        error: error.message,
        platform: 'youtube'
      };
    }
  }

  async downloadFromPinterest(url) {
    try {
      console.log(`Downloading Pinterest content: ${url}`);
      
      await this.page.goto('https://getloady.com/pinterest', { waitUntil: 'networkidle' });
      await this.page.waitForSelector('input[type="text"], input[type="url"], input[placeholder*="URL"]');
      await this.page.fill('input[type="text"], input[type="url"], input[placeholder*="URL"]', url);
      await this.page.click('button:has-text("Download"), input[type="submit"], button[type="submit"]');
      
      await this.page.waitForSelector('a[href*="download"], a[href*=".mp4"], a[href*=".jpg"], a[download], a[href^="blob:"]', { 
        timeout: 30000,
        state: 'attached'
      });
      
      const downloadLink = await this.page.getAttribute('a[href*="download"], a[href*=".mp4"], a[href*=".jpg"], a[download], a[href^="blob:"]', 'href');
      
      return {
        success: true,
        downloadUrl: downloadLink,
        platform: 'pinterest'
      };
      
    } catch (error) {
      console.error('Error downloading from Pinterest:', error);
      return {
        success: false,
        error: error.message,
        platform: 'pinterest'
      };
    }
  }

  async downloadFromTwitter(url) {
    try {
      console.log(`Downloading Twitter/X content: ${url}`);
      
      await this.page.goto('https://getloady.com/twitter', { waitUntil: 'networkidle' });
      await this.page.waitForSelector('input[type="text"], input[type="url"], input[placeholder*="URL"]');
      await this.page.fill('input[type="text"], input[type="url"], input[placeholder*="URL"]', url);
      await this.page.click('button:has-text("Download"), input[type="submit"], button[type="submit"]');
      
      await this.page.waitForSelector('a[href*="download"], a[href*=".mp4"], a[download], a[href^="blob:"]', { 
        timeout: 30000,
        state: 'attached'
      });
      
      const downloadLink = await this.page.getAttribute('a[href*="download"], a[href*=".mp4"], a[download], a[href^="blob:"]', 'href');
      
      return {
        success: true,
        downloadUrl: downloadLink,
        platform: 'twitter'
      };
      
    } catch (error) {
      console.error('Error downloading from Twitter:', error);
      return {
        success: false,
        error: error.message,
        platform: 'twitter'
      };
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  // Universal download function that detects platform
  async download(url) {
    if (!this.browser) {
      await this.initialize();
    }

    // Platform detection
    if (url.includes('tiktok.com')) {
      return await this.downloadFromTikTok(url);
    } else if (url.includes('instagram.com')) {
      return await this.downloadFromInstagram(url);
    } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return await this.downloadFromYouTube(url);
    } else if (url.includes('pinterest.com')) {
      return await this.downloadFromPinterest(url);
    } else if (url.includes('twitter.com') || url.includes('x.com')) {
      return await this.downloadFromTwitter(url);
    } else {
      return {
        success: false,
        error: 'Unsupported platform',
        platform: 'unknown'
      };
    }
  }
}

module.exports = GetloadyDownloader;

// Test function
async function test() {
  const downloader = new GetloadyDownloader();
  
  try {
    const result = await downloader.download('https://www.youtube.com/shorts/0Pwt8wcSjmY');
    console.log('Result:', result);
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await downloader.close();
  }
}

// Run test if called directly
if (require.main === module) {
  test();
}