// Test Squidlr.com by PASTING the URL instead of typing it
const { chromium } = require('playwright');

async function testSquidlrPaste() {
  console.log('🧪 Testing Squidlr.com by PASTING URL...\n');
  
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
    
    page.on('response', async response => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';
      
      if (
        url.includes('.mp4') ||
        url.includes('download') ||
        url.includes('cdninstagram') ||
        url.includes('tiktokcdn') ||
        contentType.includes('video/')
      ) {
        console.log(`🎯 DOWNLOAD URL: ${url}`);
        console.log(`   Type: ${contentType}\n`);
      }
    });
    
    console.log('📱 Going to Squidlr.com...');
    await page.goto('https://www.squidlr.com/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Use a real, working Instagram URL
    const realUrl = 'https://www.instagram.com/p/CyQzKzMLVeB/';
    console.log(`📝 Will paste URL: ${realUrl}`);
    
    // Click on the input field to focus it
    console.log('🔧 Step 1: Focus input field');
    await page.click('#url');
    await page.waitForTimeout(500);
    
    // Clear any existing content
    console.log('🔧 Step 2: Clear existing content');
    await page.keyboard.press('Control+A'); // Select all
    await page.keyboard.press('Delete'); // Delete
    await page.waitForTimeout(500);
    
    // Set clipboard content and paste
    console.log('🔧 Step 3: Set clipboard and paste');
    
    // Method 1: Use evaluate to set clipboard and paste
    await page.evaluate(async (url) => {
      await navigator.clipboard.writeText(url);
    }, realUrl);
    
    // Now paste
    await page.keyboard.press('Control+V');
    await page.waitForTimeout(2000);
    
    console.log('🔧 Step 4: Check if URL was pasted correctly');
    const inputValue = await page.inputValue('#url');
    console.log(`Input value after paste: ${inputValue}`);
    
    if (inputValue === realUrl) {
      console.log('✅ URL pasted correctly!');
      
      // Trigger validation
      console.log('🔧 Step 5: Trigger validation');
      await page.keyboard.press('Tab'); // Tab out to trigger validation
      await page.waitForTimeout(3000);
      
      // Check button state
      const isEnabled = await page.evaluate(() => {
        const btn = document.querySelector('#download-button');
        return btn ? !btn.disabled : false;
      });
      
      console.log(`Button enabled after paste: ${isEnabled}`);
      
      if (isEnabled) {
        console.log('🎉 SUCCESS! Button is enabled - clicking download...');
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
        console.log('❌ Button still disabled after paste');
        
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
    } else {
      console.log('❌ URL paste failed');
    }
    
    console.log('\n🔍 Browser staying open for 15 seconds...');
    await page.waitForTimeout(15000);
    
  } catch (error) {
    console.error('❌ Paste test failed:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  testSquidlrPaste().catch(console.error);
}