// Test GetLoady specifically with YouTube URL to see what we're getting
const { chromium } = require('playwright');

async function testGetloadyYoutube() {
  console.log('🧪 Testing GetLoady with YouTube URL...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome'
  });
  
  try {
    const page = await browser.newPage();
    
    // Capture ALL URLs and types
    const capturedData = [];
    
    page.on('response', async response => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';
      const status = response.status();
      
      // Log everything related to video/download
      if (
        url.includes('googlevideo') ||
        url.includes('youtube') ||
        url.includes('blob:') ||
        url.includes('getloady') ||
        contentType.includes('video/') ||
        contentType.includes('audio/') ||
        status >= 300 && status < 400 // Redirects
      ) {
        console.log(`📡 ${status} ${url}`);
        console.log(`   Content-Type: ${contentType}`);
        if (response.headers()['location']) {
          console.log(`   Location: ${response.headers()['location']}`);
        }
        console.log('');
        
        capturedData.push({
          url: url,
          contentType: contentType,
          status: status,
          location: response.headers()['location']
        });
      }
    });
    
    page.on('download', async download => {
      console.log(`📥 DOWNLOAD EVENT: ${download.url()}`);
      console.log(`📥 FILENAME: ${download.suggestedFilename()}\n`);
      capturedData.push({
        type: 'download_event',
        url: download.url(),
        filename: download.suggestedFilename()
      });
    });
    
    const youtubeUrl = 'https://www.youtube.com/shorts/0Pwt8wcSjmY';
    console.log(`🎯 Testing URL: ${youtubeUrl}`);
    
    // Navigate to GetLoady
    await page.goto('https://getloady.com', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Input YouTube URL
    await page.fill('#get-loady-url', youtubeUrl);
    await page.click('#get-loady-btn');
    
    console.log('⏳ Waiting for GetLoady to process...');
    await page.waitForTimeout(15000);
    
    // Look for download button and click it
    const downloadButton = await page.locator('button:has-text("Download"), .download-btn, #download-btn').first();
    
    if (await downloadButton.isVisible()) {
      console.log('🚀 Clicking download button...');
      await downloadButton.click();
      
      console.log('⏳ Waiting for download/URLs...');
      await page.waitForTimeout(10000);
    } else {
      console.log('❌ Download button not found');
    }
    
    console.log('\n📋 ALL CAPTURED DATA:');
    console.log('='.repeat(60));
    
    // Separate different types of URLs
    const googleVideoUrls = capturedData.filter(d => d.url?.includes('googlevideo'));
    const blobUrls = capturedData.filter(d => d.url?.includes('blob:'));
    const downloadEvents = capturedData.filter(d => d.type === 'download_event');
    
    if (googleVideoUrls.length > 0) {
      console.log('🎯 GOOGLE VIDEO URLs (WHAT WE WANT):');
      googleVideoUrls.forEach((item, i) => {
        console.log(`${i + 1}. ${item.url}`);
        console.log(`   Status: ${item.status}, Type: ${item.contentType}\n`);
      });
    }
    
    if (blobUrls.length > 0) {
      console.log('🔄 BLOB URLs (CURRENT CAPTURE):');
      blobUrls.forEach((item, i) => {
        console.log(`${i + 1}. ${item.url}`);
        console.log(`   Status: ${item.status}, Type: ${item.contentType}\n`);
      });
    }
    
    if (downloadEvents.length > 0) {
      console.log('📥 DOWNLOAD EVENTS:');
      downloadEvents.forEach((item, i) => {
        console.log(`${i + 1}. ${item.url}`);
        console.log(`   Filename: ${item.filename}\n`);
      });
    }
    
    console.log('\n🔍 ANALYSIS:');
    console.log(`Google Video URLs found: ${googleVideoUrls.length}`);
    console.log(`Blob URLs found: ${blobUrls.length}`);
    console.log(`Download events: ${downloadEvents.length}`);
    
    // Keep browser open for manual inspection
    console.log('\n🔍 Browser staying open for 15 seconds...');
    await page.waitForTimeout(15000);
    
  } catch (error) {
    console.error('❌ GetLoady test failed:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  testGetloadyYoutube().catch(console.error);
}