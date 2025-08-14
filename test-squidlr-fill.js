// Test Squidlr.com using fill() which simulates paste
const { chromium } = require('playwright');

async function testSquidlrFill() {
  console.log('🧪 Testing Squidlr.com using fill() method...\n');
  
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
    await page.waitForTimeout(3000);
    
    // Use a real, working Instagram URL
    const realUrl = 'https://www.instagram.com/p/CyQzKzMLVeB/';
    console.log(`📝 Will fill URL: ${realUrl}`);
    
    // Method 1: Use fill() which should trigger paste-like behavior
    console.log('🔧 Using fill() method');
    await page.fill('#url', realUrl);
    await page.waitForTimeout(2000);
    
    // Check if it worked
    const inputValue = await page.inputValue('#url');
    console.log(`Input value after fill: ${inputValue}`);
    
    if (inputValue === realUrl) {
      console.log('✅ URL filled correctly!');
      
      // Trigger validation by clicking elsewhere
      await page.click('body');
      await page.waitForTimeout(2000);
      
      // Check button state
      const isEnabled = await page.evaluate(() => {
        const btn = document.querySelector('#download-button');
        return btn ? !btn.disabled : false;
      });
      
      console.log(`Button enabled after fill: ${isEnabled}`);
      
      if (isEnabled) {
        console.log('🎉 SUCCESS! Button is enabled - clicking download...');
        await page.click('#download-button');
        await page.waitForTimeout(10000);
      } else {
        console.log('❌ Button still disabled. Trying Enter...');
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
      console.log('❌ Fill failed, trying alternative method...');
      
      // Method 2: Use evaluate to set value directly and dispatch events
      await page.evaluate((url) => {
        const input = document.querySelector('#url');
        if (input) {
          input.value = url;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new Event('paste', { bubbles: true }));
        }
      }, realUrl);
      
      await page.waitForTimeout(2000);
      
      const newValue = await page.inputValue('#url');
      console.log(`Input value after direct set: ${newValue}`);
      
      if (newValue === realUrl) {
        await page.waitForTimeout(2000);
        
        const isEnabled = await page.evaluate(() => {
          const btn = document.querySelector('#download-button');
          return btn ? !btn.disabled : false;
        });
        
        console.log(`Button enabled after direct set: ${isEnabled}`);
        
        if (isEnabled) {
          await page.click('#download-button');
          await page.waitForTimeout(8000);
        }
      }
    }
    
    console.log('\n🔍 Browser staying open for 15 seconds...');
    await page.waitForTimeout(15000);
    
  } catch (error) {
    console.error('❌ Fill test failed:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  testSquidlrFill().catch(console.error);
}