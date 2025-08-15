const { chromium } = require('playwright');

async function testChrome() {
  console.log('🚀 Testing Chrome...');
  
  try {
    const browser = await chromium.launch({
      headless: true,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    console.log('✅ Browser launched');
    
    const page = await browser.newPage();
    console.log('✅ Page created');
    
    await page.goto('https://www.google.com');
    console.log('✅ Navigated to Google');
    
    const title = await page.title();
    console.log(`✅ Page title: ${title}`);
    
    await browser.close();
    console.log('✅ Browser closed successfully');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testChrome();