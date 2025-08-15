const express = require('express');
const { chromium } = require('playwright');
const cors = require('cors');
const axios = require('axios');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Platform detection and routing
const detectPlatform = (url) => {
  const cleanUrl = url.split('?')[0]; // Remove UTM parameters
  
  if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) return 'youtube';
  if (cleanUrl.includes('instagram.com')) return 'instagram';
  if (cleanUrl.includes('facebook.com') || cleanUrl.includes('fb.watch')) return 'facebook';
  if (cleanUrl.includes('tiktok.com')) return 'tiktok';
  if (cleanUrl.includes('twitter.com') || cleanUrl.includes('x.com')) return 'twitter';
  if (cleanUrl.includes('linkedin.com')) return 'linkedin';
  if (cleanUrl.includes('pinterest.com')) return 'pinterest';
  if (cleanUrl.includes('soundcloud.com')) return 'soundcloud';
  if (cleanUrl.includes('vimeo.com')) return 'vimeo';
  if (cleanUrl.includes('dailymotion.com')) return 'dailymotion';
  if (cleanUrl.includes('reddit.com')) return 'reddit';
  if (cleanUrl.includes('9gag.com')) return '9gag';
  
  return 'unknown';
};

// Browser configuration - Use local Chrome browsers for better reliability
const getBrowserConfig = () => {
  // Check if we have a custom browserless URL
  if (process.env.BROWSERLESS_URL) {
    console.log('🌐 Using custom Browserless service:', process.env.BROWSERLESS_URL);
    return {
      wsEndpoint: process.env.BROWSERLESS_URL
    };
  }
  
  // Default: Use local Chrome/Chromium browser for both development and production
  console.log('💻 Using local Chrome browser (reliable for all environments)');
  
  // Docker vs local environment
  const isDocker = process.env.NODE_ENV === 'production' || fs.existsSync('/.dockerenv');
  
  if (isDocker) {
    console.log('🐳 Docker environment detected - using system Chromium');
    return {
      executablePath: '/usr/bin/chromium',
      headless: false, // Non-headless for testing and debugging
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--mute-audio',
        '--disable-background-networking',
        '--disable-sync',
        '--metrics-recording-only',
        '--disable-default-apps'
      ]
    };
  } else {
    console.log('💻 Local development - using system Chrome with anti-detection');
    return {
      headless: false, // Non-headless for better success rates
      args: [
        // Anti-detection arguments
        '--disable-blink-features=AutomationControlled',
        '--exclude-switches=enable-automation',
        '--disable-extensions-except',
        '--disable-plugins-discovery',
        '--disable-web-security',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI,VizDisplayCompositor',
        '--disable-ipc-flooding-protection',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-default-apps',
        '--disable-component-extensions-with-background-pages',
        '--disable-client-side-phishing-detection',
        '--disable-hang-monitor',
        '--disable-popup-blocking',
        '--disable-prompt-on-repost',
        '--disable-domain-reliability',
        '--disable-component-update',
        '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
      ]
    };
  }
};

