/**
 * Test Real URL Downloader
 * Quick test of our production script with a known working URL
 */

const { chromium } = require('playwright');

class TestDownloader {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    console.log('🚀 Initializing Test Downloader...');
    
    this.browser = await chromium.launch({
      headless: false, // Keep visible so you can see it working
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });

    this.page = await this.browser.newPage();
    
    // Set realistic headers
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    console.log('✅ Browser initialized');
  }

  async setupDownloadInterception() {
    let downloadUrl = null;
    let downloadStarted = false;

    this.page.on('download', async download => {
      downloadUrl = download.url();
      downloadStarted = true;
      console.log(`📥 Download intercepted: ${downloadUrl}`);
      await download.cancel(); // Just capture the URL
    });

    this.page.on('response', response => {
      const responseUrl = response.url();
      const contentType = response.headers()['content-type'] || '';
      
      if (this.isValidVideoUrl(responseUrl, contentType)) {
        downloadUrl = responseUrl;
        downloadStarted = true;
        console.log(`🎬 Video URL intercepted: ${responseUrl}`);
      }
    });

    return { 
      getDownloadUrl: () => downloadUrl, 
      isDownloadStarted: () => downloadStarted 
    };
  }

  async downloadWithSSVid(url) {
    console.log(`🎯 Testing SSVid.net with: ${url}`);
    
    const { getDownloadUrl, isDownloadStarted } = await this.setupDownloadInterception();
    
    // Navigate to SSVid
    await this.page.goto('https://ssvid.net/en', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('📖 SSVid.net loaded');
    
    // Wait a bit for page to fully render
    await this.page.waitForTimeout(3000);
    
    // Find and fill search input with multiple selector fallbacks
    const inputSelectors = [
      'input[role="searchbox"]',
      '#search__input', 
      'input[type="search"]',
      'searchbox'
    ];
    
    let inputFilled = false;
    for (const selector of inputSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 5000 });
        await this.page.fill(selector, url);
        console.log(`✏️ URL entered using: ${selector}`);
        inputFilled = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (!inputFilled) {
      throw new Error('Could not find search input field');
    }
    
    // Click Start button
    await this.page.click('button:has-text("Start")');
    console.log('🔘 Start button clicked');
    
    // Wait for processing and check for downloads
    for (let i = 0; i < 15; i++) {
      await this.page.waitForTimeout(3000);
      
      // Check for intercept
      if (isDownloadStarted() && getDownloadUrl()) {
        return {
          success: true,
          downloadUrl: getDownloadUrl(),
          method: 'intercepted',
          attempt: i + 1
        };
      }

      // Check for convert buttons (YouTube workflow)
      try {
        const convertButtons = await this.page.$$('button:has-text("Convert")');
        if (convertButtons.length > 0) {
          console.log(`🔄 Found ${convertButtons.length} convert options, clicking first one`);
          await convertButtons[0].click();
          
          // Wait for conversion
          for (let j = 0; j < 8; j++) {
            await this.page.waitForTimeout(2000);
            if (isDownloadStarted() && getDownloadUrl()) {
              return {
                success: true,
                downloadUrl: getDownloadUrl(),
                method: 'converted',
                attempt: i + 1,
                conversionStep: j + 1
              };
            }
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
            method: 'dom_link',
            attempt: i + 1
          };
        }
      }

      console.log(`⏳ Attempt ${i + 1}/15 - Still processing...`);
    }

    throw new Error('SSVid: Timeout after 45 seconds');
  }

  isValidVideoUrl(url, contentType = '') {
    return url && (
      url.includes('.mp4') ||
      url.includes('.webm') ||
      url.includes('.m4v') ||
      url.includes('blob:') ||
      url.includes('googlevideo') ||
      contentType.includes('video/') ||
      (url.includes('download') && !url.includes('ko-fi'))
    );
  }

  async testDownload(url) {
    try {
      await this.initialize();
      
      console.log(`\n🎬 Testing download for: ${url}`);
      const result = await this.downloadWithSSVid(url);
      
      console.log('\n🎉 SUCCESS!');
      console.log(`📊 Results:`);
      console.log(`   Method: ${result.method}`);
      console.log(`   Attempts: ${result.attempt}`);
      console.log(`   Download URL: ${result.downloadUrl.substring(0, 100)}...`);
      
      return result;
      
    } catch (error) {
      console.error('\n❌ Test failed:', error.message);
      return { success: false, error: error.message };
    } finally {
      if (this.browser) {
        await this.browser.close();
        console.log('🔴 Browser closed');
      }
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Test with the YouTube URL we verified works
async function runTest() {
  const downloader = new TestDownloader();
  
  // Using the Rick Astley video we tested and confirmed works
  const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  
  console.log('🔥 TESTING PRODUCTION DOWNLOADER SCRIPT');
  console.log('=========================================');
  
  const result = await downloader.testDownload(testUrl);
  
  console.log('\n📋 Final Report:');
  console.log(`Success: ${result.success ? '✅' : '❌'}`);
  if (result.success) {
    console.log(`Video detected and download URL captured successfully!`);
  } else {
    console.log(`Error: ${result.error}`);
  }
}

if (require.main === module) {
  runTest();
}

module.exports = TestDownloader;