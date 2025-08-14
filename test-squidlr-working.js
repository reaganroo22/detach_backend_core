// Test Squidlr.com with a different approach - try real interaction
const { chromium } = require('playwright');

async function testSquidlrWorking() {
  console.log('🧪 Testing Squidlr.com with real user interaction approach...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome',
    slowMo: 1000 // Slow down to mimic human interaction
  });
  
  try {
    const page = await browser.newPage();
    
    // Navigate to Squidlr
    console.log('📱 Navigating to Squidlr.com...');
    await page.goto('https://www.squidlr.com/', { waitUntil: 'networkidle' });
    
    // Wait for page to fully load
    await page.waitForTimeout(3000);
    
    // Check if URL input exists
    const urlInput = await page.locator('#url');
    console.log('URL input exists:', await urlInput.count() > 0);
    
    if (await urlInput.count() > 0) {
      // Use a simple, known working URL
      const testUrl = 'https://www.instagram.com/p/B_Ua6ZbAoAA/';
      console.log(`📝 Typing URL slowly: ${testUrl}`);
      
      // Click on input first to focus
      await urlInput.click();
      await page.waitForTimeout(1000);
      
      // Type slowly to trigger validation
      await urlInput.type(testUrl, { delay: 200 });
      
      // Press Enter to trigger validation
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      
      // Check button state
      const downloadButton = await page.locator('#download-button');
      const isEnabled = await downloadButton.isEnabled();
      console.log('Download button enabled after typing:', isEnabled);
      
      if (!isEnabled) {
        console.log('🔧 Trying additional validation triggers...');
        
        // Try clicking elsewhere to blur the input
        await page.click('body');
        await page.waitForTimeout(2000);
        
        console.log('Download button enabled after blur:', await downloadButton.isEnabled());
        
        // Try tabbing through the form
        await urlInput.focus();
        await page.keyboard.press('Tab');
        await page.waitForTimeout(2000);
        
        console.log('Download button enabled after tab:', await downloadButton.isEnabled());
      }
      
      // If still not enabled, try a different URL format
      if (!await downloadButton.isEnabled()) {
        console.log('🔄 Trying different URL format...');
        
        await urlInput.clear();
        await page.waitForTimeout(1000);
        
        // Try a TikTok URL
        const tiktokUrl = 'https://www.tiktok.com/@therock/video/7016198567564135686';
        console.log(`📝 Trying TikTok URL: ${tiktokUrl}`);
        
        await urlInput.type(tiktokUrl, { delay: 200 });
        await page.keyboard.press('Enter');
        await page.waitForTimeout(3000);
        
        console.log('Download button enabled with TikTok URL:', await downloadButton.isEnabled());
      }
      
      // If enabled, try to click and get download URL
      if (await downloadButton.isEnabled()) {
        console.log('✅ Button is enabled! Clicking download...');
        
        // Set up download listener
        page.on('download', async download => {
          console.log('📥 DOWNLOAD DETECTED!');
          console.log(`📥 DOWNLOAD URL: ${download.url()}`);
          console.log(`📥 SUGGESTED FILENAME: ${download.suggestedFilename()}`);
        });
        
        // Set up response listener for download URLs
        page.on('response', async response => {
          const url = response.url();
          if (url.includes('.mp4') || url.includes('.mp3') || url.includes('download') || url.includes('blob:')) {
            console.log('🎯 POTENTIAL DOWNLOAD URL DETECTED:');
            console.log(`📥 URL: ${url}`);
            console.log(`📥 Status: ${response.status()}`);
          }
        });
        
        await downloadButton.click();
        
        // Wait for download or redirect
        console.log('⏳ Waiting for download...');
        await page.waitForTimeout(10000);
        
        // Check for any download links on the page
        const downloadLinks = await page.evaluate(() => {
          const links = [];
          document.querySelectorAll('a[href*=".mp4"], a[href*=".mp3"], a[download], a[href*="blob:"]').forEach(el => {
            if (el.href && el.href.startsWith('http')) {
              links.push({
                text: el.textContent.trim(),
                url: el.href
              });
            }
          });
          return links;
        });
        
        if (downloadLinks.length > 0) {
          console.log('🎯 Found download links on page:');
          downloadLinks.forEach((link, i) => {
            console.log(`${i + 1}. ${link.text}`);
            console.log(`   📥 DOWNLOAD URL: ${link.url}\n`);
          });
        }
      } else {
        console.log('❌ Download button remains disabled');
      }
    } else {
      console.log('❌ URL input field not found');
    }
    
    // Keep browser open for inspection
    console.log('🔍 Browser staying open for 15 seconds...');
    await page.waitForTimeout(15000);
    
  } catch (error) {
    console.error('❌ Squidlr test failed:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  testSquidlrWorking().catch(console.error);
}