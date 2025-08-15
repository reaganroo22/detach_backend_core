/**
 * Production Tier System Test
 * Tests the actual production tier system including GetLoady.com as Tier 1
 */

const { chromium } = require('playwright');

class ProductionTierTest {
  constructor() {
    this.browser = null;
    this.page = null;
    this.stats = {
      getloady: 0,
      ssvid: 0,
      squidlr: 0
    };
  }

  async initialize() {
    console.log('🚀 Initializing Production Tier Test...');
    
    this.browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    this.page = await this.browser.newPage();
    
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    console.log('✅ Browser initialized');
  }

  detectPlatform(url) {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'youtube';
    if (urlLower.includes('tiktok.com')) return 'tiktok';
    if (urlLower.includes('instagram.com')) return 'instagram';
    if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) return 'twitter';
    if (urlLower.includes('vimeo.com')) return 'vimeo';
    if (urlLower.includes('reddit.com')) return 'reddit';
    return 'unknown';
  }

  getSupportedPlatforms(service) {
    const support = {
      getloady: ['tiktok', 'instagram', 'pinterest', 'reddit', 'youtube', 'twitter', 'facebook'],
      ssvid: ['youtube', 'instagram', 'tiktok', 'twitter', 'facebook', 'linkedin', 'vimeo', 'soundcloud', 'dailymotion', 'reddit', 'pinterest'],
      squidlr: ['twitter', 'instagram', 'facebook', 'tiktok', 'linkedin']
    };
    return support[service] || [];
  }

  async setupDownloadInterception() {
    let downloadUrl = null;
    let downloadStarted = false;

    this.page.on('download', async download => {
      downloadUrl = download.url();
      downloadStarted = true;
      console.log(`📥 Download intercepted: ${downloadUrl}`);
      await download.cancel();
    });

    return { 
      getDownloadUrl: () => downloadUrl, 
      isDownloadStarted: () => downloadStarted 
    };
  }

  /**
   * TIER 1: GetLoady.com - Premium HD downloads
   */
  async downloadWithGetLoady(url, platform) {
    if (!this.getSupportedPlatforms('getloady').includes(platform)) {
      throw new Error(`GetLoady doesn't support ${platform}`);
    }

    console.log(`🎯 TIER 1: GetLoady download for ${platform}`);
    this.stats.getloady++;
    
    const { getDownloadUrl, isDownloadStarted } = await this.setupDownloadInterception();
    
    const platformUrl = `https://getloady.com/${platform}`;
    await this.page.goto(platformUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log(`📖 GetLoady ${platform} page loaded`);
    
    await this.page.waitForTimeout(3000);
    
    // Find input field
    const inputSelectors = ['textbox', 'input[type="text"]', 'input[type="url"]'];
    let inputFilled = false;
    
    for (const selector of inputSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 5000 });
        await this.page.fill(selector, url);
        console.log(`✏️ GetLoady: URL entered with ${selector}`);
        inputFilled = true;
        break;
      } catch (e) {
        continue;
      }
    }

    if (!inputFilled) {
      throw new Error(`GetLoady: Could not find input field for ${platform}`);
    }

    await this.page.waitForTimeout(1500);

    // Find download button
    const buttonTexts = [
      'Get YouTube Video Link',
      'Download Video',
      'Download Video or Image',
      'Download',
      'Get'
    ];

    let buttonClicked = false;
    for (const text of buttonTexts) {
      try {
        await this.page.click(`button:has-text("${text}")`, { timeout: 3000 });
        console.log(`🔘 GetLoady: Clicked ${text} button`);
        buttonClicked = true;
        break;
      } catch (e) {
        continue;
      }
    }

    if (!buttonClicked) {
      throw new Error(`GetLoady: Could not find download button for ${platform}`);
    }

    // Wait for processing and check for new tabs (GetLoady opens direct video links in new tabs)
    for (let i = 0; i < 10; i++) {
      await this.page.waitForTimeout(3000);
      
      // Check for new tabs/pages (GetLoady workflow)
      const pages = await this.page.context().pages();
      for (const currentPage of pages) {
        if (currentPage !== this.page) {
          const pageUrl = currentPage.url();
          console.log(`🎬 GetLoady: New tab detected: ${pageUrl.substring(0, 100)}...`);
          if (this.isValidVideoUrl(pageUrl)) {
            return {
              success: true,
              downloadUrl: pageUrl,
              platform: platform,
              method: 'getloady_newtab',
              tier: 1
            };
          }
        }
      }

      console.log(`⏳ GetLoady attempt ${i + 1}/10...`);
    }

    throw new Error('GetLoady: No download found after 30 seconds');
  }

  /**
   * TIER 2: SSVid.net - Comprehensive platform support  
   */
  async downloadWithSSVid(url, platform) {
    console.log(`🎯 TIER 2: SSVid download for ${platform}`);
    this.stats.ssvid++;
    
    const { getDownloadUrl, isDownloadStarted } = await this.setupDownloadInterception();
    
    await this.page.goto('https://ssvid.net/en', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('📖 SSVid.net loaded');
    
    await this.page.waitForTimeout(3000);
    
    // Find and fill search input
    const inputSelectors = ['input[role="searchbox"]', '#search__input', 'input[type="search"]'];
    let inputFilled = false;
    
    for (const selector of inputSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 5000 });
        await this.page.fill(selector, url);
        console.log(`✏️ SSVid: URL entered with ${selector}`);
        inputFilled = true;
        break;
      } catch (e) {
        continue;
      }
    }

    if (!inputFilled) {
      throw new Error('SSVid: Could not find search input');
    }

    await this.page.click('button:has-text("Start")');
    console.log('🔘 SSVid: Start button clicked');
    
    // Wait for processing
    for (let i = 0; i < 15; i++) {
      await this.page.waitForTimeout(3000);
      
      // Check for convert buttons (YouTube workflow)
      try {
        const convertButtons = await this.page.$$('button:has-text("Convert")');
        if (convertButtons.length > 0) {
          console.log(`🔄 SSVid: Found ${convertButtons.length} convert options`);
          await convertButtons[0].click();
          
          // Wait for conversion and download dialog
          for (let j = 0; j < 8; j++) {
            await this.page.waitForTimeout(2000);
            
            // Check for download dialog/modal
            const downloadLinks = await this.page.$$('a[href*="download"], a[href*=".mp4"], link:has-text("Download")');
            if (downloadLinks.length > 0) {
              const href = await downloadLinks[0].getAttribute('href');
              if (href && this.isValidVideoUrl(href)) {
                return {
                  success: true,
                  downloadUrl: href,
                  platform: platform,
                  method: 'ssvid_converted',
                  tier: 2
                };
              }
            }
          }
        }
      } catch (e) {
        // No convert buttons yet
      }

      console.log(`⏳ SSVid attempt ${i + 1}/15...`);
    }

    throw new Error('SSVid: No download found after 45 seconds');
  }

  isValidVideoUrl(url) {
    return url && (
      url.includes('.mp4') ||
      url.includes('.webm') ||
      url.includes('.m4v') ||
      url.includes('blob:') ||
      url.includes('googlevideo') ||
      (url.includes('download') && !url.includes('ko-fi'))
    );
  }

  async downloadWithRetry(url) {
    const platform = this.detectPlatform(url);
    
    if (platform === 'unknown') {
      return {
        success: false,
        error: 'Unsupported platform detected',
        platform: platform
      };
    }

    console.log(`🚀 Testing production tier system for ${platform}: ${url}`);

    // Production tier order: GetLoady -> SSVid -> Squidlr
    const tiers = [
      () => this.downloadWithGetLoady(url, platform),
      () => this.downloadWithSSVid(url, platform)
    ];

    let lastError = null;

    for (let tierIndex = 0; tierIndex < tiers.length; tierIndex++) {
      try {
        console.log(`\n🔄 Attempting Tier ${tierIndex + 1}...`);
        
        const result = await tiers[tierIndex]();
        if (result.success) {
          console.log(`🎉 SUCCESS with Tier ${tierIndex + 1}: ${result.method}`);
          return {
            ...result,
            url: url,
            finalTier: tierIndex + 1
          };
        }
      } catch (error) {
        lastError = error;
        console.log(`⚠️ Tier ${tierIndex + 1} failed: ${error.message}`);
        
        // Add delay between tiers
        if (tierIndex < tiers.length - 1) {
          console.log('⏳ Waiting before next tier...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }

    return {
      success: false,
      error: `All tiers failed. Last error: ${lastError?.message}`,
      platform: platform,
      url: url
    };
  }

  async testProductionTiers(url) {
    try {
      await this.initialize();
      
      console.log('🔥 TESTING PRODUCTION TIER SYSTEM');
      console.log('==================================');
      console.log(`📹 Testing URL: ${url}`);
      console.log(`🎯 Expected Tier Order: GetLoady (1) -> SSVid (2) -> Squidlr (3)`);
      
      const result = await this.downloadWithRetry(url);
      
      console.log('\n📊 FINAL RESULTS:');
      console.log(`Success: ${result.success ? '✅' : '❌'}`);
      console.log(`Platform: ${result.platform}`);
      
      if (result.success) {
        console.log(`Successful Tier: ${result.finalTier}`);
        console.log(`Method: ${result.method}`);
        console.log(`Download URL: ${result.downloadUrl?.substring(0, 100)}...`);
      } else {
        console.log(`Error: ${result.error}`);
      }
      
      console.log('\n📈 Tier Usage Stats:');
      console.log(`GetLoady (Tier 1): ${this.stats.getloady} attempts`);
      console.log(`SSVid (Tier 2): ${this.stats.ssvid} attempts`);
      console.log(`Squidlr (Tier 3): ${this.stats.squidlr} attempts`);
      
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
}

// Test with real YouTube URL to verify tier system
async function runProductionTest() {
  const tester = new ProductionTierTest();
  
  // Using the Rick Astley video we confirmed works
  const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  
  await tester.testProductionTiers(testUrl);
}

if (require.main === module) {
  runProductionTest();
}

module.exports = ProductionTierTest;