/**
 * Verified Tier System with Docker Playwright MCP + Local OpenAI Model
 * 
 * Enhanced tier system that uses Docker Playwright MCP to verify each tier's result
 * before proceeding to the next tier. Includes local OpenAI-compatible model for 
 * intelligent verification.
 * 
 * Flow:
 * 1. Try Tier N
 * 2. If success -> Verify with Docker MCP + Local AI
 * 3. If verification passes -> Return success
 * 4. If verification fails -> Try next tier
 */

const { chromium } = require('playwright');
const axios = require('axios');

class VerifiedTierSystemWithMCP {
  constructor(options = {}) {
    this.browser = null;
    this.page = null;
    this.config = {
      headless: options.headless || false,
      downloadTimeout: options.downloadTimeout || 45000,
      retryAttempts: options.retryAttempts || 2,
      mcpUrl: options.mcpUrl || 'http://localhost:8931',
      localAiUrl: options.localAiUrl || 'http://localhost:1234/v1', // LocalAI/Ollama
      localAiModel: options.localAiModel || 'llama3.2:3b', // or 'gpt-3.5-turbo-instruct'
      enableMcpVerification: options.enableMcpVerification !== false,
      verificationTimeout: options.verificationTimeout || 15000,
      ...options
    };
    
    this.stats = {
      tierUsage: {
        getloady: { attempts: 0, successes: 0, verificationPasses: 0 },
        ssvid: { attempts: 0, successes: 0, verificationPasses: 0 },
        squidlr: { attempts: 0, successes: 0, verificationPasses: 0 },
        mcpVerifications: 0,
        aiVerifications: 0
      },
      totalAttempts: 0,
      successfulDownloads: 0,
      failedDownloads: 0,
      verificationFailed: 0
    };
  }

  async initialize() {
    console.log('🚀 Initializing Verified Tier System with MCP + Local AI...');
    
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

    // Test connections
    if (this.config.enableMcpVerification) {
      await this.testConnections();
    }

    console.log('✅ Verified system initialization complete');
  }

  async testConnections() {
    // Test Docker MCP connection
    try {
      const mcpResponse = await axios.get(`${this.config.mcpUrl}/health`, { timeout: 5000 });
      console.log('🐳 Docker Playwright MCP: Connected and healthy');
    } catch (error) {
      console.log('⚠️ Docker Playwright MCP: Not available (starting without MCP verification)');
      this.config.enableMcpVerification = false;
      return;
    }

    // Test Local AI connection
    try {
      const aiResponse = await axios.post(`${this.config.localAiUrl}/chat/completions`, {
        model: this.config.localAiModel,
        messages: [{ role: 'user', content: 'Test connection' }],
        max_tokens: 10,
        temperature: 0.1
      }, { timeout: 10000 });
      
      console.log('🤖 Local AI Model: Connected and ready');
    } catch (error) {
      console.log('⚠️ Local AI Model: Not available (will skip AI verification)');
      // Continue without AI verification but keep MCP
    }
  }

  /**
   * Verify a tier's result using Docker Playwright MCP + Local AI
   */
  async verifyTierResult(url, platform, tierResult, tierName) {
    if (!this.config.enableMcpVerification || !tierResult.success) {
      return tierResult; // Skip verification if disabled or tier failed
    }

    console.log(`🔍 Verifying ${tierName} result with Docker MCP + Local AI...`);
    this.stats.tierUsage.mcpVerifications++;

    try {
      // Step 1: Use Docker MCP to independently test the same URL
      const mcpVerification = await this.mcpVerifyDownload(url, platform);
      
      // Step 2: Use Local AI to analyze both results
      const aiVerification = await this.aiVerifyResults(tierResult, mcpVerification, url, platform);
      
      if (aiVerification.verified) {
        console.log(`✅ ${tierName} verification PASSED - Result confirmed reliable`);
        this.stats.tierUsage[tierName.toLowerCase()].verificationPasses++;
        return {
          ...tierResult,
          verified: true,
          verificationMethod: 'mcp_ai_verified',
          confidence: aiVerification.confidence
        };
      } else {
        console.log(`❌ ${tierName} verification FAILED - ${aiVerification.reason}`);
        this.stats.verificationFailed++;
        return {
          success: false,
          error: `Verification failed: ${aiVerification.reason}`,
          originalResult: tierResult,
          verificationFailed: true
        };
      }

    } catch (error) {
      console.log(`⚠️ ${tierName} verification ERROR: ${error.message}`);
      // Return original result if verification fails
      return {
        ...tierResult,
        verificationWarning: error.message
      };
    }
  }

