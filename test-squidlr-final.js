// Final test of Squidlr.com with simple approach
const { chromium } = require('playwright');

async function testSquidlrFinal() {
  console.log('🧪 Final Squidlr.com test with simple TikTok URL...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome'
  });
  
  try {
    const page = await browser.newPage();
    
    // Capture download URLs
    const downloadUrls = [];
    
    page.on('response', async response => {
      const url = response.url();
      if (
        url.includes('.mp4') || 
        url.includes('.mp3') || 
        url.includes('download') ||
        url.includes('tiktokcdn') ||
        url.includes('cdninstagram') ||
        response.headers()['content-disposition']
      ) {
        console.log(`🎯 DOWNLOAD URL: ${url}`);
        downloadUrls.push(url);
      }
    });
    
    page.on('download', async download => {
      console.log(`📥 DOWNLOAD EVENT: ${download.url()}`);
      downloadUrls.push(download.url());
    });
    
    // Navigate to Squidlr
    console.log('📱 Going to Squidlr.com...');
    await page.goto('https://www.squidlr.com/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Use a simple TikTok URL
    const tiktokUrl = 'https://tiktok.com/@therock/video/7016198567564135686';
    console.log(`📝 Testing simple TikTok URL: ${tiktokUrl}`);
    
    await page.waitForSelector('#url');
    await page.fill('#url', tiktokUrl);
    
    // Wait a moment and check button state
    await page.waitForTimeout(3000);
    
    const isEnabled = await page.evaluate(() => {
      const btn = document.querySelector('#download-button');
      return btn ? !btn.disabled : false;
    });
    
    console.log(`Button enabled: ${isEnabled}`);
    
    if (isEnabled) {
      console.log('✅ Button is enabled! Clicking...');
      await page.click('#download-button');
      await page.waitForTimeout(10000);
      
      // Check for download links
      const links = await page.evaluate(() => {
        const foundLinks = [];
        document.querySelectorAll('a[href*=".mp4"], a[href*="download"], a[download]').forEach(el => {
          if (el.href && el.href.startsWith('http')) {
            foundLinks.push({
              text: el.textContent.trim(),
              url: el.href
            });
          }
        });
        return foundLinks;
      });
      
      if (links.length > 0) {
        console.log('🎯 Found download links:');
        links.forEach((link, i) => {
          console.log(`${i + 1}. ${link.text}`);
          console.log(`   📥 URL: ${link.url}\n`);
        });
      }
    } else {
      console.log('❌ Button still disabled, trying alternative approaches...');
      
      // Try pressing Enter
      await page.focus('#url');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
      
      const enabledAfterEnter = await page.evaluate(() => {
        const btn = document.querySelector('#download-button');
        return btn ? !btn.disabled : false;
      });
      
      console.log(`Button enabled after Enter: ${enabledAfterEnter}`);
      
      if (enabledAfterEnter) {
        await page.click('#download-button');
        await page.waitForTimeout(8000);
      }
    }
    
    console.log(`\n📋 Total captured URLs: ${downloadUrls.length}`);
    downloadUrls.forEach((url, i) => {
      console.log(`${i + 1}. ${url}`);
    });
    
    // Keep open for inspection
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('❌ Squidlr final test failed:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  testSquidlrFinal().catch(console.error);
}