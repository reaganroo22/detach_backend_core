/**
 * Advanced Stealth Configuration for Undetected Browser Automation
 * 
 * Combines Patchright, 2Captcha, and advanced anti-detection techniques
 * to create completely undetectable browser automation for Detach
 */

const { chromium } = require('patchright');
const UserAgent = require('user-agents');
const axios = require('axios');
const Solver = require('@2captcha/captcha-solver');

class StealthBrowserManager {
  constructor(options = {}) {
    this.config = {
      headless: options.headless !== false ? 'new' : false,
      captchaSolver: null,
      enableCaptchaSolving: options.enableCaptchaSolving !== false,
      userAgent: null,
      viewport: null,
      enableLogging: options.enableLogging !== false,
      downloadPath: options.downloadPath || './downloads',
      ...options
    };

    // Initialize 2Captcha solver if API key provided
    if (process.env.CAPTCHA_API_KEY && this.config.enableCaptchaSolving) {
      this.config.captchaSolver = new Solver(process.env.CAPTCHA_API_KEY);
      this.log('🔓 2Captcha solver initialized');
    }

    this.browser = null;
    this.page = null;
    this.log = this.config.enableLogging ? console.log : () => {};
  }

  /**
   * Generate realistic browser fingerprint
   */
  generateFingerprint() {
    const userAgent = new UserAgent({ deviceCategory: 'desktop' });
    const agent = userAgent.toString();
    
    // Generate realistic viewport sizes
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
      { width: 1536, height: 864 },
      { width: 1280, height: 720 }
    ];
    
    const viewport = viewports[Math.floor(Math.random() * viewports.length)];
    