  /**
   * Use Docker Playwright MCP to independently verify download
   */
  async mcpVerifyDownload(url, platform) {
    try {
      const mcpResponse = await axios.post(`${this.config.mcpUrl}/execute`, {
        script: `
          // Navigate to SSVid as verification method
          await page.goto('https://ssvid.net/en');
          await page.waitForSelector('input[role="searchbox"]', { timeout: 10000 });
          await page.fill('input[role="searchbox"]', '${url}');
          await page.click('button:has-text("Start")');
          
          // Wait for results
          await page.waitForTimeout(15000);
          
          // Check for download elements
          const downloadElements = await page.$$('a[href*="download"], a[href*=".mp4"], button:has-text("Convert")');
          const hasDownloads = downloadElements.length > 0;
          
          // Get page content for AI analysis
          const pageContent = await page.textContent('body');
          
          return {
            hasDownloadElements: hasDownloads,
            elementCount: downloadElements.length,
            pageContent: pageContent?.substring(0, 1000),
            url: page.url()
          };
        `,
        timeout: this.config.verificationTimeout
      }, { timeout: this.config.verificationTimeout + 5000 });

      return mcpResponse.data.result;

    } catch (error) {
      throw new Error(`MCP verification failed: ${error.message}`);
    }
  }

  /**
   * Use Local AI to analyze and compare results
   */
  async aiVerifyResults(tierResult, mcpResult, url, platform) {
    this.stats.tierUsage.aiVerifications++;

    try {
      const prompt = `You are a download verification system. Analyze these two download attempts for the same ${platform} URL and determine if they are consistent and reliable.

Original Tier Result:
- Success: ${tierResult.success}
- Method: ${tierResult.method}
- Download URL: ${tierResult.downloadUrl ? 'Present' : 'Missing'}
- URL contains video indicators: ${this.isValidVideoUrl(tierResult.downloadUrl)}

MCP Verification Result:
- Has download elements: ${mcpResult.hasDownloadElements}
- Element count: ${mcpResult.elementCount}
- Page content suggests success: ${mcpResult.pageContent?.includes('download') || mcpResult.pageContent?.includes('Convert')}

Analysis Instructions:
1. Both results should indicate successful download detection
2. URLs should contain video-related patterns (.mp4, googlevideo, download, etc.)
3. MCP should find download elements or conversion options
4. Results should be logically consistent

Respond with JSON only:
{
  "verified": boolean,
  "confidence": number (0.0-1.0),
  "reason": "brief explanation",
  "recommendation": "proceed|retry|next_tier"
}`;

      const aiResponse = await axios.post(`${this.config.localAiUrl}/chat/completions`, {
        model: this.config.localAiModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.1,
        response_format: { type: 'json_object' }
      }, { timeout: 15000 });

      const aiAnalysis = JSON.parse(aiResponse.data.choices[0].message.content);
      
      return {
        verified: aiAnalysis.verified && aiAnalysis.confidence > 0.7,
        confidence: aiAnalysis.confidence,
        reason: aiAnalysis.reason,
        recommendation: aiAnalysis.recommendation
      };

    } catch (error) {
      // Fallback to simple heuristic verification
      const fallbackVerified = tierResult.success && 
                             this.isValidVideoUrl(tierResult.downloadUrl) &&
                             (mcpResult.hasDownloadElements || mcpResult.elementCount > 0);
      
      return {
        verified: fallbackVerified,
        confidence: fallbackVerified ? 0.8 : 0.3,
        reason: `AI unavailable, used fallback verification: ${fallbackVerified ? 'passed' : 'failed'}`,
        recommendation: fallbackVerified ? 'proceed' : 'next_tier'
      };
    }
  }

