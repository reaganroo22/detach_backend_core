// Capture actual download URLs from SSVid and Squidlr
const { chromium } = require('playwright');

async function captureDownloadUrls() {
  console.log('🧪 Capturing real download URLs...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome'
  });
  
  try {
    const page = await browser.newPage();
    
    // Set up listeners to capture ALL network requests
    const downloadUrls = [];
    
    page.on('response', async response => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';
      
      // Check for video/audio content or download URLs
      if (
        url.includes('.mp4') || 
        url.includes('.mp3') || 
        url.includes('.webm') || 
        url.includes('googlevideo') ||
        url.includes('cdninstagram') ||
        url.includes('tiktokcdn') ||
        contentType.includes('video/') ||
        contentType.includes('audio/') ||
        url.includes('blob:')
      ) {
        console.log(`🎯 DOWNLOAD URL CAPTURED: ${url}`);
        console.log(`   Content-Type: ${contentType}`);
        console.log(`   Status: ${response.status()}\n`);
        downloadUrls.push(url);
      }
    });
    
    page.on('download', async download => {
      const downloadUrl = download.url();
      console.log(`📥 DIRECT DOWNLOAD INTERCEPTED: ${downloadUrl}`);
      downloadUrls.push(downloadUrl);
      // Don't cancel - let it proceed
    });
    
    // Test SSVid.net first
    console.log('=== TESTING SSVid.net ===');
    await page.goto('https://ssvid.net/en', { waitUntil: 'networkidle' });
    
    const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    console.log(`📝 Testing URL: ${testUrl}`);
    
    // Input URL and click start
    await page.waitForSelector('#search__input');
    await page.fill('#search__input', testUrl);
    await page.click('button:has-text("Start")');
    
    console.log('⏳ Waiting for SSVid processing...');
    await page.waitForTimeout(10000);
    
    // Now test Squidlr.com
    console.log('\n=== TESTING Squidlr.com ===');
    await page.goto('https://www.squidlr.com/', { waitUntil: 'networkidle' });
    
    const instagramUrl = 'https://www.instagram.com/p/B_Ua6ZbAoAA/';
    console.log(`📝 Testing Instagram URL: ${instagramUrl}`);
    
    await page.waitForSelector('#url');
    await page.type('#url', instagramUrl, { delay: 100 });
    await page.keyboard.press('Enter');
    
    console.log('⏳ Waiting for Squidlr validation...');
    await page.waitForTimeout(5000);
    
    // Try to click download if enabled
    try {
      const downloadButton = await page.locator('#download-button');
      if (await downloadButton.isEnabled()) {
        console.log('✅ Clicking Squidlr download button...');
        await downloadButton.click();
        await page.waitForTimeout(8000);
      } else {
        console.log('❌ Squidlr download button still disabled');
      }
    } catch (e) {
      console.log('❌ Squidlr button interaction failed:', e.message);
    }
    
    console.log('\n🎯 SUMMARY OF CAPTURED URLS:');
    if (downloadUrls.length > 0) {
      downloadUrls.forEach((url, i) => {
        console.log(`${i + 1}. ${url}`);
      });
    } else {
      console.log('❌ No download URLs captured');
    }
    
    // Final wait
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error('❌ URL capture failed:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  captureDownloadUrls().catch(console.error);
}