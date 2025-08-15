/**
 * Enhanced Universal Video Downloader
 * Based on comprehensive Playwright MCP testing of ssvid.net, squidlr.com, and getloady.com
 * 
 * PLATFORM SUPPORT MATRIX:
 * 
 * SSVid.net (15 platforms):
 * - YouTube (+ MP3/MP4 conversion)
 * - Instagram, TikTok, Twitter, Facebook, LinkedIn
 * - Vimeo, SoundCloud, Dailymotion, Reddit, Pinterest
 * - 9Gag, Kwai, Likee
 * 
 * Squidlr.com (6 platforms):
 * - X/Twitter, Instagram, Facebook, TikTok, LinkedIn
 * - Special: TikTok without watermarks
 * 
 * GetLoady.com (7 platforms):  
 * - TikTok, Instagram, Pinterest, Reddit, YouTube, X/Twitter, Facebook
 * - Special: HD quality, no watermarks
 */

const { chromium } = require('playwright');

class EnhancedUniversalDownloader {
  constructor() {
    this.browser = null;
    this.page = null;
    this.downloadTimeout = 30000; // 30 seconds
  }

  async initialize() {
    this.browser = await chromium.launch({
      headless: false,
      channel: 'chrome',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    });

    this.page = await this.browser.newPage();
    
    // Set realistic user agent and headers
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8'
    });

    await this.page.setViewportSize({ width: 1366, height: 768 });
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

  async setupDownloadInterception() {
    let downloadUrl = null;
    let downloadStarted = false;

    // Listen for download events
    this.page.on('download', async download => {
      downloadUrl = download.url();
      downloadStarted = true;
      console.log(`Download intercepted: ${downloadUrl}`);
      await download.cancel(); // Just capture the URL
    });

    // Listen for video responses
    this.page.on('response', response => {
      const responseUrl = response.url();
      const contentType = response.headers()['content-type'] || '';
      
      if (contentType.includes('video/') || 
          responseUrl.includes('.mp4') || 
          responseUrl.includes('.webm') ||
          responseUrl.includes('.m4v')) {
        downloadUrl = responseUrl;
        downloadStarted = true;
        console.log(`Video URL intercepted: ${responseUrl}`);
      }
    });

    return { getDownloadUrl: () => downloadUrl, isDownloadStarted: () => downloadStarted };
  }

  /**
   * TIER 1: GetLoady.com - Highest quality, HD downloads
   */
  async downloadWithGetLoady(url, platform) {
    try {
      console.log(`🎯 Tier 1: GetLoady download for ${platform}`);
      
      const { getDownloadUrl, isDownloadStarted } = await this.setupDownloadInterception();
      
      // GetLoady platform mapping
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

      await this.page.goto(platformUrls[platform], { waitUntil: 'networkidle' });
      
      // Close any modal dialogs
      try {
        await this.page.waitForSelector('button:has-text("Close")', { timeout: 3000 });
        await this.page.click('button:has-text("Close")');
        await this.page.waitForTimeout(1000);
      } catch (e) {
        // No modal to close
      }

      // Find and fill input field based on platform
      const inputSelectors = [
        `input[name*="${platform}"]`,
        'input[type="text"]',
        'input[type="url"]',
        'textbox'
      ];

      let inputFilled = false;
      for (const selector of inputSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          await this.page.fill(selector, url);
          inputFilled = true;
          console.log(`Input filled with selector: ${selector}`);
          break;
        } catch (e) {
          continue;
        }
      }

      if (!inputFilled) {
        throw new Error(`Could not find input field for ${platform} on GetLoady`);
      }

      await this.page.waitForTimeout(1000);

      // Click download button
      const buttonTexts = [
        'Download Video',
        'Download Video or Image', 
        'Get YouTube Video Link',
        'Download',
        'Get'
      ];

      let buttonClicked = false;
      for (const text of buttonTexts) {
        try {
          await this.page.click(`button:has-text("${text}")`, { timeout: 3000 });
          buttonClicked = true;
          console.log(`Button clicked: ${text}`);
          break;
        } catch (e) {
          continue;
        }
      }

      if (!buttonClicked) {
        throw new Error(`Could not find download button for ${platform} on GetLoady`);
      }

      // Wait for download with enhanced detection
      for (let i = 0; i < 15; i++) {
        if (isDownloadStarted() && getDownloadUrl()) {
          return {
            success: true,
            downloadUrl: getDownloadUrl(),
            platform: platform,
            method: 'getloady_intercepted',
            quality: 'HD'
          };
        }

        // Check for download links in DOM
        const downloadLinks = await this.page.$$('a[href*="download"], a[href*=".mp4"], a[download], a[href^="blob:"]');
        for (const link of downloadLinks) {
          const href = await link.getAttribute('href');
          if (href && this.isValidVideoUrl(href)) {
            return {
              success: true,
              downloadUrl: href,
              platform: platform,
              method: 'getloady_dom',
              quality: 'HD'
            };
          }
        }

        // Check for new tabs (YouTube specific)
        if (platform === 'youtube') {
          const pages = await this.page.context().pages();
          for (const page of pages) {
            const pageUrl = page.url();
            if (this.isValidVideoUrl(pageUrl)) {
              return {
                success: true,
                downloadUrl: pageUrl,
                platform: platform,
                method: 'getloady_newtab',
                quality: 'HD'
              };
            }
          }
        }

        await this.page.waitForTimeout(2000);
        console.log(`GetLoady attempt ${i + 1}/15...`);
      }

      throw new Error('GetLoady: No download found after 30 seconds');

    } catch (error) {
      console.log(`❌ GetLoady failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * TIER 2: SSVid.net - Widest platform support (15 platforms)
   */
  async downloadWithSSVid(url, platform) {
    try {
      console.log(`🎯 Tier 2: SSVid download for ${platform}`);
      
      const { getDownloadUrl, isDownloadStarted } = await this.setupDownloadInterception();
      
      await this.page.goto('https://ssvid.net/en', { waitUntil: 'networkidle' });
      
      // Wait for search input - SSVid uses a search input with role="searchbox"
      await this.page.waitForSelector('input[role="searchbox"]', { timeout: 10000 });
      await this.page.fill('input[role="searchbox"]', url);
      
      // Click Start button
      await this.page.click('button:has-text("Start")');
      
      // Wait for processing and download
      for (let i = 0; i < 20; i++) {
        if (isDownloadStarted() && getDownloadUrl()) {
          return {
            success: true,
            downloadUrl: getDownloadUrl(),
            platform: platform,
            method: 'ssvid_intercepted'
          };
        }

        // Check for download table with conversion options
        try {
          const convertButtons = await this.page.$$('button:has-text("Convert")');
          if (convertButtons.length > 0) {
            // Click first available convert button (usually highest quality)
            await convertButtons[0].click();
            console.log('Clicked convert button, waiting for download...');
            
            // Wait additional time for conversion
            for (let j = 0; j < 10; j++) {
              if (isDownloadStarted() && getDownloadUrl()) {
                return {
                  success: true,
                  downloadUrl: getDownloadUrl(),
                  platform: platform,
                  method: 'ssvid_converted'
                };
              }
              await this.page.waitForTimeout(2000);
            }
          }
        } catch (e) {
          // No convert buttons yet
        }

        // Check for direct download links
        const downloadLinks = await this.page.$$('a[href*="download"], a[href*=".mp4"], a[download]');
        for (const link of downloadLinks) {
          const href = await link.getAttribute('href');
          if (href && this.isValidVideoUrl(href)) {
            return {
              success: true,
              downloadUrl: href,
              platform: platform,
              method: 'ssvid_dom'
            };
          }
        }

        await this.page.waitForTimeout(2000);
        console.log(`SSVid attempt ${i + 1}/20...`);
      }

      throw new Error('SSVid: No download found after 40 seconds');

    } catch (error) {
      console.log(`❌ SSVid failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * TIER 3: Squidlr.com - Clean interface, no ads
   */
  async downloadWithSquidlr(url, platform) {
    try {
      console.log(`🎯 Tier 3: Squidlr download for ${platform}`);
      
      // Squidlr doesn't support YouTube
      if (platform === 'youtube') {
        throw new Error('Squidlr does not support YouTube');
      }
      
      const { getDownloadUrl, isDownloadStarted } = await this.setupDownloadInterception();
      
      await this.page.goto('https://www.squidlr.com/', { waitUntil: 'networkidle' });
      
      // Wait for Blazor to initialize (Squidlr uses Blazor)
      await this.page.waitForTimeout(3000);
      
      // Fill URL input - Squidlr uses textbox with name "Download URL"
      await this.page.waitForSelector('textbox', { timeout: 10000 });
      await this.page.fill('textbox', url);
      
      // Wait for URL validation and button to be enabled
      await this.page.waitForTimeout(2000);
      
      // Squidlr automatically processes the URL, check if we're redirected to download page
      await this.page.waitForTimeout(3000);
      
      // Check if we're on download page (URL contains /download)
      const currentUrl = this.page.url();
      if (currentUrl.includes('/download')) {
        console.log('Squidlr processed URL automatically');
        
        // Wait for download or error message
        for (let i = 0; i < 15; i++) {
          // Check for error message
          const errorMsg = await this.page.$('text="Oh no! Something went wrong"');
          if (errorMsg) {
            throw new Error('Squidlr: Content not found or not accessible');
          }

          // Check for download links
          const downloadLinks = await this.page.$$('a[href*="download"], a[href*=".mp4"], a[download]');
          for (const link of downloadLinks) {
            const href = await link.getAttribute('href');
            if (href && this.isValidVideoUrl(href)) {
              return {
                success: true,
                downloadUrl: href,
                platform: platform,
                method: 'squidlr_dom'
              };
            }
          }

          if (isDownloadStarted() && getDownloadUrl()) {
            return {
              success: true,
              downloadUrl: getDownloadUrl(),
              platform: platform,
              method: 'squidlr_intercepted'
            };
          }

          await this.page.waitForTimeout(2000);
          console.log(`Squidlr attempt ${i + 1}/15...`);
        }
      }

      throw new Error('Squidlr: No download found after processing');

    } catch (error) {
      console.log(`❌ Squidlr failed: ${error.message}`);
      throw error;
    }
  }

  isValidVideoUrl(url) {
    return url && (
      url.includes('.mp4') ||
      url.includes('.webm') ||
      url.includes('.m4v') ||
      url.includes('blob:') ||
      url.includes('googlevideo') ||
      (url.includes('download') && !url.includes('ko-fi') && !url.includes('support'))
    );
  }

  async download(url) {
    const platform = this.detectPlatform(url);
    console.log(`🚀 Starting enhanced download for ${platform}: ${url}`);

    if (platform === 'unknown') {
      return {
        success: false,
        error: 'Unsupported platform detected',
        platform: platform
      };
    }

    const tiers = [
      () => this.downloadWithGetLoady(url, platform),
      () => this.downloadWithSSVid(url, platform),
      () => this.downloadWithSquidlr(url, platform)
    ];

    let lastError = null;

    for (let i = 0; i < tiers.length; i++) {
      try {
        const result = await tiers[i]();
        if (result.success) {
          console.log(`🎉 SUCCESS with Tier ${i + 1}: ${result.method}`);
          return result;
        }
      } catch (error) {
        lastError = error;
        console.log(`⚠️  Tier ${i + 1} failed: ${error.message}`);
        
        // Add delay between tiers
        if (i < tiers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }

    console.log(`💥 All tiers failed for ${url}`);
    return {
      success: false,
      error: `All download methods failed. Last error: ${lastError?.message}`,
      platform: platform
    };
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Test function
async function testEnhancedDownloader() {
  const downloader = new EnhancedUniversalDownloader();
  
  try {
    await downloader.initialize();
    
    // Test different platforms
    const testUrls = [
      'https://www.tiktok.com/@test/video/123',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.instagram.com/p/test123/',
      'https://twitter.com/test/status/123'
    ];

    for (const testUrl of testUrls) {
      console.log(`\\n=== Testing ${testUrl} ===`);
      const result = await downloader.download(testUrl);
      console.log('Result:', JSON.stringify(result, null, 2));
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await downloader.close();
  }
}

if (require.main === module) {
  testEnhancedDownloader();
}

module.exports = EnhancedUniversalDownloader;