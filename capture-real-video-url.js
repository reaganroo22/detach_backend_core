// Click Download and capture the REAL direct video URL that it resolves to
const { chromium } = require('playwright');

async function captureRealVideoUrl() {
  console.log('🧪 Clicking Download to capture the real direct video URL...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome'
  });
  
  try {
    const page = await browser.newPage();
    
    // Capture the actual video URLs that the download resolves to
    const realVideoUrls = [];
    
    page.on('response', async response => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';
      
      // Look for actual direct video URLs (not the encoded proxy URLs)
      if (
        (url.includes('googlevideo') || 
         url.includes('ytimg') || 
         url.includes('cdninstagram') ||
         url.includes('tiktokcdn') ||
         url.includes('facebook') ||
         contentType.includes('video/') ||
         contentType.includes('audio/')) &&
        !url.includes('dmate') && // Exclude the proxy URLs
        !url.includes('dl180')
      ) {
        console.log(`🎯 REAL VIDEO URL FOUND: ${url}`);
        console.log(`   Content-Type: ${contentType}`);
        console.log(`   Status: ${response.status()}\n`);
        realVideoUrls.push({
          url: url,
          contentType: contentType,
          status: response.status()
        });
      }
    });
    
    // Also capture download events
    page.on('download', async download => {
      console.log(`📥 DOWNLOAD EVENT: ${download.url()}`);
      // Don't cancel - let it proceed to see what URL it resolves to
    });
    
    // Navigate to SSVid and process
    console.log('📱 Going to SSVid.net...');
    await page.goto('https://ssvid.net/en', { waitUntil: 'networkidle' });
    
    const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    console.log(`📝 Processing: ${testUrl}`);
    
    await page.waitForSelector('#search__input');
    await page.fill('#search__input', testUrl);
    await page.click('button:has-text("Start")');
    
    console.log('⏳ Waiting for processing...');
    await page.waitForTimeout(8000);
    
    // Click Convert
    console.log('🚀 Clicking Convert...');
    const convertButtons = await page.locator('button:has-text("Convert")');
    await convertButtons.nth(0).click();
    await page.waitForTimeout(5000);
    
    // Click Download and let it actually download to capture real URL
    console.log('🚀 Clicking Download to trigger real video URL...');
    await page.click('button:has-text("Download")');
    
    console.log('⏳ Waiting for real video URL to be resolved...');
    await page.waitForTimeout(10000);
    
    console.log('\n🎯 CAPTURED REAL VIDEO URLS:');
    if (realVideoUrls.length > 0) {
      realVideoUrls.forEach((item, i) => {
        console.log(`${i + 1}. ${item.url}`);
        console.log(`   Content-Type: ${item.contentType}`);
        console.log(`   Status: ${item.status}\n`);
      });
    } else {
      console.log('❌ No real video URLs captured - only proxy URLs found');
    }
    
    // Keep browser open for inspection
    console.log('🔍 Browser staying open for 10 seconds...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('❌ Real video URL capture failed:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  captureRealVideoUrl().catch(console.error);
}