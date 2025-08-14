// Fix the sequence - type URL FIRST, THEN trigger validation
const { chromium } = require('playwright');

async function fixSquidlrSequence() {
  console.log('🧪 Fixing Squidlr.com sequence - type URL FIRST...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome'
  });
  
  try {
    const page = await browser.newPage();
    
    // Monitor downloads
    page.on('download', download => {
      console.log(`📥 DOWNLOAD: ${download.url()}`);
      console.log(`📥 FILE: ${download.suggestedFilename()}\n`);
    });
    
    console.log('📱 Going to Squidlr.com...');
    await page.goto('https://www.squidlr.com/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Test with a simple Instagram URL
    const testUrl = 'https://www.instagram.com/p/B_Ua6ZbAoAA/';
    console.log(`📝 Testing URL: ${testUrl}`);
    
    // 1. FIRST: Clear the input field
    console.log('🔧 Step 1: Clear input field');
    await page.fill('#url', '');
    await page.waitForTimeout(500);
    
    // 2. SECOND: Type the COMPLETE URL
    console.log('🔧 Step 2: Type complete URL');
    await page.type('#url', testUrl);
    await page.waitForTimeout(1000);
    
    // 3. THIRD: Now trigger validation
    console.log('🔧 Step 3: Trigger validation');
    await page.keyboard.press('Tab'); // Tab to next field
    await page.waitForTimeout(2000);
    
    // Check button state
    const isEnabled = await page.evaluate(() => {
      const btn = document.querySelector('#download-button');
      return btn ? !btn.disabled : false;
    });
    
    console.log(`Button enabled after proper sequence: ${isEnabled}`);
    
    if (isEnabled) {
      console.log('✅ SUCCESS! Button is enabled - clicking download...');
      await page.click('#download-button');
      
      console.log('⏳ Waiting for download...');
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
      console.log('❌ Button still disabled. Trying alternative trigger...');
      
      // Try clicking on the input field and pressing Enter
      await page.focus('#url');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
      
      const enabledAfterEnter = await page.evaluate(() => {
        const btn = document.querySelector('#download-button');
        return btn ? !btn.disabled : false;
      });
      
      console.log(`Button enabled after Enter: ${enabledAfterEnter}`);
      
      if (enabledAfterEnter) {
        console.log('✅ SUCCESS with Enter! Clicking download...');
        await page.click('#download-button');
        await page.waitForTimeout(8000);
      }
    }
    
    console.log('\n🔍 Browser staying open for 10 seconds...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('❌ Fixed sequence test failed:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  fixSquidlrSequence().catch(console.error);
}