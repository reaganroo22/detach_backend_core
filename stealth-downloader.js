const { addExtra } = require('playwright-extra');
const { chromium } = require('playwright');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Add stealth plugin to playwright
const stealthChromium = addExtra(chromium).use(StealthPlugin());

class StealthDownloader {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    this.browser = await stealthChromium.launch({
      headless: false, // Keep visible for testing
      channel: 'chrome',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-blink-features=AutomationControlled',
        '--disable-background-networking',
        '--enable-features=NetworkService,NetworkServiceLogging',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-field-trial-config',
        '--disable-hang-monitor',
        '--disable-ipc-flooding-protection',
        '--disable-popup-blocking',
        '--disable-prompt-on-repost',
        '--disable-sync',
        '--force-color-profile=srgb',
        '--metrics-recording-only',
        '--safebrowsing-disable-auto-update',
        '--enable-automation=false',
        '--password-store=basic',
        '--use-mock-keychain'
      ]
    });

    this.page = await this.browser.newPage();
    
    // Additional stealth measures
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'max-age=0',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    });

    // Set viewport to common resolution
    await this.page.setViewportSize({ width: 1366, height: 768 });

    // Override navigator properties
    await this.page.addInitScript(() => {
      // Override the plugins property to use a fake plugins array
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });

      // Override the languages property to remove headless indicators
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });

      // Override the webDriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });

      // Mock chrome object
      window.chrome = {
        runtime: {}
      };

      // Mock permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });
  }

  async downloadFromYouTube(url) {
    try {
      console.log(`Downloading YouTube video with stealth: ${url}`);
      
      // Set up download interception
      let downloadUrl = null;
      let downloadStarted = false;

      // Listen for download events
      this.page.on('download', async download => {
        downloadUrl = download.url();
        downloadStarted = true;
        console.log(`Download intercepted: ${downloadUrl}`);
        
        // Cancel the actual download to just get the URL
        await download.cancel();
      });

      // Also listen for navigation events (for direct video links)
      this.page.on('response', response => {
        const responseUrl = response.url();
        const contentType = response.headers()['content-type'] || '';
        
        // Check if this is a video file response
        if (contentType.includes('video/') || responseUrl.includes('.mp4') || responseUrl.includes('.webm')) {
          downloadUrl = responseUrl;
          downloadStarted = true;
          console.log(`Video URL intercepted: ${responseUrl}`);
        }
      });

      // Navigate with realistic delays
      await this.page.goto('https://getloady.com/youtube', { 
        waitUntil: 'networkidle',
        timeout: 60000
      });

      // Random delay to appear more human
      await this.page.waitForTimeout(Math.random() * 2000 + 1000);

      // Wait for and fill input field
      await this.page.waitForSelector('#youtube-url', { timeout: 10000 });
      
      // Human-like typing
      await this.page.type('#youtube-url', url, { delay: Math.random() * 100 + 50 });
      
      // Random delay before clicking
      await this.page.waitForTimeout(Math.random() * 1000 + 500);

      // Click the button
      console.log('Clicking download button...');
      await this.page.click('button:has-text("Get YouTube Video Link")');

      // Wait for download to start or links to appear
      console.log('Waiting for download or video links...');
      
      // Check multiple approaches
      for (let i = 0; i < 15; i++) {
        // Check if download was intercepted
        if (downloadStarted && downloadUrl) {
          console.log(`Success! Got download URL: ${downloadUrl}`);
          return {
            success: true,
            downloadUrl: downloadUrl,
            platform: 'youtube',
            method: 'intercepted'
          };
        }

        // Check for direct video links in new tabs
        try {
          const context = this.browser.contexts()[0];
          const pages = context.pages();
          for (const page of pages) {
            const pageUrl = page.url();
            if (pageUrl.includes('.mp4') || pageUrl.includes('.webm') || pageUrl.includes('video')) {
              console.log(`Video page found: ${pageUrl}`);
              return {
                success: true,
                downloadUrl: pageUrl,
                platform: 'youtube',
                method: 'new_tab'
              };
            }
          }
        } catch (e) {
          // Skip if pages not available
        }

        // Check for download links in DOM (be more specific)
        const downloadLinks = await this.page.$$('a[href*="download"], a[href*=".mp4"], a[download], a[href^="blob:"]');
        
        if (downloadLinks.length > 0) {
          for (const link of downloadLinks) {
            const href = await link.getAttribute('href');
            const download = await link.getAttribute('download');
            
            // Only accept actual video/download links
            if (href && (
              href.includes('.mp4') || 
              href.includes('.webm') || 
              href.includes('blob:') || 
              download || 
              href.includes('download') && !href.includes('ko-fi') && !href.includes('donation')
            )) {
              console.log(`Valid download link found: ${href}`);
              return {
                success: true,
                downloadUrl: href,
                platform: 'youtube',
                method: 'dom_link'
              };
            }
          }
        }

        // Also check for any new popups or tabs that might have opened
        try {
          const allPages = await this.page.context().pages();
          for (const currentPage of allPages) {
            if (currentPage !== this.page) {
              const pageUrl = currentPage.url();
              console.log(`Checking page: ${pageUrl}`);
              
              if (pageUrl.includes('.mp4') || pageUrl.includes('.webm') || pageUrl.includes('googlevideo') || pageUrl.includes('ytimg')) {
                console.log(`Video URL found in new page: ${pageUrl}`);
                return {
                  success: true,
                  downloadUrl: pageUrl,
                  platform: 'youtube',
                  method: 'popup_page'
                };
              }
            }
          }
        } catch (e) {
          // Skip if context not available
        }
        
        // Wait before next check
        await this.page.waitForTimeout(2000);
        console.log(`Attempt ${i + 1}: Checking for downloads...`);
      }

      throw new Error(`No download detected after 30 seconds`);

    } catch (error) {
      console.error('Error downloading from YouTube:', error);
      return {
        success: false,
        error: error.message,
        platform: 'youtube'
      };
    }
  }

  async downloadFromTikTok(url) {
    try {
      console.log(`Downloading TikTok video with stealth: ${url}`);
      return await this.downloadFromPlatform(url, 'https://getloady.com/tiktok', 'tiktok');
    } catch (error) {
      console.error('Error downloading from TikTok:', error);
      return { success: false, error: error.message, platform: 'tiktok' };
    }
  }

  async downloadFromInstagram(url) {
    try {
      console.log(`Downloading Instagram content with stealth: ${url}`);
      return await this.downloadFromPlatform(url, 'https://getloady.com/instagram', 'instagram');
    } catch (error) {
      console.error('Error downloading from Instagram:', error);
      return { success: false, error: error.message, platform: 'instagram' };
    }
  }

  async downloadFromTwitter(url) {
    try {
      console.log(`Downloading Twitter content with stealth: ${url}`);
      return await this.downloadFromPlatform(url, 'https://getloady.com/twitter', 'twitter');
    } catch (error) {
      console.error('Error downloading from Twitter:', error);
      return { success: false, error: error.message, platform: 'twitter' };
    }
  }

  async downloadFromPinterest(url) {
    try {
      console.log(`Downloading Pinterest content with stealth: ${url}`);
      return await this.downloadFromPlatform(url, 'https://getloady.com/pinterest', 'pinterest');
    } catch (error) {
      console.error('Error downloading from Pinterest:', error);
      return { success: false, error: error.message, platform: 'pinterest' };
    }
  }

  async downloadFromPlatform(url, platformUrl, platformName) {
    // Set up download interception
    let downloadUrl = null;
    let downloadStarted = false;

    // Listen for download events
    this.page.on('download', async download => {
      downloadUrl = download.url();
      downloadStarted = true;
      console.log(`${platformName} download intercepted: ${downloadUrl}`);
      await download.cancel();
    });

    // Listen for video responses
    this.page.on('response', response => {
      const responseUrl = response.url();
      const contentType = response.headers()['content-type'] || '';
      
      if (contentType.includes('video/') || responseUrl.includes('.mp4') || responseUrl.includes('.webm')) {
        downloadUrl = responseUrl;
        downloadStarted = true;
        console.log(`${platformName} video URL intercepted: ${responseUrl}`);
      }
    });

    // Navigate to platform
    await this.page.goto(platformUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await this.page.waitForTimeout(Math.random() * 2000 + 1000);

    // Find and fill input field
    const inputSelectors = ['input[type="text"]', 'input[type="url"]', 'input[placeholder*="URL"]', '#url-input'];
    let inputFilled = false;
    
    for (const selector of inputSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 5000 });
        await this.page.type(selector, url, { delay: Math.random() * 100 + 50 });
        inputFilled = true;
        break;
      } catch (e) {
        continue;
      }
    }

    if (!inputFilled) {
      throw new Error(`Could not find input field on ${platformName}`);
    }

    await this.page.waitForTimeout(Math.random() * 1000 + 500);

    // Find and click download button
    const buttonSelectors = [
      'button:has-text("Download")',
      'button:has-text("Get")', 
      'input[type="submit"]',
      'button[type="submit"]',
      `button:has-text("Get ${platformName}")`
    ];
    
    let buttonClicked = false;
    for (const selector of buttonSelectors) {
      try {
        await this.page.click(selector, { timeout: 3000 });
        buttonClicked = true;
        break;
      } catch (e) {
        continue;
      }
    }

    if (!buttonClicked) {
      throw new Error(`Could not find download button on ${platformName}`);
    }

    console.log(`${platformName}: Waiting for download...`);

    // Check for downloads with multiple methods
    for (let i = 0; i < 15; i++) {
      if (downloadStarted && downloadUrl) {
        return {
          success: true,
          downloadUrl: downloadUrl,
          platform: platformName,
          method: 'intercepted'
        };
      }

      // Check DOM for download links
      const downloadLinks = await this.page.$$('a[href*="download"], a[href*=".mp4"], a[download], a[href^="blob:"]');
      
      for (const link of downloadLinks) {
        const href = await link.getAttribute('href');
        const download = await link.getAttribute('download');
        
        if (href && (
          href.includes('.mp4') || 
          href.includes('.webm') || 
          href.includes('blob:') || 
          download ||
          (href.includes('download') && !href.includes('ko-fi'))
        )) {
          return {
            success: true,
            downloadUrl: href,
            platform: platformName,
            method: 'dom_link'
          };
        }
      }

      // Check for new tabs/popups
      try {
        const allPages = await this.page.context().pages();
        for (const currentPage of allPages) {
          if (currentPage !== this.page) {
            const pageUrl = currentPage.url();
            if (pageUrl.includes('.mp4') || pageUrl.includes('.webm') || pageUrl.includes('video')) {
              return {
                success: true,
                downloadUrl: pageUrl,
                platform: platformName,
                method: 'popup_page'
              };
            }
          }
        }
      } catch (e) {
        // Skip if context not available
      }
      
      await this.page.waitForTimeout(2000);
      console.log(`${platformName} attempt ${i + 1}/15...`);
    }

    throw new Error(`${platformName}: No download detected after 30 seconds`);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Test function
async function testStealth() {
  const downloader = new StealthDownloader();
  
  try {
    await downloader.initialize();
    const result = await downloader.downloadFromYouTube('https://www.youtube.com/shorts/0Pwt8wcSjmY');
    console.log('Final Result:', result);
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await downloader.close();
  }
}

if (require.main === module) {
  testStealth();
}

module.exports = StealthDownloader;