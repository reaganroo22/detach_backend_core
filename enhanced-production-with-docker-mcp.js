/**
 * Enhanced Production Downloader with Docker Playwright MCP Fallback
 * 
 * Tier System:
 * 1. GetLoady.com (Direct Playwright)
 * 2. SSVid.net (Direct Playwright) 
 * 3. Squidlr.com (Direct Playwright)
 * 4. Docker Playwright MCP Fallback (for verification/backup)
 */

const { chromium } = require('playwright');
const axios = require('axios');

class EnhancedProductionDownloader {
  constructor(options = {}) {
    this.browser = null;
    this.page = null;
    this.config = {
      headless: options.headless || false,
      downloadTimeout: options.downloadTimeout || 45000,
      retryAttempts: options.retryAttempts || 2,
      mcpUrl: options.mcpUrl || 'http://localhost:8931',
      enableMcpFallback: options.enableMcpFallback !== false,
      ...options
    };
    
    this.stats = {
      tierUsage: {
        getloady: 0,
        ssvid: 0,
        squidlr: 0,
        dockerMcp: 0
      },
      totalAttempts: 0,
      successfulDownloads: 0,
      failedDownloads: 0
    };
  }

  async initialize() {
    console.log('🚀 Initializing Enhanced Production Downloader...');
    
    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    this.page = await this.browser.newPage();
    
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    // Test MCP connection if enabled
    if (this.config.enableMcpFallback) {
      await this.testMcpConnection();
    }

    console.log('✅ Initialization complete');
  }

  async testMcpConnection() {
    try {
      const response = await axios.get(`${this.config.mcpUrl}/health`, { timeout: 5000 });
      console.log('🐳 Docker Playwright MCP: Connected and healthy');
      return true;
    } catch (error) {
      console.log('⚠️ Docker Playwright MCP: Not available (will skip MCP fallback)');
      this.config.enableMcpFallback = false;
      return false;
    }
  }

