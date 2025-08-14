// Try new approaches to get Squidlr.com working
const { chromium } = require('playwright');

async function testSquidlrNewApproach() {
  console.log('🧪 Testing Squidlr.com with new approaches...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome'
  });
  
  try {
    const page = await browser.newPage();
    
    // Monitor download URLs
    page.on('response', async response => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';
      
      if (
        url.includes('.mp4') ||
        url.includes('download') ||
        url.includes('tiktokcdn') ||
        url.includes('cdninstagram') ||
        contentType.includes('video/')
      ) {
        console.log(`🎯 DOWNLOAD URL: ${url}`);
        console.log(`   Type: ${contentType}\n`);
      }
    });
    
    page.on('download', download => {
      console.log(`📥 DOWNLOAD: ${download.url()}`);
      console.log(`📥 FILE: ${download.suggestedFilename()}\n`);
    });
    
    console.log('📱 Going to Squidlr.com...');
    await page.goto('https://www.squidlr.com/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    // Try different URL formats that might work better
    const testUrls = [
      'https://www.instagram.com/p/B_Ua6ZbAoAA/',
      'https://instagram.com/p/B_Ua6ZbAoAA/',
      'https://www.tiktok.com/@therock/video/7016198567564135686',
      'https://tiktok.com/@therock/video/7016198567564135686',
      'https://x.com/user/status/123456789', // Simple X URL
      'https://twitter.com/user/status/123456789' // Simple Twitter URL
    ];
    
    for (const testUrl of testUrls) {
      console.log(`\n🧪 Testing URL: ${testUrl}`);
      
      // Clear input and try new URL
      await page.fill('#url', '');
      await page.waitForTimeout(1000);
      
      // Type slowly character by character to trigger validation
      for (let char of testUrl) {
        await page.type('#url', char, { delay: 50 });
      }
      
      // Try different validation triggers
      await page.keyboard.press('Tab');
      await page.waitForTimeout(2000);
      
      // Check if button is enabled
      const isEnabled = await page.evaluate(() => {
        const btn = document.querySelector('#download-button');
        return btn ? !btn.disabled : false;
      });
      
      console.log(`Button enabled: ${isEnabled}`);
      
      if (isEnabled) {
        console.log('✅ Button enabled! Clicking download...');
        await page.click('#download-button');
        await page.waitForTimeout(8000);
        
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
          break; // Success! Exit the loop
        }
      } else {
        // Try submitting with Enter
        await page.focus('#url');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
        
        const enabledAfterEnter = await page.evaluate(() => {
          const btn = document.querySelector('#download-button');
          return btn ? !btn.disabled : false;
        });
        
        console.log(`Button enabled after Enter: ${enabledAfterEnter}`);
        
        if (enabledAfterEnter) {
          await page.click('#download-button');
          await page.waitForTimeout(6000);
        }
      }
    }
    
    // Keep browser open
    console.log('\n🔍 Browser staying open for 15 seconds...');
    await page.waitForTimeout(15000);
    
  } catch (error) {
    console.error('❌ Squidlr test failed:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  testSquidlrNewApproach().catch(console.error);
}