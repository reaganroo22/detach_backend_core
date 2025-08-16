/**
 * Comprehensive Video Downloader Suite
 * 
 * Integrates four video download services with advanced error handling,
 * retry logic, and optimization based on extensive Playwright MCP testing.
 * 
 * FEATURES:
 * - 4-tier fallback system (GetLoady → SSVid → Squidlr → Cobalt)
 * - Platform-specific optimizations  
 * - Quality preference handling
 * - Rate limiting and retry logic
 * - Comprehensive error reporting
 * - Download progress tracking
 * - Batch download capabilities
 * - Enhanced error detection for service failures
 */

const StealthBrowserManager = require('./stealth-config');
const fs = require('fs').promises;
const path = require('path');

class ComprehensiveDownloaderSuite {
  constructor(options = {}) {
    this.stealthBrowser = null;
    this.page = null;
    this.config = {
      headless: options.headless || false,
      downloadTimeout: options.downloadTimeout || 45000,
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 5000,
      qualityPreference: options.qualityPreference || 'highest', // 'highest', 'medium', 'lowest'
      downloadPath: options.downloadPath || './downloads',
      enableLogging: options.enableLogging !== false,
      rateLimitDelay: options.rateLimitDelay || 2000,
      enableCaptchaSolving: options.enableCaptchaSolving !== false,
      ...options
    };
    
    this.stats = {
      totalAttempts: 0,
      successfulDownloads: 0,
      failedDownloads: 0,
      tierUsage: {
        getloady: 0,
        ssvid: 0,
        squidlr: 0,
        cobalt: 0,
        backend: 0
      }
    };

    this.log = this.config.enableLogging ? console.log : () => {};
  }

  async initialize() {
    this.log('🚀 Initializing Stealth Comprehensive Downloader Suite...');
    
    // Ensure download directory exists
    await fs.mkdir(this.config.downloadPath, { recursive: true });
    
    // Initialize stealth browser with Patchright and anti-detection
    this.stealthBrowser = new StealthBrowserManager({
      headless: this.config.headless,
      downloadPath: this.config.downloadPath,
      enableLogging: this.config.enableLogging,
      enableCaptchaSolving: this.config.enableCaptchaSolving
    });
    
    // Launch stealth browser
    this.page = await this.stealthBrowser.launch();
    
    this.log('✅ Stealth browser initialization complete with Patchright');
  }

  detectPlatform(url) {
    const urlLower = url.toLowerCase();
    const platformMap = {
      'tiktok.com': 'tiktok',
      'youtube.com': 'youtube', 
      'youtu.be': 'youtube',
      'instagram.com': 'instagram',
      'twitter.com': 'twitter',
      'x.com': 'twitter',
      'pinterest.com': 'pinterest', 
      'facebook.com': 'facebook',
      'linkedin.com': 'linkedin',
      'vimeo.com': 'vimeo',
      'dailymotion.com': 'dailymotion',
      'reddit.com': 'reddit',
      'soundcloud.com': 'soundcloud',
      '9gag.com': '9gag'
    };

    for (const [domain, platform] of Object.entries(platformMap)) {
      if (urlLower.includes(domain)) return platform;
    }
    
    return 'unknown';
  }

  getSupportedPlatforms(service) {
    const support = {
      getloady: ['tiktok', 'instagram', 'pinterest', 'reddit', 'youtube', 'twitter', 'facebook'],
      ssvid: ['youtube', 'instagram', 'tiktok', 'twitter', 'facebook', 'linkedin', 'vimeo', 'soundcloud', 'dailymotion', 'reddit', 'pinterest', '9gag'],
      squidlr: ['twitter', 'instagram', 'facebook', 'tiktok', 'linkedin'],
      cobalt: ['youtube', 'tiktok', 'twitter', 'instagram', 'facebook', 'vimeo', 'reddit', 'soundcloud']
    };
    
    return support[service] || [];
  }

  async setupDownloadInterception() {
    // Use stealth browser's advanced download interception
    return await this.stealthBrowser.setupDownloadInterception();
  }