  detectPlatform(url) {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'youtube';
    if (urlLower.includes('tiktok.com')) return 'tiktok';
    if (urlLower.includes('instagram.com')) return 'instagram';
    if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) return 'twitter';
    if (urlLower.includes('vimeo.com')) return 'vimeo';
    if (urlLower.includes('reddit.com')) return 'reddit';
    if (urlLower.includes('facebook.com')) return 'facebook';
    if (urlLower.includes('pinterest.com')) return 'pinterest';
    if (urlLower.includes('linkedin.com')) return 'linkedin';
    return 'unknown';
  }

  getSupportedPlatforms(service) {
    const support = {
      getloady: ['tiktok', 'instagram', 'pinterest', 'reddit', 'youtube', 'twitter', 'facebook'],
      ssvid: ['youtube', 'instagram', 'tiktok', 'twitter', 'facebook', 'linkedin', 'vimeo', 'soundcloud', 'dailymotion', 'reddit', 'pinterest'],
      squidlr: ['twitter', 'instagram', 'facebook', 'tiktok', 'linkedin'],
      dockerMcp: ['youtube', 'instagram', 'tiktok', 'twitter', 'facebook', 'linkedin', 'vimeo', 'reddit'] // Most platforms via MCP
    };
    return support[service] || [];
  }

  async setupDownloadInterception() {
    let downloadUrl = null;
    let downloadStarted = false;

    this.page.on('download', async download => {
      downloadUrl = download.url();
      downloadStarted = true;
      console.log(`📥 Download intercepted: ${downloadUrl?.substring(0, 100)}...`);
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
    this.stats.tierUsage.getloady++;
    
    const { getDownloadUrl, isDownloadStarted } = await this.setupDownloadInterception();
    
    const platformUrl = `https://getloady.com/${platform}`;
    await this.page.goto(platformUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await this.page.waitForTimeout(3000);
    
    // Fill input field
    const inputSelectors = ['textbox', 'input[type="text"]', 'input[type="url"]'];
    let inputFilled = false;
    
    for (const selector of inputSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 5000 });
        await this.page.fill(selector, url);
        inputFilled = true;
        break;
      } catch (e) {
        continue;
      }
    }

    if (!inputFilled) {
      throw new Error(`GetLoady: Could not find input field`);
    }

    // Click download button
    const buttonTexts = ['Get YouTube Video Link', 'Download Video', 'Download Video or Image', 'Download'];
    let buttonClicked = false;
    
    for (const text of buttonTexts) {
      try {
        await this.page.click(`button:has-text("${text}")`, { timeout: 3000 });
        buttonClicked = true;
        break;
      } catch (e) {
        continue;
      }
    }

    if (!buttonClicked) {
      throw new Error(`GetLoady: Could not find download button`);
    }

    // Wait for new tab with video URL
    for (let i = 0; i < 10; i++) {
      await this.page.waitForTimeout(3000);
      
      const pages = await this.page.context().pages();
      for (const currentPage of pages) {
        if (currentPage !== this.page) {
          const pageUrl = currentPage.url();
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
    }

    throw new Error('GetLoady: No download found');
  }

  /**
   * TIER 2: SSVid.net - Comprehensive platform support  
   */
  async downloadWithSSVid(url, platform) {
    console.log(`🎯 TIER 2: SSVid download for ${platform}`);
    this.stats.tierUsage.ssvid++;
    
    const { getDownloadUrl, isDownloadStarted } = await this.setupDownloadInterception();
    
    await this.page.goto('https://ssvid.net/en', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await this.page.waitForTimeout(3000);
    
    // Fill search input
    const inputSelectors = ['input[role="searchbox"]', '#search__input', 'input[type="search"]'];
    let inputFilled = false;
    
    for (const selector of inputSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 5000 });
        await this.page.fill(selector, url);
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
    
    // Wait for processing and conversion
    for (let i = 0; i < 15; i++) {
      await this.page.waitForTimeout(3000);
      
      // Check for convert buttons
      try {
        const convertButtons = await this.page.$$('button:has-text("Convert")');
        if (convertButtons.length > 0) {
          await convertButtons[0].click();
          
          // Wait for download dialog
          for (let j = 0; j < 8; j++) {
            await this.page.waitForTimeout(2000);
            
            const downloadLinks = await this.page.$$('a[href*="download"], a[href*=".mp4"]');
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
        // Continue waiting
      }
    }

    throw new Error('SSVid: No download found');
  }

  /**
   * TIER 4: Docker Playwright MCP Fallback
   */
  async downloadWithDockerMcp(url, platform) {
    if (!this.config.enableMcpFallback) {
      throw new Error('Docker MCP fallback is disabled');
    }

    if (!this.getSupportedPlatforms('dockerMcp').includes(platform)) {
      throw new Error(`Docker MCP doesn't support ${platform}`);
    }

    console.log(`🐳 TIER 4: Docker Playwright MCP fallback for ${platform}`);
    this.stats.tierUsage.dockerMcp++;

    try {
      // Use MCP server to navigate and extract download URLs
      const mcpResponse = await axios.post(`${this.config.mcpUrl}/navigate`, {
        url: `https://ssvid.net/en`,
        actions: [
          { type: 'fill', selector: 'input[role="searchbox"]', value: url },
          { type: 'click', selector: 'button:has-text("Start")' },
          { type: 'wait', timeout: 10000 },
          { type: 'extract', selector: 'a[href*="download"], a[href*=".mp4"]' }
        ]
      }, { timeout: this.config.downloadTimeout });

      if (mcpResponse.data.success && mcpResponse.data.downloadUrls?.length > 0) {
        return {
          success: true,
          downloadUrl: mcpResponse.data.downloadUrls[0],
          platform: platform,
          method: 'docker_mcp_fallback',
          tier: 4
        };
      }

      throw new Error('Docker MCP: No download URLs found');

    } catch (error) {
      throw new Error(`Docker MCP failed: ${error.message}`);
    }
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
    this.stats.totalAttempts++;
    
    if (platform === 'unknown') {
      this.stats.failedDownloads++;
      return {
        success: false,
        error: 'Unsupported platform detected',
        platform: platform
      };
    }

    console.log(`🚀 Starting enhanced production download for ${platform}: ${url}`);

    // Enhanced tier system with Docker MCP fallback
    const tiers = [
      () => this.downloadWithGetLoady(url, platform),
      () => this.downloadWithSSVid(url, platform)
    ];

    // Add Docker MCP fallback if enabled
    if (this.config.enableMcpFallback) {
      tiers.push(() => this.downloadWithDockerMcp(url, platform));
    }

    let lastError = null;

    for (let tierIndex = 0; tierIndex < tiers.length; tierIndex++) {
      try {
        console.log(`\n🔄 Attempting Tier ${tierIndex + 1}...`);
        
        const result = await tiers[tierIndex]();
        if (result.success) {
          this.stats.successfulDownloads++;
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
        
        if (tierIndex < tiers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }

    this.stats.failedDownloads++;
    return {
      success: false,
      error: `All tiers failed. Last error: ${lastError?.message}`,
      platform: platform,
      url: url
    };
  }

  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalAttempts > 0 ? 
        (this.stats.successfulDownloads / this.stats.totalAttempts * 100).toFixed(2) + '%' : '0%'
    };
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
    console.log('🔴 Enhanced downloader closed');
  }
}

// Test function
async function testEnhancedProduction() {
  const downloader = new EnhancedProductionDownloader({
    headless: false,
    enableMcpFallback: true
  });
  
  try {
    await downloader.initialize();
    
    const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    console.log('🔥 TESTING ENHANCED PRODUCTION SYSTEM WITH DOCKER MCP FALLBACK');
    console.log('=============================================================');
    
    const result = await downloader.downloadWithRetry(testUrl);
    
    console.log('\n📊 FINAL RESULTS:');
    console.log(`Success: ${result.success ? '✅' : '❌'}`);
    if (result.success) {
      console.log(`Successful Tier: ${result.finalTier}`);
      console.log(`Method: ${result.method}`);
      console.log(`Download URL: ${result.downloadUrl?.substring(0, 100)}...`);
    } else {
      console.log(`Error: ${result.error}`);
    }
    
    console.log('\n📈 Enhanced Statistics:', downloader.getStats());
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await downloader.close();
  }
}

if (require.main === module) {
  testEnhancedProduction();
}

module.exports = EnhancedProductionDownloader;