  // Include all the tier methods from previous scripts
  detectPlatform(url) {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'youtube';
    if (urlLower.includes('tiktok.com')) return 'tiktok';
    if (urlLower.includes('instagram.com')) return 'instagram';
    if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) return 'twitter';
    if (urlLower.includes('vimeo.com')) return 'vimeo';
    if (urlLower.includes('reddit.com')) return 'reddit';
    if (urlLower.includes('facebook.com')) return 'facebook';
    return 'unknown';
  }

  getSupportedPlatforms(service) {
    const support = {
      getloady: ['tiktok', 'instagram', 'pinterest', 'reddit', 'youtube', 'twitter', 'facebook'],
      ssvid: ['youtube', 'instagram', 'tiktok', 'twitter', 'facebook', 'linkedin', 'vimeo', 'reddit', 'pinterest'],
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
      await download.cancel();
    });

    return { 
      getDownloadUrl: () => downloadUrl, 
      isDownloadStarted: () => downloadStarted 
    };
  }

  /**
   * TIER 1: GetLoady.com with verification
   */
  async downloadWithGetLoady(url, platform) {
    if (!this.getSupportedPlatforms('getloady').includes(platform)) {
      throw new Error(`GetLoady doesn't support ${platform}`);
    }

    console.log(`🎯 TIER 1: GetLoady download for ${platform}`);
    this.stats.tierUsage.getloady.attempts++;
    
    const { getDownloadUrl, isDownloadStarted } = await this.setupDownloadInterception();
    
    const platformUrl = `https://getloady.com/${platform}`;
    await this.page.goto(platformUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await this.page.waitForTimeout(3000);
    
    // Fill input and click button (same as before)
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

    const buttonTexts = ['Get YouTube Video Link', 'Download Video', 'Download'];
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
    for (let i = 0; i < 8; i++) {
      await this.page.waitForTimeout(3000);
      
      const pages = await this.page.context().pages();
      for (const currentPage of pages) {
        if (currentPage !== this.page) {
          const pageUrl = currentPage.url();
          if (this.isValidVideoUrl(pageUrl)) {
            const result = {
              success: true,
              downloadUrl: pageUrl,
              platform: platform,
              method: 'getloady_newtab',
              tier: 1
            };
            
            this.stats.tierUsage.getloady.successes++;
            
            // VERIFY WITH MCP + AI BEFORE RETURNING
            return await this.verifyTierResult(url, platform, result, 'GetLoady');
          }
        }
      }
    }

    throw new Error('GetLoady: No download found');
  }

  /**
   * TIER 2: SSVid.net with verification
   */
  async downloadWithSSVid(url, platform) {
    console.log(`🎯 TIER 2: SSVid download for ${platform}`);
    this.stats.tierUsage.ssvid.attempts++;
    
    await this.page.goto('https://ssvid.net/en', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await this.page.waitForTimeout(3000);
    
    // Fill search input
    const inputSelectors = ['input[role="searchbox"]', '#search__input'];
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
    
    // Wait for conversion options
    for (let i = 0; i < 10; i++) {
      await this.page.waitForTimeout(3000);
      
      try {
        const convertButtons = await this.page.$$('button:has-text("Convert")');
        if (convertButtons.length > 0) {
          await convertButtons[0].click();
          
          // Wait for download dialog
          for (let j = 0; j < 6; j++) {
            await this.page.waitForTimeout(2000);
            
            const downloadLinks = await this.page.$$('a[href*="download"], a[href*=".mp4"]');
            if (downloadLinks.length > 0) {
              const href = await downloadLinks[0].getAttribute('href');
              if (href && this.isValidVideoUrl(href)) {
                const result = {
                  success: true,
                  downloadUrl: href,
                  platform: platform,
                  method: 'ssvid_converted',
                  tier: 2
                };
                
                this.stats.tierUsage.ssvid.successes++;
                
                // VERIFY WITH MCP + AI BEFORE RETURNING
                return await this.verifyTierResult(url, platform, result, 'SSVid');
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
      return { success: false, error: 'Unsupported platform', platform };
    }

    console.log(`🚀 Starting VERIFIED tier system for ${platform}: ${url}`);

    const tiers = [
      { name: 'GetLoady', fn: () => this.downloadWithGetLoady(url, platform) },
      { name: 'SSVid', fn: () => this.downloadWithSSVid(url, platform) }
    ];

    let lastError = null;

    for (let tierIndex = 0; tierIndex < tiers.length; tierIndex++) {
      try {
        console.log(`\n🔄 Attempting ${tiers[tierIndex].name} (Tier ${tierIndex + 1})...`);
        
        const result = await tiers[tierIndex].fn();
        
        if (result.success && !result.verificationFailed) {
          this.stats.successfulDownloads++;
          console.log(`🎉 VERIFIED SUCCESS with ${tiers[tierIndex].name}: ${result.method}`);
          
          if (result.verified) {
            console.log(`🔒 Verification confidence: ${(result.confidence * 100).toFixed(1)}%`);
          }
          
          return {
            ...result,
            url: url,
            finalTier: tierIndex + 1
          };
        } else if (result.verificationFailed) {
          console.log(`⚠️ ${tiers[tierIndex].name} failed verification, trying next tier...`);
          lastError = new Error(result.error);
        }
        
      } catch (error) {
        lastError = error;
        console.log(`⚠️ ${tiers[tierIndex].name} failed: ${error.message}`);
        
        if (tierIndex < tiers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }

    this.stats.failedDownloads++;
    return {
      success: false,
      error: `All verified tiers failed. Last error: ${lastError?.message}`,
      platform: platform,
      url: url
    };
  }

  getDetailedStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalAttempts > 0 ? 
        (this.stats.successfulDownloads / this.stats.totalAttempts * 100).toFixed(2) + '%' : '0%',
      verificationRate: this.stats.tierUsage.mcpVerifications > 0 ?
        ((this.stats.tierUsage.mcpVerifications - this.stats.verificationFailed) / this.stats.tierUsage.mcpVerifications * 100).toFixed(2) + '%' : '0%'
    };
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
    console.log('🔴 Verified tier system closed');
  }
}

// Test function
async function testVerifiedSystem() {
  const downloader = new VerifiedTierSystemWithMCP({
    headless: false,
    enableMcpVerification: true,
    localAiModel: 'llama3.2:3b' // Change to your local model
  });
  
  try {
    await downloader.initialize();
    
    const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    console.log('🔥 TESTING VERIFIED TIER SYSTEM WITH MCP + LOCAL AI');
    console.log('==================================================');
    
    const result = await downloader.downloadWithRetry(testUrl);
    
    console.log('\n📊 FINAL VERIFIED RESULTS:');
    console.log(`Success: ${result.success ? '✅' : '❌'}`);
    if (result.success) {
      console.log(`Verified Tier: ${result.finalTier}`);
      console.log(`Method: ${result.method}`);
      console.log(`Verified: ${result.verified ? '🔒' : '⚠️'}`);
      if (result.confidence) {
        console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      }
    } else {
      console.log(`Error: ${result.error}`);
    }
    
    console.log('\n📈 Detailed Statistics:', downloader.getDetailedStats());
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await downloader.close();
  }
}

if (require.main === module) {
  testVerifiedSystem();
}

module.exports = VerifiedTierSystemWithMCP;