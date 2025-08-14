// Detailed debug of Squidlr.com to understand the button issue
const { chromium } = require('playwright');

async function debugSquidlr() {
  console.log('🧪 Detailed Squidlr.com debugging...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Navigate to Squidlr
    console.log('📱 Navigating to Squidlr...');
    await page.goto('https://www.squidlr.com/', { waitUntil: 'networkidle' });
    
    // Check initial state of elements
    console.log('\n🔍 Checking initial page state...');
    
    const urlInput = await page.locator('#url');
    const downloadButton = await page.locator('#download-button');
    
    console.log('URL input visible:', await urlInput.isVisible());
    console.log('Download button visible:', await downloadButton.isVisible());
    console.log('Download button enabled:', await downloadButton.isEnabled());
    
    // Fill the URL
    const testUrl = 'https://www.tiktok.com/@tiktokyoungboss/video/7492418301063187734';
    console.log(`\n📝 Filling URL: ${testUrl}`);
    await urlInput.fill(testUrl);
    
    // Wait a bit for any validation
    console.log('⏱️  Waiting 3 seconds for validation...');
    await page.waitForTimeout(3000);
    
    // Check button state after URL input
    console.log('Download button enabled after URL:', await downloadButton.isEnabled());
    
    // Check if we need to trigger validation
    console.log('🔍 Checking for validation triggers...');
    await page.keyboard.press('Tab'); // Tab out to trigger validation
    await page.waitForTimeout(2000);
    
    console.log('Download button enabled after tab:', await downloadButton.isEnabled());
    
    // Try clicking if enabled
    if (await downloadButton.isEnabled()) {
      console.log('✅ Button is enabled, attempting click...');
      await downloadButton.click();
      
      // Wait to see what happens
      await page.waitForTimeout(5000);
      console.log('✅ Click successful, waiting for result...');
    } else {
      console.log('❌ Button still disabled');
      
      // Check for any error messages or indicators
      const errorMsg = await page.locator('.error, .alert, .warning').textContent().catch(() => null);
      if (errorMsg) {
        console.log('Error message found:', errorMsg);
      }
    }
    
    // Keep browser open for manual inspection
    console.log('\n🔍 Browser staying open for inspection. Press Ctrl+C to close.');
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error('Debug failed:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  debugSquidlr().catch(console.error);
}