  /**
   * TIER 1: GetLoady.com - Premium HD downloads
   */
  async downloadWithGetLoady(url, platform) {
    if (!this.getSupportedPlatforms('getloady').includes(platform)) {
      throw new Error(`GetLoady doesn't support ${platform}`);
    }

    this.log(`🎯 Tier 1: GetLoady download for ${platform}`);
    this.stats.tierUsage.getloady++;
    
    const { getDownloadUrl, isDownloadStarted, getDownloadedFile } = await this.setupDownloadInterception();
    
    const platformUrl = `https://getloady.com/${platform}`;
    await this.stealthBrowser.navigateTo(platformUrl);
    
    // Handle modal dialog
    try {
      await this.page.waitForSelector('button:has-text("Close")', { timeout: 3000 });
      await this.page.click('button:has-text("Close")');
      await this.page.waitForTimeout(1000);
    } catch (e) {
      // No modal
    }

    // Enhanced input field detection
    const inputSelectors = [
      `textbox[placeholder*="${platform}"]`,
      `input[placeholder*="${platform}"]`,
      'textbox',
      'input[type="text"]',
      'input[type="url"]'
    ];

    let inputFilled = false;
    for (const selector of inputSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 5000 });
        await this.stealthBrowser.typeHumanLike(selector, url);
        inputFilled = true;
        this.log(`✏️ Input filled with: ${selector}`);
        break;
      } catch (e) {
        continue;
      }
    }

    if (!inputFilled) {
      throw new Error(`GetLoady: Could not find input field for ${platform}`);
    }

    await this.page.waitForTimeout(1500);

    // Enhanced button detection
    const buttonTexts = [
      'Download Video',
      'Download Video or Image',
      'Get YouTube Video Link',
      'Download',
      'Get Video'
    ];

    let buttonClicked = false;
    for (const text of buttonTexts) {
      try {
        await this.stealthBrowser.clickHumanLike(`button:has-text("${text}")`); 
        buttonClicked = true;
        this.log(`🔘 Clicked button: ${text}`);
        break;
      } catch (e) {
        continue;
      }
    }

    if (!buttonClicked) {
      throw new Error(`GetLoady: Could not find download button for ${platform}`);
    }

    // Enhanced download detection with actual download triggering
    let downloadButtonClicked = false;
    
    for (let i = 0; i < 25; i++) {
      // Check for Edge Function errors in console logs
      try {
        const logs = await this.page.evaluate(() => {
          return window.console._logs || [];
        });
        
        const errorMessages = logs.filter(log => 
          log && (log.includes('Edge Function returned a non-2xx status code') || 
                  log.includes('FunctionsHttpError') ||
                  log.includes('server responded with a status of 500'))
        );
        
        if (errorMessages.length > 0) {
          this.log(`❌ GetLoady: Edge Function error detected - stopping attempts`);
          throw new Error('GetLoady Edge Function failed - service unavailable');
        }
      } catch (evalError) {
        // If we can't check console, look for visible error indicators
        try {
          const errorElements = await this.page.$$('text="Error", text="Failed", text="not available"');
          if (errorElements.length > 0) {
            this.log(`❌ GetLoady: Error message detected on page - stopping attempts`);
            throw new Error('GetLoady service error detected');
          }
        } catch (e) {
          // Continue if we can't check for errors
        }
      }

      // Check for download links and click them ONLY ONCE
      if (!downloadButtonClicked) {
        const downloadLinks = await this.page.$$('a[href*="download"], a[href*=".mp4"], a[download], a[href^="blob:"], button:has-text("Download")');
        for (const link of downloadLinks) {
          try {
            const href = await link.getAttribute('href');
            const tagName = await link.evaluate(el => el.tagName.toLowerCase());
            
            if ((href && this.isValidVideoUrl(href)) || tagName === 'button') {
              this.log(`🔗 Clicking download link/button: ${href || 'button'}`);
              await link.click();
              downloadButtonClicked = true;
              
              // Wait longer for download to actually start
              await this.page.waitForTimeout(5000);
              
              const downloadedFile = getDownloadedFile();
              if (downloadedFile) {
                this.log(`💾 File downloaded successfully: ${downloadedFile}`);
                return {
                  success: true,
                  downloadUrl: getDownloadUrl() || href,
                  localFile: downloadedFile,
                  platform: platform,
                  method: 'getloady_browser_download',
                  quality: 'HD',
                  service: 'getloady'
                };
              }
              break; // Only click one download button
            }
          } catch (clickError) {
            this.log(`⚠️ Could not click download link: ${clickError.message}`);
            continue;
          }
        }
      }

      // Check if download started but file not ready yet
      if (isDownloadStarted()) {
        const downloadedFile = getDownloadedFile();
        if (downloadedFile) {
          return {
            success: true,
            downloadUrl: getDownloadUrl(),
            localFile: downloadedFile,
            platform: platform,
            method: 'getloady_browser_download',
            quality: 'HD',
            service: 'getloady'
          };
        }
      }

      // YouTube-specific: Check for new tabs
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
              quality: 'HD',
              service: 'getloady'
            };
          }
        }
      }

      await this.page.waitForTimeout(2000);
      this.log(`GetLoady attempt ${i + 1}/20...`);
    }

    throw new Error('GetLoady: Timeout after 40 seconds');
  }

  /**
   * TIER 2: SSVid.net - Comprehensive platform support  
   */
  async downloadWithSSVid(url, platform) {
    this.log(`🎯 Tier 2: SSVid download for ${platform}`);
    this.stats.tierUsage.ssvid++;
    
    const { getDownloadUrl, isDownloadStarted, getDownloadedFile } = await this.setupDownloadInterception();
    
    await this.stealthBrowser.navigateTo('https://ssvid.net/en');
    
    // Wait for page load and find search input
    await this.page.waitForSelector('input[role="searchbox"], #search__input, input[type="search"]', { timeout: 10000 });
    
    const searchSelectors = ['input[role="searchbox"]', '#search__input', 'input[type="search"]'];
    let inputFilled = false;
    
    for (const selector of searchSelectors) {
      try {
        await this.stealthBrowser.typeHumanLike(selector, url);
        inputFilled = true;
        this.log(`✏️ SSVid input filled with: ${selector}`);
        break;
      } catch (e) {
        continue;
      }
    }

    if (!inputFilled) {
      throw new Error('SSVid: Could not find search input');
    }

    // Click Start button
    await this.stealthBrowser.clickHumanLike('button:has-text("Start"), button:has-text("Download")');
    this.log('🔘 SSVid: Clicked Start button');

    // Enhanced processing with actual download triggering
    let convertButtonClicked = false;
    
    for (let i = 0; i < 30; i++) {
      // Check for service errors and discontinuation
      try {
        const errorElements = await this.page.$$('text="Error", text="Failed", text="not available", text="unavailable", text="Service discontinued", text="Service is unavailable", text="503", text="500"');
        if (errorElements.length > 0) {
          this.log(`❌ SSVid: Error message detected on page - stopping attempts`);
          throw new Error('SSVid service error detected');
        }
        
        // Check for US discontinuation message (service shut down in US as of May 2024)
        const discontinuedElements = await this.page.$$('text="discontinued", text="terminated", text="attacks by US copyright", text="May 3, 2024"');
        if (discontinuedElements.length > 0) {
          this.log(`❌ SSVid: Service discontinued in this region - stopping attempts`);
          throw new Error('SSVid service discontinued due to copyright restrictions');
        }
      } catch (e) {
        // Continue if we can't check for errors
      }
      // Check for conversion table with quality options and click them ONLY ONCE
      if (!convertButtonClicked) {
        try {
          const convertButtons = await this.page.$$('button:has-text("Convert"), button:has-text("Download")');
          if (convertButtons.length > 0) {
            // Select quality based on preference
            let selectedButton = convertButtons[0]; // Default to first (usually highest)
            
            if (this.config.qualityPreference === 'medium' && convertButtons.length > 1) {
              selectedButton = convertButtons[Math.floor(convertButtons.length / 2)];
            } else if (this.config.qualityPreference === 'lowest') {
              selectedButton = convertButtons[convertButtons.length - 1];
            }
            
            const buttonText = await selectedButton.textContent();
            this.log(`🎬 SSVid: Clicking ${buttonText} button (${this.config.qualityPreference} quality)`);
            await selectedButton.click();
            convertButtonClicked = true;
            
            // Wait for conversion and check for download
            await this.page.waitForTimeout(5000);
            
            const downloadedFile = getDownloadedFile();
            if (downloadedFile) {
              return {
                success: true,
                downloadUrl: getDownloadUrl(),
                localFile: downloadedFile,
                platform: platform,
                method: 'ssvid_browser_download',
                service: 'ssvid'
              };
            }
          }
        } catch (e) {
          // No convert buttons yet
        }
      }

      // Check for direct download links and click them
      const downloadLinks = await this.page.$$('a[href*="download"], a[href*=".mp4"], a[download], button:has-text("Download")');
      for (const link of downloadLinks) {
        try {
          const href = await link.getAttribute('href');
          const tagName = await link.evaluate(el => el.tagName.toLowerCase());
          
          if ((href && this.isValidVideoUrl(href)) || tagName === 'button') {
            this.log(`🔗 SSVid: Clicking download link: ${href || 'button'}`);
            await link.click();
            await this.page.waitForTimeout(3000);
            
            const downloadedFile = getDownloadedFile();
            if (downloadedFile) {
              return {
                success: true,
                downloadUrl: getDownloadUrl() || href,
                localFile: downloadedFile,
                platform: platform,
                method: 'ssvid_browser_download',
                service: 'ssvid'
              };
            }
          }
        } catch (clickError) {
          continue;
        }
      }

      await this.page.waitForTimeout(2000);
      this.log(`SSVid attempt ${i + 1}/25...`);
    }

    throw new Error('SSVid: Timeout after 50 seconds');
  }

  /**
   * TIER 3: Squidlr.com - Fast and clean
   */
  async downloadWithSquidlr(url, platform) {
    if (!this.getSupportedPlatforms('squidlr').includes(platform)) {
      throw new Error(`Squidlr doesn't support ${platform} (but GetLoady and SSVid do support it)`);
    }

    this.log(`🎯 Tier 3: Squidlr download for ${platform}`);
    this.stats.tierUsage.squidlr++;
    
    const { getDownloadUrl, isDownloadStarted, getDownloadedFile } = await this.setupDownloadInterception();
    
    await this.stealthBrowser.navigateTo('https://www.squidlr.com/');
    
    // Wait for Blazor initialization
    await this.stealthBrowser.randomDelay(2000, 4000);
    
    // Fill URL input
    await this.page.waitForSelector('textbox, input[placeholder*="URL"]', { timeout: 10000 });
    await this.stealthBrowser.typeHumanLike('textbox', url);
    this.log('✏️ Squidlr: URL input filled');
    
    // Squidlr auto-processes, wait for redirect
    await this.page.waitForTimeout(3000);
    
    // Enhanced processing detection with better error handling
    for (let i = 0; i < 20; i++) {
      const currentUrl = this.page.url();
      
      // Check for various error conditions
      try {
        const errorElements = await this.page.$$('text="Oh no! Something went wrong", text="Content not found", text="unavailable", text="Error", text="Failed"');
        if (errorElements.length > 0) {
          this.log(`❌ Squidlr: Error message detected - stopping attempts`);
          throw new Error('Squidlr: Content not found or service unavailable');
        }
        
        // Check for Blazor framework errors
        const blazorErrors = await this.page.$$('text="Blazor", text="An unhandled error has occurred"');
        if (blazorErrors.length > 0) {
          this.log(`❌ Squidlr: Blazor framework error detected - stopping attempts`);
          throw new Error('Squidlr: Application framework error');
        }
      } catch (e) {
        if (e.message.includes('Squidlr:')) throw e;
        // Continue if we can't check for errors
      }
      
      // Check for error page
      if (currentUrl.includes('/download')) {
        try {
          const errorElement = await this.page.$('text="Oh no! Something went wrong"');
          if (errorElement) {
            throw new Error('Squidlr: Content not found or unavailable');
          }
        } catch (e) {
          if (e.message.includes('not found')) throw e;
        }

        // Check for download content and click to trigger downloads
        const downloadLinks = await this.page.$$('a[href*="download"], a[href*=".mp4"], a[download], button:has-text("Download")');
        for (const link of downloadLinks) {
          try {
            const href = await link.getAttribute('href');
            const tagName = await link.evaluate(el => el.tagName.toLowerCase());
            
            if ((href && this.isValidVideoUrl(href)) || tagName === 'button') {
              this.log(`🔗 Squidlr: Clicking download link: ${href || 'button'}`);
              await link.click();
              await this.page.waitForTimeout(3000);
              
              const downloadedFile = getDownloadedFile();
              if (downloadedFile) {
                return {
                  success: true,
                  downloadUrl: getDownloadUrl() || href,
                  localFile: downloadedFile,
                  platform: platform,
                  method: 'squidlr_browser_download',
                  service: 'squidlr'
                };
              }
            }
          } catch (clickError) {
            continue;
          }
        }
      }

      const downloadedFile = getDownloadedFile();
      if (downloadedFile) {
        return {
          success: true,
          downloadUrl: getDownloadUrl(),
          localFile: downloadedFile,
          platform: platform,
          method: 'squidlr_browser_download',
          service: 'squidlr'
        };
      }

      await this.page.waitForTimeout(2000);
      this.log(`Squidlr attempt ${i + 1}/20...`);
    }

    throw new Error('Squidlr: Timeout after 40 seconds');
  }

  /**
   * TIER 4: Cobalt.tools - Privacy-focused downloader
   */
  async downloadWithCobalt(url, platform) {
    this.log(`🎯 Tier 4: Cobalt download for ${platform}`);
    this.stats.tierUsage.cobalt++;
    
    const { getDownloadUrl, isDownloadStarted, getDownloadedFile } = await this.setupDownloadInterception();
    
    await this.stealthBrowser.navigateTo('https://cobalt.tools/');
    
    // Wait for Cloudflare and any loading
    await this.stealthBrowser.randomDelay(3000, 7000);
    
    // Fill URL input
    await this.page.waitForSelector('textbox[aria-label*="link input"], input[aria-label*="link input"]', { timeout: 10000 });
    await this.stealthBrowser.typeHumanLike('textbox[aria-label*="link input"]', url);
    this.log('✏️ Cobalt: URL input filled');
    
    // Submit by pressing Enter
    await this.page.press('textbox[aria-label*="link input"]', 'Enter');
    
    // Enhanced processing with error detection
    for (let i = 0; i < 25; i++) {
      // Check for service-specific errors
      try {
        const errorMessages = await this.page.$$('text="downloading is temporarily disabled", text="restrictions from", text="temporarily unavailable", text="Error", text="Failed"');
        if (errorMessages.length > 0) {
          this.log(`❌ Cobalt: Service restriction detected - stopping attempts`);
          throw new Error('Cobalt: Platform downloading temporarily disabled');
        }
        
        // Check for Cloudflare errors
        const cloudflareErrors = await this.page.$$('text="cloudflare", text="checking if you\'re not a bot", text="challenge"');
        if (cloudflareErrors.length > 0 && i > 10) { // Allow some time for Cloudflare to complete
          this.log(`❌ Cobalt: Cloudflare challenge blocking access - stopping attempts`);
          throw new Error('Cobalt: Access blocked by Cloudflare protection');
        }
      } catch (e) {
        if (e.message.includes('Cobalt:')) throw e;
        // Continue if we can't check for errors
      }

      // Check for download ready state
      try {
        const downloadButtons = await this.page.$$('button:has-text("download"), a[href*="download"], a[download]');
        for (const button of downloadButtons) {
          try {
            const buttonText = await button.textContent();
            if (buttonText && buttonText.toLowerCase().includes('download')) {
              this.log(`🔗 Cobalt: Clicking download: ${buttonText}`);
              await button.click();
              await this.page.waitForTimeout(3000);
              
              const downloadedFile = getDownloadedFile();
              if (downloadedFile) {
                return {
                  success: true,
                  downloadUrl: getDownloadUrl(),
                  localFile: downloadedFile,
                  platform: platform,
                  method: 'cobalt_browser_download',
                  service: 'cobalt'
                };
              }
            }
          } catch (clickError) {
            continue;
          }
        }
      } catch (e) {
        // No download buttons yet
      }

      // Check if download started
      const downloadedFile = getDownloadedFile();
      if (downloadedFile) {
        return {
          success: true,
          downloadUrl: getDownloadUrl(),
          localFile: downloadedFile,
          platform: platform,
          method: 'cobalt_browser_download',
          service: 'cobalt'
        };
      }

      await this.page.waitForTimeout(2000);
      this.log(`Cobalt attempt ${i + 1}/25...`);
    }

    throw new Error('Cobalt: Timeout after 50 seconds');
  }

  isValidVideoUrl(url, contentType = '') {
    return url && (
      url.includes('.mp4') ||
      url.includes('.webm') ||
      url.includes('.m4v') ||
      url.includes('.mov') ||
      url.includes('blob:') ||
      url.includes('googlevideo') ||
      contentType.includes('video/') ||
      (url.includes('download') && !url.includes('ko-fi') && !url.includes('support'))
    );
  }

  async downloadWithRetry(url, maxRetries = null, onProgress = null) {
    const retries = maxRetries || this.config.retryAttempts;
    const platform = this.detectPlatform(url);
    
    this.stats.totalAttempts++;
    
    // Progress callback for real-time updates
    const updateProgress = (step, details = {}) => {
      if (onProgress) {
        onProgress({
          step,
          platform,
          url,
          attempt: details.attempt || 1,
          tier: details.tier || 1,
          ...details
        });
      }
    };
    
    updateProgress('detecting_platform', { platform });
    
    if (platform === 'unknown') {
      this.stats.failedDownloads++;
      updateProgress('failed', { error: 'Unsupported platform detected' });
      return {
        success: false,
        error: 'Unsupported platform detected',
        platform: platform,
        url: url
      };
    }

    const tiers = [
      { name: 'GetLoady', fn: () => this.downloadWithGetLoady(url, platform) },
      { name: 'SSVid', fn: () => this.downloadWithSSVid(url, platform) },  
      { name: 'Squidlr', fn: () => this.downloadWithSquidlr(url, platform) },
      { name: 'Cobalt', fn: () => this.downloadWithCobalt(url, platform) }
    ];

    let allErrors = [];
    let attempt = 0;

    updateProgress('starting_download', { totalTiers: tiers.length, totalRetries: retries });

    while (attempt < retries) {
      let attemptErrors = [];
      
      for (let tierIndex = 0; tierIndex < tiers.length; tierIndex++) {
        try {
          updateProgress('attempting_tier', { 
            attempt: attempt + 1, 
            tier: tierIndex + 1, 
            tierName: tiers[tierIndex].name 
          });
          
          this.log(`🔄 Attempt ${attempt + 1}/${retries}, Tier ${tierIndex + 1} (${tiers[tierIndex].name})`);
          
          const result = await tiers[tierIndex].fn();
          if (result.success) {
            this.stats.successfulDownloads++;
            updateProgress('success', { 
              method: result.method, 
              service: result.service, 
              tier: tierIndex + 1,
              downloadUrl: result.downloadUrl
            });
            this.log(`🎉 SUCCESS: ${result.method} (${result.service})`);
            return {
              ...result,
              url: url,
              attempts: attempt + 1,
              tier: tierIndex + 1,
              tierName: tiers[tierIndex].name
            };
          }
        } catch (error) {
          const errorInfo = `Tier ${tierIndex + 1} (${tiers[tierIndex].name}): ${error.message}`;
          attemptErrors.push(errorInfo);
          updateProgress('tier_failed', { 
            tier: tierIndex + 1, 
            tierName: tiers[tierIndex].name, 
            error: error.message 
          });
          this.log(`⚠️ Tier ${tierIndex + 1} (${tiers[tierIndex].name}) failed: ${error.message}`);
          
          // Add delay between tiers
          if (tierIndex < tiers.length - 1) {
            updateProgress('waiting_between_tiers', { nextTier: tierIndex + 2 });
            await new Promise(resolve => setTimeout(resolve, this.config.rateLimitDelay));
          }
        }
      }
      
      allErrors.push(`Attempt ${attempt + 1}: ${attemptErrors.join('; ')}`);
      
      attempt++;
      if (attempt < retries) {
        updateProgress('retrying', { attempt: attempt + 1, delay: this.config.retryDelay });
        this.log(`🔄 Retrying in ${this.config.retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
      }
    }

    this.stats.failedDownloads++;
    updateProgress('failed', { error: `All methods failed after ${retries} attempts` });
    this.log(`💥 All methods failed for ${url}`);
    return {
      success: false,
      error: `All download methods failed after ${retries} attempts. Details: ${allErrors.join(' | ')}`,
      platform: platform,
      url: url,
      attempts: retries
    };
  }

  async batchDownload(urls, concurrency = 3, onBatchProgress = null) {
    this.log(`📦 Starting batch download of ${urls.length} URLs (concurrency: ${concurrency})`);
    
    const results = [];
    const chunks = [];
    let completedCount = 0;
    
    // Split URLs into chunks
    for (let i = 0; i < urls.length; i += concurrency) {
      chunks.push(urls.slice(i, i + concurrency));
    }

    // Batch progress callback
    const updateBatchProgress = (details = {}) => {
      if (onBatchProgress) {
        onBatchProgress({
          completed: completedCount,
          total: urls.length,
          percentage: Math.round((completedCount / urls.length) * 100),
          currentChunk: results.length,
          totalChunks: chunks.length,
          ...details
        });
      }
    };

    updateBatchProgress({ status: 'starting' });

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      updateBatchProgress({ status: 'processing_chunk', chunkIndex: chunkIndex + 1 });
      
      // Create promises for each URL in the chunk with individual progress tracking
      const chunkPromises = chunk.map((url, urlIndex) => 
        this.downloadWithRetry(url, null, (progress) => {
          // Individual download progress can be tracked here if needed
          updateBatchProgress({ 
            status: 'downloading', 
            currentUrl: url, 
            urlProgress: progress,
            chunkIndex: chunkIndex + 1,
            urlIndex: urlIndex + 1
          });
        })
      );
      
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
      completedCount += chunk.length;
      
      updateBatchProgress({ 
        status: 'chunk_complete', 
        chunkIndex: chunkIndex + 1,
        chunkResults: chunkResults.filter(r => r.success).length 
      });
      
      // Rate limiting between chunks
      if (chunkIndex < chunks.length - 1) {
        updateBatchProgress({ status: 'waiting_between_chunks' });
        await new Promise(resolve => setTimeout(resolve, this.config.rateLimitDelay * 2));
      }
    }

    const successCount = results.filter(r => r.success).length;
    updateBatchProgress({ status: 'completed', successCount, failureCount: results.length - successCount });
    this.log(`📦 Batch complete: ${successCount}/${results.length} successful`);
    return results;
  }

  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalAttempts > 0 ? 
        (this.stats.successfulDownloads / this.stats.totalAttempts * 100).toFixed(2) + '%' : '0%'
    };
  }

  async close() {
    if (this.stealthBrowser) {
      await this.stealthBrowser.close();
    }
    this.log('🔴 Stealth downloader closed');
  }
}

// Usage example with progress tracking
async function testComprehensiveDownloader() {
  const downloader = new ComprehensiveDownloaderSuite({
    headless: false,
    qualityPreference: 'highest',
    enableLogging: true,
    retryAttempts: 2
  });
  
  try {
    await downloader.initialize();
    
    // Test single download with progress tracking
    console.log('🧪 Testing single download with progress tracking...');
    const singleResult = await downloader.downloadWithRetry(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      null,
      (progress) => {
        console.log(`📈 Progress: ${progress.step} - ${progress.tierName || ''} (Tier ${progress.tier || 'N/A'})`);
      }
    );
    
    console.log(`Single download result: ${singleResult.success ? '✅' : '❌'}`);
    
    // Test batch download with progress tracking
    console.log('\n🧪 Testing batch download with progress tracking...');
    const testUrls = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://vimeo.com/76979871',
      'https://www.reddit.com/r/videos/comments/15hwrmo/party/'
    ];

    const results = await downloader.batchDownload(testUrls, 2, (batchProgress) => {
      console.log(`📦 Batch: ${batchProgress.percentage}% (${batchProgress.completed}/${batchProgress.total}) - ${batchProgress.status}`);
    });
    
    console.log('\\n📊 Final Results:');
    results.forEach((result, i) => {
      console.log(`${i + 1}. ${result.success ? '✅' : '❌'} ${result.url}`);
      if (result.success) {
        console.log(`   Tier: ${result.tier} (${result.tierName}) | Method: ${result.method} | Quality: ${result.quality || 'Unknown'}`);
        console.log(`   Download URL: ${result.downloadUrl?.substring(0, 80)}...`);
      } else {
        console.log(`   Error: ${result.error}`);
      }
    });

    console.log('\\n📈 Statistics:', downloader.getStats());
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await downloader.close();
  }
}

if (require.main === module) {
  testComprehensiveDownloader();
}

module.exports = ComprehensiveDownloaderSuite;