// Tier 1: GetLoady
async function tryGetLoady(url, platform, userPrefs = {}) {
  console.log(`🔄 Tier 1: Trying GetLoady for ${platform}...`);
  console.log(`⚙️ User Preferences: ${userPrefs.format} quality, ${userPrefs.audioQuality} audio, ${userPrefs.videoQuality} video`);
  
  let browser;
  try {
    const browserConfig = getBrowserConfig();
    console.log('🌐 Browser config:', JSON.stringify(browserConfig, null, 2));
    
    browser = browserConfig.wsEndpoint 
      ? await chromium.connect(browserConfig.wsEndpoint)
      : await chromium.launch(browserConfig);
    
    console.log('✅ Browser launched successfully');
  } catch (error) {
    console.error('❌ Browser launch failed:', error.message);
    return { success: false, error: `Browser launch failed: ${error.message}` };
  }
  
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: ['geolocation'],
      geolocation: { latitude: 40.7128, longitude: -74.0060 },
      colorScheme: 'light',
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    const page = await context.newPage();
    
    // Anti-detection JavaScript injection
    await page.addInitScript(() => {
      // Override the navigator.webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // Mock permissions
      const originalQuery = window.navigator.permissions.query;
      return window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
      
      // Override plugins length
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      
      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
      
      // Mock chrome object
      window.chrome = {
        runtime: {},
      };
    });
    const capturedUrls = [];
    
    // Monitor both new tabs (Google Video URLs) and downloads (direct files)
    context.on('page', async (newPage) => {
      await newPage.waitForLoadState('networkidle').catch(() => {});
      const newUrl = newPage.url();
      if (newUrl.includes('googlevideo')) {
        console.log('🎯 Google Video URL found in new tab!');
        capturedUrls.push({
          tier: 1,
          source: 'getloady',
          type: 'google_video',
          url: newUrl,
          quality: 'auto',
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Monitor downloads (for Instagram and other platforms)
    page.on('download', async download => {
      console.log('📥 GetLoady: Download file intercepted!');
      
      // Save download to backend storage
      const filename = download.suggestedFilename();
      const downloadPath = path.join(__dirname, 'downloads', filename);
      
      try {
        await download.saveAs(downloadPath);
        console.log(`💾 GetLoady: File saved to ${downloadPath}`);
        
        // Return backend URL instead of blob URL
        const baseUrl = process.env.RAILWAY_STATIC_URL || process.env.PUBLIC_URL || 'https://detach-backend-core.fly.dev';
        const backendUrl = `${baseUrl}/file/${filename}`;
        
        capturedUrls.push({
          tier: 1,
          source: 'getloady',
          type: 'download_file',
          url: backendUrl,
          filename: filename,
          localPath: downloadPath,
          timestamp: new Date().toISOString()
        });
      } catch (saveError) {
        console.log('❌ GetLoady: Download save failed:', saveError.message);
        // Fallback to original blob URL
        capturedUrls.push({
          tier: 1,
          source: 'getloady',
          type: 'download_file',
          url: download.url(),
          filename: filename,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Navigate to GetLoady platform page
    await page.goto(`https://getloady.com/${platform}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    // Input URL - try multiple selectors
    const inputSelectors = [
      '#search__input',
      'input[type="text"]',
      'input[placeholder*="URL"]',
      'input[placeholder*="url"]',
      'input[name="url"]',
      '.search-input',
      '#url-input'
    ];
    
    let inputFound = false;
    for (const selector of inputSelectors) {
      try {
        const input = await page.locator(selector);
        await input.click({ timeout: 2000 });
        await input.fill('');
        await input.fill(url);
        await page.waitForTimeout(1000);
        console.log(`✅ GetLoady: URL input successful with selector: ${selector}`);
        inputFound = true;
        break;
      } catch (e) {
        console.log(`⚠️ GetLoady: Selector ${selector} failed, trying next...`);
        continue;
      }
    }
    
    if (!inputFound) {
      throw new Error('Could not find URL input field on GetLoady');
    }
    
    // Click Start button - try multiple selectors
    const startSelectors = [
      'button:has-text("Start")',
      'button:has-text("start")',
      'input[type="submit"]',
      'button[type="submit"]',
      '.btn-start',
      '.start-btn',
      'button'
    ];
    
    let startClicked = false;
    for (const selector of startSelectors) {
      try {
        await page.click(selector, { timeout: 2000 });
        console.log(`✅ GetLoady: Start button clicked with selector: ${selector}`);
        startClicked = true;
        break;
      } catch (e) {
        console.log(`⚠️ GetLoady: Start selector ${selector} failed, trying next...`);
        continue;
      }
    }
    
    if (!startClicked) {
      throw new Error('Could not find Start button on GetLoady');
    }
    
    await page.waitForTimeout(8000);
    
    // Look for Download button and click (specifically "Download" not just any button)
    // But stop if we already captured content
    const downloadSelectors = [
      'button:has-text("Download")',
      'button:has-text("download")',
      'a:has-text("Download")',
      '.download-btn',
      '.btn-download'
    ];
    
    let downloadClicked = false;
    if (capturedUrls.length === 0) {
      for (const selector of downloadSelectors) {
        try {
          const downloadBtn = await page.locator(selector).first();
          if (await downloadBtn.isVisible()) {
            await downloadBtn.click();
            console.log(`✅ GetLoady: Download button clicked with selector: ${selector}`);
            downloadClicked = true;
            await page.waitForTimeout(5000);
            break;
          }
        } catch (e) {
          console.log(`⚠️ GetLoady: Download selector ${selector} failed, trying next...`);
          continue;
        }
      }
    } else {
      console.log('✅ GetLoady: Content already captured, skipping download button');
    }
    
    if (!downloadClicked) {
      console.log('⚠️ GetLoady: No Download button found');
    }
    
    // Wait up to 45 seconds for new tab with Google Video URL or download files
    if (downloadClicked || capturedUrls.length > 0) {
      console.log('⏳ GetLoady: Waiting for Google Video URL or download files...');
      const maxWaitTime = 45000; // 45 seconds
      const checkInterval = 3000; // 3 seconds
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWaitTime && capturedUrls.length === 0) {
        await page.waitForTimeout(checkInterval);
        console.log(`⏳ GetLoady: Still waiting for content... (${Math.round((Date.now() - startTime) / 1000)}s)`);
      }
      
      if (capturedUrls.length > 0) {
        console.log('🎯 GetLoady: Content successfully captured!');
      } else {
        console.log('⚠️ GetLoady: Timeout waiting for content');
      }
    }
    
    await browser.close();
    
    if (capturedUrls.length > 0) {
      console.log('✅ Tier 1 SUCCESS: GetLoady');
      return { success: true, data: capturedUrls };
    }
    
    console.log('❌ Tier 1 FAILED: GetLoady');
    return { success: false };
    
  } catch (error) {
    await browser.close();
    console.log('❌ Tier 1 ERROR:', error.message);
    return { success: false, error: error.message };
  }
}

// Tier 2: SSVid.net
async function trySSVid(url, userPrefs = {}) {
  console.log('🔄 Tier 2: Trying SSVid.net...');
  
  const browserConfig = getBrowserConfig();
  const browser = browserConfig.wsEndpoint 
    ? await chromium.connect(browserConfig.wsEndpoint)
    : await chromium.launch(browserConfig);
  
  try {
    const page = await browser.newPage();
    const capturedUrls = [];
    
    // Monitor downloads
    page.on('download', async download => {
      console.log('📥 SSVid: Download intercepted:', download.url());
      
      // Save download to backend storage
      const filename = download.suggestedFilename();
      const downloadPath = path.join(__dirname, 'downloads', filename);
      
      try {
        await download.saveAs(downloadPath);
        console.log(`💾 SSVid: File saved to ${downloadPath}`);
        
        // Return backend URL instead of original URL
        const baseUrl = process.env.RAILWAY_STATIC_URL || process.env.PUBLIC_URL || 'https://detach-backend-core.fly.dev';
        const backendUrl = `${baseUrl}/file/${filename}`;
        
        capturedUrls.push({
          tier: 2,
          source: 'ssvid',
          type: 'download_file',
          url: backendUrl,
          filename: filename,
          localPath: downloadPath,
          timestamp: new Date().toISOString()
        });
      } catch (saveError) {
        console.log('❌ SSVid: Download save failed:', saveError.message);
        // Fallback to original URL
        capturedUrls.push({
          tier: 2,
          source: 'ssvid',
          type: 'download_file',
          url: download.url(),
          filename: filename,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    await page.goto('https://ssvid.net/en', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Input URL using proper selector from codegen
    console.log('🔍 SSVid: Looking for searchbox...');
    await page.getByRole('searchbox', { name: 'Search' }).click();
    console.log('✅ SSVid: Found and clicked searchbox');
    
    await page.getByRole('searchbox', { name: 'Search' }).fill(url);
    console.log('✅ SSVid: Filled URL:', url);
    await page.waitForTimeout(1000);
    
    // Click Start button
    console.log('🔍 SSVid: Looking for Start button...');
    await page.getByRole('button', { name: 'Start' }).click();
    console.log('✅ SSVid: Start button clicked');
    await page.waitForTimeout(8000);
    
    // Click Convert button - use the specific row selector from codegen
    console.log('🔍 SSVid: Looking for Convert button...');
    const convertButton = page.getByRole('row', { name: 'MP4 auto quality (MB) Convert' }).getByRole('button');
    
    if (await convertButton.isVisible()) {
      await convertButton.click();
      console.log('✅ SSVid: Convert button clicked');
    }
    
    // Always look for download button (whether convert was clicked or not)
    console.log('🔍 SSVid: Looking for Download button...');
    const maxWaitTime = 150000; // 2.5 minutes
    const checkInterval = 15000; // 15 seconds
      const startTime = Date.now();
      
    let downloadClicked = false;
    while (Date.now() - startTime < maxWaitTime && !downloadClicked) {
      // Look for download links and buttons using multiple selectors
      const downloadSelectors = [
        'a:has-text("Download")',
        'button:has-text("Download")', 
        '.btn:has-text("Download")',
        'a[download]',
        'a[href*=".mp4"]',
        'a[href*=".mp3"]'
      ];
      
      for (const selector of downloadSelectors) {
        try {
          const downloadBtn = await page.locator(selector).first();
          if (await downloadBtn.isVisible()) {
            console.log(`✅ SSVid: Found download button with selector: ${selector}`);
            await downloadBtn.click();
            downloadClicked = true;
            await page.waitForTimeout(5000);
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      if (!downloadClicked) {
        console.log(`⏳ SSVid: Still waiting for download button... (${Math.round((Date.now() - startTime) / 1000)}s)`);
        await page.waitForTimeout(checkInterval);
      }
    }
    }
    
    await browser.close();
    
    if (capturedUrls.length > 0) {
      console.log('✅ Tier 2 SUCCESS: SSVid.net');
      return { success: true, data: capturedUrls };
    }
    
    console.log('❌ Tier 2 FAILED: SSVid.net');
    return { success: false };
    
  } catch (error) {
    await browser.close();
    console.log('❌ Tier 2 ERROR:', error.message);
    return { success: false, error: error.message };
  }
}

// Tier 3: Squidlr.com
async function trySquidlr(url, platform, userPrefs = {}) {
  console.log(`🔄 Tier 3: Trying Squidlr for ${platform}...`);
  
  // Squidlr doesn't support YouTube
  if (platform === 'youtube') {
    console.log('⚠️ Tier 3 SKIPPED: Squidlr does not support YouTube');
    return { success: false, reason: 'platform_not_supported' };
  }
  
  const browserConfig = getBrowserConfig();
  const browser = browserConfig.wsEndpoint 
    ? await chromium.connect(browserConfig.wsEndpoint)
    : await chromium.launch(browserConfig);
  
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: ['geolocation'],
      geolocation: { latitude: 40.7128, longitude: -74.0060 },
      colorScheme: 'light',
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    const page = await context.newPage();
    
    // Anti-detection JavaScript injection
    await page.addInitScript(() => {
      // Override the navigator.webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // Mock permissions
      const originalQuery = window.navigator.permissions.query;
      return window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
      
      // Override plugins length
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      
      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
      
      // Mock chrome object
      window.chrome = {
        runtime: {},
      };
    });
    const capturedUrls = [];
    
    // Monitor downloads and new tabs
    page.on('download', async download => {
      console.log('📥 Squidlr: Download intercepted:', download.url());
      
      // Save download to backend storage
      const filename = download.suggestedFilename();
      const downloadPath = path.join(__dirname, 'downloads', filename);
      
      try {
        await download.saveAs(downloadPath);
        console.log(`💾 Squidlr: File saved to ${downloadPath}`);
        
        // Return backend URL instead of original URL
        const baseUrl = process.env.RAILWAY_STATIC_URL || process.env.PUBLIC_URL || 'https://detach-backend-core.fly.dev';
        const backendUrl = `${baseUrl}/file/${filename}`;
        
        capturedUrls.push({
          tier: 3,
          source: 'squidlr',
          type: 'download_file',
          url: backendUrl,
          filename: filename,
          localPath: downloadPath,
          timestamp: new Date().toISOString()
        });
      } catch (saveError) {
        console.log('❌ Squidlr: Download save failed:', saveError.message);
        // Fallback to original URL
        capturedUrls.push({
          tier: 3,
          source: 'squidlr',
          type: 'download_file',
          url: download.url(),
          filename: filename,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    context.on('page', async (newPage) => {
      await newPage.waitForLoadState('networkidle').catch(() => {});
      const newUrl = newPage.url();
      if (newUrl.includes('.mp4') || newUrl.includes('.mp3') || newUrl.includes('download')) {
        capturedUrls.push({
          tier: 3,
          source: 'squidlr',
          type: 'new_tab_download',
          url: newUrl,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    await page.goto(`https://squidlr.com/${platform}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);
    
    // Input URL using proper selector from codegen
    console.log('🔍 Looking for Download URL textbox...');
    await page.getByRole('textbox', { name: 'Download URL' }).click();
    console.log('✅ Found and clicked Download URL textbox');
    
    await page.getByRole('textbox', { name: 'Download URL' }).fill(url);
    console.log('✅ Filled URL:', url);
    
    await page.waitForTimeout(2000);
    
    // Wait for URL processing and download buttons to appear  
    console.log('🔍 Squidlr: Waiting for URL processing...');
    const maxWait = 120000; // 2 minutes
    const checkInterval = 5000; // 5 seconds
    const startTime = Date.now();
    
    let downloadProcessed = false;
    while (Date.now() - startTime < maxWait && !downloadProcessed) {
      // Look for resolution buttons (like "Best resolution 576 x 1024")
      const resolutionButtons = await page.locator('button').filter({ hasText: /Best resolution|resolution|\d+x\d+/i });
      const buttonCount = await resolutionButtons.count();
      
      if (buttonCount > 0) {
        console.log(`✅ Squidlr: Found ${buttonCount} resolution buttons`);
        
        // Click the first (best) resolution button  
        await resolutionButtons.first().click();
        console.log('✅ Squidlr: Clicked resolution button');
        downloadProcessed = true;
        break;
      }
      
      // Check if download button is enabled (not disabled)
      const downloadButtons = await page.locator('button').filter({ hasText: /download/i });
      const dlButtonCount = await downloadButtons.count();
      
      if (dlButtonCount > 0) {
        const firstBtn = downloadButtons.first();
        const isEnabled = await firstBtn.isEnabled();
        
        if (isEnabled) {
          console.log('✅ Squidlr: Found enabled download button');
          await firstBtn.click();
          console.log('✅ Squidlr: Clicked download button');
          downloadProcessed = true;
          break;
        } else {
          console.log(`⏳ Squidlr: Download button still disabled, waiting... (${Math.round((Date.now() - startTime) / 1000)}s)`);
        }
      }
      
      if (!downloadProcessed) {
        await page.waitForTimeout(checkInterval);
      }
    }
    
    // Check for download links on final page
    const downloadLinks = await page.$$eval('a[download], a[href*=".mp4"], a[href*=".mp3"]', links => 
      links.map(link => ({ 
        href: link.href, 
        text: link.textContent?.trim(),
        download: link.download 
      }))
    ).catch(() => []);
    
    if (downloadLinks.length > 0) {
      downloadLinks.forEach(link => {
        capturedUrls.push({
          tier: 3,
          source: 'squidlr',
          type: 'download_link',
          url: link.href,
          quality: link.text?.includes('Best') ? 'high' : 
                   link.text?.includes('Medium') ? 'medium' : 'low',
          timestamp: new Date().toISOString()
        });
      });
    }
    
    await browser.close();
    
    if (capturedUrls.length > 0) {
      console.log('✅ Tier 3 SUCCESS: Squidlr');
      return { success: true, data: capturedUrls };
    }
    
    console.log('❌ Tier 3 FAILED: Squidlr');
    return { success: false };
    
  } catch (error) {
    await browser.close();
    console.log('❌ Tier 3 ERROR:', error.message);
    return { success: false, error: error.message };
  }
}

// Tier 4: Railway Backend (yt-dlp implementation)
async function tryRailwayBackend(url, userPrefs = {}) {
  console.log('🔄 Tier 4: Trying Railway backend...');
  console.log(`⚙️ Passing user preferences: ${userPrefs.format} format, ${userPrefs.audioQuality}/${userPrefs.videoQuality} quality`);
  
  try {
    const railwayUrl = 'https://detachbackend-production.up.railway.app';
    
    const response = await axios.post(`${railwayUrl}/download`, {
      url: url,
      format: userPrefs.format,
      audioQuality: userPrefs.audioQuality,
      videoQuality: userPrefs.videoQuality,
      maxFileSize: userPrefs.maxFileSize
    }, {
      timeout: 60000, // 60 second timeout
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Universal-Downloader-Client/1.0'
      }
    });
    
    if (response.data && response.data.success) {
      console.log('✅ Tier 4 SUCCESS: Railway backend');
      
      // Format Railway response to match our structure
      const formattedData = [{
        tier: 4,
        source: 'railway',
        type: 'yt_dlp_download',
        url: response.data.download_url || response.data.url,
        title: response.data.title,
        format: response.data.format,
        quality: response.data.quality,
        filesize: response.data.filesize,
        timestamp: new Date().toISOString()
      }];
      
      return { success: true, data: formattedData, raw: response.data };
    }
    
    console.log('❌ Tier 4 FAILED: Railway backend - no success flag');
    return { success: false, error: 'Railway backend returned unsuccessful response' };
    
  } catch (error) {
    console.log('❌ Tier 4 ERROR:', error.message);
    return { success: false, error: error.message };
  }
}

// Tier 5: Vercel Backend (yt-dlp implementation)
async function tryVercelBackend(url, userPrefs = {}) {
  console.log('🔄 Tier 5: Trying Vercel backend...');
  console.log(`⚙️ Passing user preferences: ${userPrefs.format} format, ${userPrefs.audioQuality}/${userPrefs.videoQuality} quality`);
  
  try {
    const vercelUrl = 'https://detach-backend-454ebn3bh-detach1.vercel.app';
    
    const response = await axios.post(`${vercelUrl}/download`, {
      url: url,
      format: userPrefs.format,
      audioQuality: userPrefs.audioQuality,
      videoQuality: userPrefs.videoQuality,
      maxFileSize: userPrefs.maxFileSize
    }, {
      timeout: 60000, // 60 second timeout
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Universal-Downloader-Client/1.0'
      }
    });
    
    if (response.data && response.data.success) {
      console.log('✅ Tier 5 SUCCESS: Vercel backend');
      
      // Format Vercel response to match our structure
      const formattedData = [{
        tier: 5,
        source: 'vercel',
        type: 'yt_dlp_download',
        url: response.data.download_url || response.data.url,
        title: response.data.title,
        format: response.data.format,
        quality: response.data.quality,
        filesize: response.data.filesize,
        timestamp: new Date().toISOString()
      }];
      
      return { success: true, data: formattedData, raw: response.data };
    }
    
    console.log('❌ Tier 5 FAILED: Vercel backend - no success flag');
    return { success: false, error: 'Vercel backend returned unsuccessful response' };
    
  } catch (error) {
    console.log('❌ Tier 5 ERROR:', error.message);
    return { success: false, error: error.message };
  }
}

// Tier 6: Local yt-dlp Backend (final fallback)
async function tryLocalYtDlp(url, userPrefs = {}) {
  console.log('🔄 Tier 6: Trying local yt-dlp...');
  console.log(`⚙️ User preferences: ${userPrefs.format} format, ${userPrefs.audioQuality}/${userPrefs.videoQuality} quality`);
  
  return new Promise((resolve) => {
    
    try {
      // Build yt-dlp command based on user preferences
      const ytdlpArgs = ['-m', 'yt_dlp'];
      
      // Format selection based on user preference
      if (userPrefs.format === 'audio') {
        ytdlpArgs.push('-f', 'bestaudio/best');
        ytdlpArgs.push('-x'); // Extract audio
        ytdlpArgs.push('--audio-format', 'mp3');
        
        // Audio quality mapping
        const audioQualityMap = {
          'high': '0', // Best quality
          'medium': '5', // Medium quality
          'low': '9' // Lower quality
        };
        ytdlpArgs.push('--audio-quality', audioQualityMap[userPrefs.audioQuality] || '0');
      } else {
        // Video format
        const videoQualityMap = {
          'high': 'best[height<=1080]',
          'medium': 'best[height<=720]', 
          'low': 'best[height<=480]'
        };
        ytdlpArgs.push('-f', videoQualityMap[userPrefs.videoQuality] || 'best[height<=720]');
      }
      
      ytdlpArgs.push(
        '--get-url',
        '--get-title',
        '--get-duration',
        '--get-filename',
        '--no-warnings',
        '--user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        url
      );
      
      console.log('🛠️ yt-dlp command:', ytdlpArgs.join(' '));
      
      // Use yt-dlp to get download URLs without downloading
      const ytdlp = spawn('python3', ytdlpArgs);

      let stdout = '';
      let stderr = '';

      ytdlp.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ytdlp.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ytdlp.on('close', (code) => {
        if (code === 0 && stdout.trim()) {
          console.log('✅ Tier 6 SUCCESS: Local yt-dlp');
          
          const lines = stdout.trim().split('\n').filter(line => line.trim());
          
          if (lines.length >= 1) {
            // Parse yt-dlp output
            const downloadUrl = lines[0];
            const title = lines[1] || 'Unknown Title';
            const duration = lines[2] || 'Unknown Duration';
            const filename = lines[3] || 'download.mp4';
            
            const formattedData = [{
              tier: 6,
              source: 'local_ytdlp',
              type: 'direct_url',
              url: downloadUrl,
              title: title,
              duration: duration,
              filename: filename,
              timestamp: new Date().toISOString()
            }];
            
            resolve({ success: true, data: formattedData });
          } else {
            console.log('❌ Tier 6 FAILED: No output from yt-dlp');
            resolve({ success: false, error: 'No download URL extracted' });
          }
        } else {
          console.log('❌ Tier 6 ERROR:', stderr || `Exit code: ${code}`);
          resolve({ success: false, error: stderr || `yt-dlp failed with code ${code}` });
        }
      });

      // Set timeout for yt-dlp extraction
      setTimeout(() => {
        ytdlp.kill();
        console.log('❌ Tier 6 TIMEOUT: yt-dlp extraction timed out');
        resolve({ success: false, error: 'yt-dlp extraction timeout' });
      }, 30000); // 30 second timeout

    } catch (error) {
      console.log('❌ Tier 6 ERROR:', error.message);
      resolve({ success: false, error: error.message });
    }
  });
}

// Main download endpoint
// Import the comprehensive downloader suite
const ComprehensiveDownloaderSuite = require('./comprehensive-downloader-suite');

app.post('/download', async (req, res) => {
  const { url, format, audioQuality, videoQuality, maxFileSize } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  
  // Default preferences if not provided
  const userPrefs = {
    format: format || 'audio', // 'audio' or 'video'
    audioQuality: audioQuality || 'high', // 'high' | 'medium' | 'low'
    videoQuality: videoQuality || 'medium', // 'high' | 'medium' | 'low'
    maxFileSize: maxFileSize || 100 // MB
  };
  
  console.log(`\n🚀 ENHANCED DOWNLOAD REQUEST: ${url}`);
  console.log(`⚙️ User Preferences:`, userPrefs);
  
  // Clean URL and detect platform
  const cleanUrl = url.split('?')[0];
  
  const results = {
    url: cleanUrl,
    tiers: [],
    success: false,
    timestamp: new Date().toISOString(),
    userPreferences: userPrefs
  };
  
  let downloader = null;
  
  try {
    // Initialize the comprehensive downloader suite
    downloader = new ComprehensiveDownloaderSuite({
      headless: true, // Always headless for production
      qualityPreference: userPrefs.videoQuality === 'high' ? 'highest' : userPrefs.videoQuality,
      enableLogging: true,
      retryAttempts: 2,
      downloadTimeout: 60000 // 1 minute timeout
    });
    
    await downloader.initialize();
    console.log('✅ Comprehensive Downloader Suite initialized');
    
    // Track progress and tier usage
    const progressLog = [];
    
    const result = await downloader.downloadWithRetry(cleanUrl, null, (progress) => {
      progressLog.push({
        step: progress.step,
        tier: progress.tier,
        tierName: progress.tierName,
        timestamp: new Date().toISOString()
      });
      console.log(`📈 Progress: ${progress.step} - ${progress.tierName || ''} (Tier ${progress.tier || 'N/A'})`);
    });
    
    // Convert result to API format
    if (result.success) {
      results.success = true;
      results.platform = result.platform;
      results.data = {
        downloadUrl: result.downloadUrl,
        method: result.method,
        service: result.service,
        quality: result.quality || 'Unknown',
        tier: result.tier,
        tierName: result.tierName
      };
      results.tiers.push({
        tier: result.tier,
        source: result.service,
        success: true,
        method: result.method,
        data: results.data
      });
      results.progressLog = progressLog;
      results.stats = downloader.getStats();
      
      console.log(`🎉 ENHANCED SUCCESS: ${result.method} (${result.service}) - Tier ${result.tier}`);
      return res.json(results);
    } else {
      // All tiers failed - return comprehensive error
      results.error = result.error;
      results.platform = result.platform;
      results.progressLog = progressLog;
      results.stats = downloader.getStats();
      
      console.log(`💥 ENHANCED FAILURE: ${result.error}`);
      return res.status(400).json(results);
    }
    
  } catch (error) {
    console.error('❌ Comprehensive Downloader Suite error:', error);
    results.error = `Enhanced downloader failed: ${error.message}`;
    return res.status(500).json(results);
  } finally {
    // Always close the browser
    if (downloader) {
      try {
        await downloader.close();
      } catch (closeError) {
        console.error('⚠️ Error closing downloader:', closeError.message);
      }
    }
  }
});

// File serving endpoint for downloaded content
app.get('/file/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'downloads', filename);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  // Set proper headers
  const ext = path.extname(filename).toLowerCase();
  const contentType = ext === '.mp4' ? 'video/mp4' : ext === '.mp3' ? 'audio/mpeg' : 'application/octet-stream';
  
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  
  // Send file
  res.sendFile(filePath, (err) => {
    if (err) {
      console.log('❌ File serve error:', err.message);
      res.status(500).json({ error: 'File serve failed' });
    } else {
      console.log(`✅ File served: ${filename}`);
      
      // Cleanup file after 5 minutes to save storage
      setTimeout(() => {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Cleaned up: ${filename}`);
          }
        } catch (cleanupErr) {
          console.log(`⚠️ Cleanup failed: ${filename}`, cleanupErr.message);
        }
      }, 300000); // 5 minutes
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    tiers: [
      { tier: 1, source: 'getloady', status: 'active' },
      { tier: 2, source: 'ssvid', status: 'active' },
      { tier: 3, source: 'squidlr', status: 'active' },
      { tier: 4, source: 'railway', status: 'active' },
      { tier: 5, source: 'vercel', status: 'active' },
      { tier: 6, source: 'local_ytdlp', status: 'active' }
    ]
  });
});

// Platform support endpoint
app.get('/platforms', (req, res) => {
  res.json({
    getloady: ['youtube', 'instagram', 'facebook', 'tiktok', 'twitter', 'linkedin', 'pinterest', 'soundcloud', 'vimeo', 'dailymotion', 'reddit', '9gag'],
    ssvid: ['youtube', 'facebook', 'instagram', 'twitter', 'tiktok', 'soundcloud', 'vimeo', 'linkedin', '9gag', 'dailymotion', 'reddit', 'pinterest'],
    squidlr: ['instagram', 'facebook', 'tiktok', 'twitter', 'linkedin', 'pinterest', 'soundcloud', 'vimeo', 'dailymotion', 'reddit', '9gag']
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Universal Social Media Downloader Backend`);
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📱 Platforms: http://localhost:${PORT}/platforms`);
  console.log(`\n💾 6-Tier Fallback System:`);
  console.log(`   1️⃣ GetLoady.com - Google Video URLs`);
  console.log(`   2️⃣ SSVid.net - Download Files`);
  console.log(`   3️⃣ Squidlr.com - Direct CDN URLs`);
  console.log(`   4️⃣ Railway Backend - yt-dlp API`);
  console.log(`   5️⃣ Vercel Backend - yt-dlp API`);
  console.log(`   6️⃣ Local yt-dlp - Final Fallback\n`);
});

module.exports = app;