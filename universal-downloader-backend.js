const express = require('express');
const { chromium } = require('playwright');
const cors = require('cors');
const axios = require('axios');
const { spawn } = require('child_process');

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

// Browser configuration for production
const getBrowserConfig = () => {
  // Check if we're in production with browserless or docker
  if (process.env.BROWSERLESS_URL) {
    return {
      wsEndpoint: process.env.BROWSERLESS_URL
    };
  }
  
  // Local development or docker with display
  return {
    headless: process.env.NODE_ENV === 'production' ? false : false, // Always use headed mode
    channel: 'chrome',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  };
};

// Tier 1: GetLoady
async function tryGetLoady(url, platform) {
  console.log(`🔄 Tier 1: Trying GetLoady for ${platform}...`);
  
  const browserConfig = getBrowserConfig();
  const browser = browserConfig.wsEndpoint 
    ? await chromium.connect(browserConfig.wsEndpoint)
    : await chromium.launch(browserConfig);
  
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    const capturedUrls = [];
    
    // Monitor new tabs for Google Video URLs
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
        await input.click({ timeout: 5000 });
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
        await page.click(selector, { timeout: 5000 });
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
    const downloadSelectors = [
      'button:has-text("Download")',
      'button:has-text("download")',
      'a:has-text("Download")',
      '.download-btn',
      '.btn-download'
    ];
    
    let downloadClicked = false;
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
    
    if (!downloadClicked) {
      console.log('⚠️ GetLoady: No Download button found');
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
async function trySSVid(url) {
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
      console.log('📥 Download intercepted:', download.url());
      capturedUrls.push({
        tier: 2,
        source: 'ssvid',
        type: 'download_file',
        url: download.url(),
        filename: download.suggestedFilename(),
        timestamp: new Date().toISOString()
      });
    });
    
    await page.goto('https://ssvid.net/en', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Input URL
    const input = await page.locator('#search__input');
    await input.click();
    await input.fill(url);
    await page.waitForTimeout(1000);
    
    // Click Start
    await page.click('button:has-text("Start")');
    await page.waitForTimeout(8000);
    
    // Click Convert
    const convertButtons = await page.locator('button:has-text("Convert")');
    const buttonCount = await convertButtons.count();
    
    if (buttonCount > 0) {
      await convertButtons.nth(0).click();
      
      // Wait up to 2.5 minutes for download button
      const maxWaitTime = 150000; // 2.5 minutes
      const checkInterval = 15000; // 15 seconds
      const startTime = Date.now();
      
      let downloadClicked = false;
      while (Date.now() - startTime < maxWaitTime && !downloadClicked) {
        const downloadSelectors = [
          'button:has-text("Download")',
          '.btn:has-text("Download")',
          'a:has-text("Download")'
        ];
        
        for (const selector of downloadSelectors) {
          try {
            const downloadBtn = await page.locator(selector).first();
            if (await downloadBtn.isVisible()) {
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
async function trySquidlr(url, platform) {
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
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    const capturedUrls = [];
    
    // Monitor downloads and new tabs
    page.on('download', async download => {
      capturedUrls.push({
        tier: 3,
        source: 'squidlr',
        type: 'download_file',
        url: download.url(),
        filename: download.suggestedFilename(),
        timestamp: new Date().toISOString()
      });
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
    
    // Input URL by pasting (required by Squidlr)
    const inputSelector = 'input[type="text"], input[placeholder*="URL"], textarea';
    await page.waitForSelector(inputSelector, { timeout: 15000 });
    
    await page.fill(inputSelector, '');
    await page.evaluate(async (url) => {
      await navigator.clipboard.writeText(url);
    }, url);
    
    await page.focus(inputSelector);
    await page.keyboard.press('Meta+V');
    await page.waitForTimeout(1000);
    
    // Wait for processing and download options (up to 2.5 minutes)
    const maxWait = 150000;
    const checkInterval = 15000;
    const startTime = Date.now();
    
    let downloadProcessed = false;
    while (Date.now() - startTime < maxWait && !downloadProcessed) {
      // Look for cloud download icons
      const cloudDownloadIcons = await page.$$('span.oi.oi-cloud-download, span[class*="oi-cloud-download"]');
      
      if (cloudDownloadIcons.length > 0) {
        try {
          await cloudDownloadIcons[0].click();
          downloadProcessed = true;
          await page.waitForTimeout(3000);
        } catch (e) {
          const parentElement = await cloudDownloadIcons[0].evaluateHandle(el => 
            el.closest('button, a, [onclick], [role="button"]')
          );
          if (parentElement) {
            await parentElement.click();
            downloadProcessed = true;
            await page.waitForTimeout(3000);
          }
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
async function tryRailwayBackend(url) {
  console.log('🔄 Tier 4: Trying Railway backend...');
  
  try {
    const railwayUrl = 'https://detachbackend-production.up.railway.app';
    
    const response = await axios.post(`${railwayUrl}/download`, {
      url: url
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
async function tryVercelBackend(url) {
  console.log('🔄 Tier 5: Trying Vercel backend...');
  
  try {
    const vercelUrl = 'https://detach-backend-454ebn3bh-detach1.vercel.app';
    
    const response = await axios.post(`${vercelUrl}/download`, {
      url: url
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
async function tryLocalYtDlp(url) {
  console.log('🔄 Tier 6: Trying local yt-dlp...');
  
  return new Promise((resolve) => {
    
    try {
      // Use yt-dlp to get download URLs without downloading
      const ytdlp = spawn('python3', [
        '-m', 'yt_dlp',
        '--get-url',
        '--get-title',
        '--get-duration',
        '--get-filename',
        '--no-warnings',
        '--user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        url
      ]);

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
app.post('/download', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  
  console.log(`\n🚀 DOWNLOAD REQUEST: ${url}`);
  
  // Clean URL and detect platform
  const cleanUrl = url.split('?')[0];
  const platform = detectPlatform(cleanUrl);
  
  console.log(`📱 Platform detected: ${platform}`);
  
  const results = {
    url: cleanUrl,
    platform,
    tiers: [],
    success: false,
    timestamp: new Date().toISOString()
  };
  
  try {
    // Tier 1: GetLoady
    const tier1Result = await tryGetLoady(cleanUrl, platform);
    results.tiers.push({ tier: 1, source: 'getloady', ...tier1Result });
    
    if (tier1Result.success) {
      results.success = true;
      results.data = tier1Result.data;
      return res.json(results);
    }
    
    // Tier 2: SSVid.net
    const tier2Result = await trySSVid(cleanUrl);
    results.tiers.push({ tier: 2, source: 'ssvid', ...tier2Result });
    
    if (tier2Result.success) {
      results.success = true;
      results.data = tier2Result.data;
      return res.json(results);
    }
    
    // Tier 3: Squidlr.com
    const tier3Result = await trySquidlr(cleanUrl, platform);
    results.tiers.push({ tier: 3, source: 'squidlr', ...tier3Result });
    
    if (tier3Result.success) {
      results.success = true;
      results.data = tier3Result.data;
      return res.json(results);
    }
    
    // Tier 4: Railway backend fallback
    const tier4Result = await tryRailwayBackend(cleanUrl);
    results.tiers.push({ tier: 4, source: 'railway', ...tier4Result });
    
    if (tier4Result.success) {
      results.success = true;
      results.data = tier4Result.data;
      return res.json(results);
    }
    
    // Tier 5: Vercel backend fallback
    const tier5Result = await tryVercelBackend(cleanUrl);
    results.tiers.push({ tier: 5, source: 'vercel', ...tier5Result });
    
    if (tier5Result.success) {
      results.success = true;
      results.data = tier5Result.data;
      return res.json(results);
    }
    
    // Tier 6: Local yt-dlp fallback (final attempt)
    const tier6Result = await tryLocalYtDlp(cleanUrl);
    results.tiers.push({ tier: 6, source: 'local_ytdlp', ...tier6Result });
    
    if (tier6Result.success) {
      results.success = true;
      results.data = tier6Result.data;
      return res.json(results);
    }
    
    // All tiers failed
    console.log('❌ ALL 6 TIERS FAILED');
    results.error = 'All download methods failed';
    return res.status(500).json(results);
    
  } catch (error) {
    console.error('💥 CRITICAL ERROR:', error);
    results.error = error.message;
    return res.status(500).json(results);
  }
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