    return { userAgent: agent, viewport };
  }

  /**
   * Advanced stealth browser launch configuration
   */
  async launch() {
    this.log('🚀 Launching stealth browser with Patchright...');
    
    const fingerprint = this.generateFingerprint();
    this.config.userAgent = fingerprint.userAgent;
    this.config.viewport = fingerprint.viewport;

    // Advanced stealth arguments
    const stealthArgs = [
      // Core stealth
      '--no-sandbox',
      '--disable-setuid-sandbox', 
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=VizDisplayCompositor',
      
      // Anti-detection
      '--disable-web-security',
      '--disable-features=TranslateUI',
      '--disable-extensions',
      '--disable-plugins',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-client-side-phishing-detection',
      '--disable-component-update',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-domain-reliability',
      '--disable-ipc-flooding-protection',
      
      // Performance and stealth
      '--no-first-run',
      '--no-default-browser-check',
      '--password-store=basic',
      '--use-mock-keychain',
      '--memory-pressure-off',
      '--aggressive-cache-discard',
      '--max_old_space_size=4096',
      '--shm-size=2gb',
      
      // Advanced fingerprint evasion
      '--disable-features=WebRTC',
      '--disable-webgl',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--force-color-profile=srgb',
      '--disable-logging',
      '--silent',
      
      // User agent and window matching
      `--user-agent=${this.config.userAgent}`,
      `--window-size=${this.config.viewport.width},${this.config.viewport.height}`
    ];

    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: stealthArgs,
      ignoreDefaultArgs: ['--enable-automation', '--enable-blink-features=AutomationControlled'],
      env: {
        ...process.env,
        DISPLAY: ':99' // For headless environments
      }
    });

    this.page = await this.browser.newPage();
    
    // Set realistic headers
    await this.page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0'
    });

    // Set viewport and user agent
    await this.page.setViewportSize(this.config.viewport);
    await this.page.setUserAgent(this.config.userAgent);

    // Advanced anti-detection scripts
    await this.page.addInitScript(() => {
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Override permissions API
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );

      // Mock plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Mock languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Override chrome runtime
      window.chrome = {
        runtime: {
          onConnect: undefined,
          onMessage: undefined,
        },
      };

      // Mock WebGL vendor and renderer
      const getParameter = WebGLRenderingContext.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) {
          return 'Intel Inc.';
        }
        if (parameter === 37446) {
          return 'Intel Iris OpenGL Engine';
        }
        return getParameter(parameter);
      };

      // Override setTimeout to add randomness
      const originalSetTimeout = window.setTimeout;
      window.setTimeout = function(callback, delay) {
        const randomDelay = delay + Math.random() * 100;
        return originalSetTimeout(callback, randomDelay);
      };
    });

    this.log(`✅ Stealth browser launched: ${this.config.userAgent}`);
    this.log(`📐 Viewport: ${this.config.viewport.width}x${this.config.viewport.height}`);
    
    return this.page;
  }

  /**
   * Human-like navigation with random delays
   */
  async navigateTo(url, options = {}) {
    this.log(`🌐 Navigating to: ${url}`);
    
    // Add random delay before navigation
    await this.randomDelay(500, 2000);
    
    try {
      await this.page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000,
        ...options
      });
      
      // Random delay after navigation
      await this.randomDelay(1000, 3000);
      
      // Check for Cloudflare challenge
      await this.handleCloudflareChallenge();
      
    } catch (error) {
      this.log(`❌ Navigation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle Cloudflare Turnstile challenges automatically
   */
  async handleCloudflareChallenge() {
    try {
      // Check for Cloudflare challenge indicators
      const challengeSelectors = [
        'input[name="cf-turnstile-response"]',
        '[data-sitekey]',
        '.cf-turnstile',
        '#challenge-stage',
        '.challenge-container'
      ];

      let challengeFound = false;
      let sitekey = null;

      for (const selector of challengeSelectors) {
        const element = await this.page.$(selector);
        if (element) {
          challengeFound = true;
          
          // Try to extract sitekey
          if (selector.includes('turnstile') || selector.includes('sitekey')) {
            sitekey = await element.getAttribute('data-sitekey') || 
                     await element.getAttribute('data-cf-turnstile-sitekey');
          }
          break;
        }
      }

      if (challengeFound && this.config.captchaSolver) {
        this.log('🔓 Cloudflare challenge detected, solving...');
        
        // Extract sitekey from page if not found
        if (!sitekey) {
          sitekey = await this.page.evaluate(() => {
            const scripts = Array.from(document.scripts);
            for (const script of scripts) {
              const match = script.textContent.match(/sitekey['":\s]*([a-zA-Z0-9_-]+)/);
              if (match) return match[1];
            }
            return null;
          });
        }

        if (sitekey) {
          const solution = await this.solveTurnstile(this.page.url(), sitekey);
          
          if (solution) {
            // Inject solution token
            await this.page.evaluate((token) => {
              const input = document.querySelector('input[name="cf-turnstile-response"]') ||
                           document.querySelector('input[data-callback]');
              if (input) {
                input.value = token;
                // Trigger change event
                input.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }, solution);

            // Submit form or click continue
            const submitButton = await this.page.$('input[type="submit"], button[type="submit"], .challenge-form button');
            if (submitButton) {
              await submitButton.click();
              await this.page.waitForTimeout(3000);
            }

            this.log('✅ Cloudflare challenge solved successfully');
          }
        }
      }
    } catch (error) {
      this.log(`⚠️ Challenge handling error: ${error.message}`);
    }
  }

  /**
   * Solve Cloudflare Turnstile using 2Captcha
   */
  async solveTurnstile(pageUrl, sitekey) {
    if (!this.config.captchaSolver) {
      this.log('⚠️ No captcha solver available');
      return null;
    }

    try {
      this.log(`🧩 Solving Turnstile: ${sitekey}`);
      
      const result = await this.config.captchaSolver.cloudflareTurnstile({
        pageurl: pageUrl,
        sitekey: sitekey
      });

      this.log('✅ Turnstile solved successfully');
      return result.data;
    } catch (error) {
      this.log(`❌ Captcha solving failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Human-like typing with random delays
   */
  async typeHumanLike(selector, text) {
    const element = await this.page.waitForSelector(selector, { timeout: 10000 });
    
    // Clear existing content
    await element.selectText();
    await this.randomDelay(100, 300);
    
    // Type with human-like speed
    for (const char of text) {
      await element.type(char);
      await this.randomDelay(50, 150);
    }
    
    await this.randomDelay(200, 500);
  }

  /**
   * Human-like clicking with random coordinates
   */
  async clickHumanLike(selector) {
    const element = await this.page.waitForSelector(selector, { timeout: 10000 });
    
    // Get element bounds
    const box = await element.boundingBox();
    
    // Click at random position within element
    const x = box.x + Math.random() * box.width;
    const y = box.y + Math.random() * box.height;
    
    await this.randomDelay(100, 300);
    await this.page.mouse.click(x, y);
    await this.randomDelay(200, 500);
  }

  /**
   * Random delay to mimic human behavior
   */
  async randomDelay(min = 1000, max = 3000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await this.page.waitForTimeout(delay);
  }

  /**
   * Setup download interception with enhanced handling
   */
  async setupDownloadInterception() {
    let downloadUrl = null;
    let downloadStarted = false;
    let downloadedFilePath = null;
    const interceptedUrls = new Set();

    this.page.on('download', async download => {
      downloadUrl = download.url();
      downloadStarted = true;
      interceptedUrls.add(downloadUrl);
      this.log(`📥 Download intercepted: ${downloadUrl}`);
      
      try {
        const filename = `stealth_download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`;
        const path = require('path');
        const filePath = path.join(this.config.downloadPath, filename);
        
        await download.saveAs(filePath);
        downloadedFilePath = filePath;
        this.log(`💾 File saved via stealth browser: ${filePath}`);
      } catch (saveError) {
        this.log(`⚠️ Browser save failed: ${saveError.message}`);
        await download.cancel();
      }
    });

    this.page.on('response', response => {
      const responseUrl = response.url();
      const contentType = response.headers()['content-type'] || '';
      
      if (this.isValidVideoUrl(responseUrl, contentType) && !interceptedUrls.has(responseUrl)) {
        downloadUrl = responseUrl;
        downloadStarted = true;
        interceptedUrls.add(responseUrl);
        this.log(`🎬 Video URL intercepted: ${responseUrl}`);
      }
    });

    return { 
      getDownloadUrl: () => downloadUrl, 
      isDownloadStarted: () => downloadStarted,
      getDownloadedFile: () => downloadedFilePath,
      getAllUrls: () => Array.from(interceptedUrls)
    };
  }

  /**
   * Check if URL is a valid video URL
   */
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

  /**
   * Clean shutdown
   */
  async close() {
    if (this.page) {
      await this.page.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
    this.log('🔴 Stealth browser closed');
  }
}

module.exports = StealthBrowserManager;