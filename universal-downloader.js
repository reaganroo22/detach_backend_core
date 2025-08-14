const StealthDownloader = require('./stealth-downloader');
const { chromium } = require('playwright');
const axios = require('axios');

class UniversalDownloader {
  constructor() {
    this.stealthDownloader = null;
    this.proxies = [
      // Add your rotating proxies here
      // 'http://proxy1:port',
      // 'http://proxy2:port',
      null // No proxy as fallback
    ];
    this.currentProxyIndex = 0;
  }

  getRandomProxy() {
    const proxy = this.proxies[this.currentProxyIndex];
    this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxies.length;
    return proxy;
  }

  detectPlatform(url) {
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('instagram.com')) return 'instagram';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
    if (url.includes('pinterest.com')) return 'pinterest';
    if (url.includes('facebook.com')) return 'facebook';
    if (url.includes('linkedin.com')) return 'linkedin';
    if (url.includes('vimeo.com')) return 'vimeo';
    if (url.includes('dailymotion.com')) return 'dailymotion';
    return 'unknown';
  }

  async downloadWithGetLoady(url, platform) {
    try {
      console.log(`🎯 Tier 1: Attempting GetLoady download for ${platform}`);
      
      if (!this.stealthDownloader) {
        this.stealthDownloader = new StealthDownloader();
        await this.stealthDownloader.initialize();
      }

      let result;
      switch (platform) {
        case 'youtube':
          result = await this.stealthDownloader.downloadFromYouTube(url);
          break;
        case 'tiktok':
          result = await this.stealthDownloader.downloadFromTikTok(url);
          break;
        case 'instagram':
          result = await this.stealthDownloader.downloadFromInstagram(url);
          break;
        case 'twitter':
          result = await this.stealthDownloader.downloadFromTwitter(url);
          break;
        case 'pinterest':
          result = await this.stealthDownloader.downloadFromPinterest(url);
          break;
        default:
          throw new Error(`Platform ${platform} not supported by GetLoady`);
      }

      if (result.success) {
        console.log(`✅ GetLoady success: ${result.downloadUrl}`);
        return result;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.log(`❌ GetLoady failed: ${error.message}`);
      throw error;
    }
  }

  async downloadWithSSVid(url, platform) {
    try {
      console.log(`🎯 Tier 2: Attempting SSVid.net download for ${platform}`);
      
      const browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      
      // Set up download interception
      let downloadUrl = null;
      
      page.on('download', async download => {
        downloadUrl = download.url();
        console.log(`SSVid download intercepted: ${downloadUrl}`);
        await download.cancel();
      });

      page.on('response', response => {
        const responseUrl = response.url();
        const contentType = response.headers()['content-type'] || '';
        
        if (contentType.includes('video/') || responseUrl.includes('.mp4') || responseUrl.includes('.webm')) {
          downloadUrl = responseUrl;
          console.log(`SSVid video URL intercepted: ${responseUrl}`);
        }
      });

      // Navigate to SSVid
      await page.goto('https://ssvid.net/', { waitUntil: 'networkidle' });
      
      // Fill URL input (SSVid uses search input with specific ID)
      await page.waitForSelector('#search__input', { timeout: 10000 });
      await page.fill('#search__input', url);
      
      // Click download button (SSVid uses "Start" button)
      await page.click('button:has-text("Start")');
      
      // Wait for download
      for (let i = 0; i < 15; i++) {
        if (downloadUrl) {
          await browser.close();
          console.log(`✅ SSVid success: ${downloadUrl}`);
          return {
            success: true,
            downloadUrl: downloadUrl,
            platform: platform,
            method: 'ssvid'
          };
        }
        
        // Check for download links
        const downloadLinks = await page.$$('a[href*="download"], a[href*=".mp4"], a[download], a[href^="blob:"]');
        for (const link of downloadLinks) {
          const href = await link.getAttribute('href');
          if (href && (href.includes('.mp4') || href.includes('blob:') || href.includes('download'))) {
            await browser.close();
            console.log(`✅ SSVid DOM success: ${href}`);
            return {
              success: true,
              downloadUrl: href,
              platform: platform,
              method: 'ssvid_dom'
            };
          }
        }
        
        await page.waitForTimeout(2000);
        console.log(`SSVid attempt ${i + 1}/15...`);
      }
      
      await browser.close();
      throw new Error('SSVid: No download found after 30 seconds');
      
    } catch (error) {
      console.log(`❌ SSVid failed: ${error.message}`);
      throw error;
    }
  }

  async downloadWithSquidlr(url, platform) {
    try {
      console.log(`🎯 Tier 3: Attempting Squidlr.com download for ${platform}`);
      
      // Squidlr doesn't support YouTube
      if (platform === 'youtube') {
        throw new Error('Squidlr does not support YouTube');
      }
      
      const browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      
      // Set up download interception
      let downloadUrl = null;
      
      page.on('download', async download => {
        downloadUrl = download.url();
        console.log(`Squidlr download intercepted: ${downloadUrl}`);
        await download.cancel();
      });

      page.on('response', response => {
        const responseUrl = response.url();
        const contentType = response.headers()['content-type'] || '';
        
        if (contentType.includes('video/') || responseUrl.includes('.mp4') || responseUrl.includes('.webm')) {
          downloadUrl = responseUrl;
          console.log(`Squidlr video URL intercepted: ${responseUrl}`);
        }
      });

      // Navigate to Squidlr
      await page.goto('https://www.squidlr.com/', { waitUntil: 'networkidle' });
      
      // Fill URL input (Squidlr uses #url input)
      await page.waitForSelector('#url', { timeout: 10000 });
      await page.fill('#url', url);
      
      // Wait for download button to be enabled (Squidlr validates URL first)
      await page.waitForSelector('#download-button:not([disabled])', { timeout: 15000 });
      
      // Click download button (Squidlr uses "Download" button)
      await page.click('#download-button');
      
      // Wait for download
      for (let i = 0; i < 15; i++) {
        if (downloadUrl) {
          await browser.close();
          console.log(`✅ Squidlr success: ${downloadUrl}`);
          return {
            success: true,
            downloadUrl: downloadUrl,
            platform: platform,
            method: 'squidlr'
          };
        }
        
        // Check for download links
        const downloadLinks = await page.$$('a[href*="download"], a[href*=".mp4"], a[download], a[href^="blob:"]');
        for (const link of downloadLinks) {
          const href = await link.getAttribute('href');
          if (href && (href.includes('.mp4') || href.includes('blob:') || href.includes('download'))) {
            await browser.close();
            console.log(`✅ Squidlr DOM success: ${href}`);
            return {
              success: true,
              downloadUrl: href,
              platform: platform,
              method: 'squidlr_dom'
            };
          }
        }
        
        await page.waitForTimeout(2000);
        console.log(`Squidlr attempt ${i + 1}/15...`);
      }
      
      await browser.close();
      throw new Error('Squidlr: No download found after 30 seconds');
      
    } catch (error) {
      console.log(`❌ Squidlr failed: ${error.message}`);
      throw error;
    }
  }

  async downloadWithVercelBackend(url, platform) {
    try {
      console.log(`🎯 Tier 4: Attempting Vercel backend download for ${platform}`);
      
      const proxy = this.getRandomProxy();
      const config = {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      };
      
      if (proxy) {
        config.proxy = {
          protocol: 'http',
          host: proxy.split(':')[1].replace('//', ''),
          port: parseInt(proxy.split(':')[2])
        };
      }

      const response = await axios.post('https://detach-backend-fwc2j5gew-detach1.vercel.app/api/download', {
        url: url
      }, config);

      if (response.data.success) {
        console.log(`✅ Vercel backend success: ${response.data.downloadUrl || response.data.filePath}`);
        return {
          success: true,
          downloadUrl: response.data.downloadUrl || response.data.filePath,
          platform: platform,
          method: 'vercel_backend'
        };
      } else {
        throw new Error(response.data.error || 'Vercel backend failed');
      }
      
    } catch (error) {
      console.log(`❌ Vercel backend failed: ${error.message}`);
      throw error;
    }
  }

  async download(url) {
    const platform = this.detectPlatform(url);
    console.log(`🚀 Starting universal download for ${platform}: ${url}`);

    const tiers = [
      () => this.downloadWithGetLoady(url, platform),
      () => this.downloadWithSSVid(url, platform),
      () => this.downloadWithSquidlr(url, platform),
      () => this.downloadWithVercelBackend(url, platform)
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
        console.log(`⚠️  Tier ${i + 1} failed, trying next tier...`);
        
        // Add delay between tiers to avoid rate limiting
        if (i < tiers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
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
    if (this.stealthDownloader) {
      await this.stealthDownloader.close();
    }
  }
}

// Test function
async function testUniversal() {
  const downloader = new UniversalDownloader();
  
  try {
    const result = await downloader.download('https://www.youtube.com/shorts/0Pwt8wcSjmY');
    console.log('Final Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await downloader.close();
  }
}

if (require.main === module) {
  testUniversal();
}

module.exports = UniversalDownloader;