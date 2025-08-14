// Simple script focused on clicking download and capturing the real URL
const { chromium } = require('playwright');

async function simpleDownloadClick() {
  console.log('🧪 Simple download click test...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome'
  });
  
  try {
    const page = await browser.newPage();
    
    // Only capture video URLs
    page.on('response', async response => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';
      
      if (
        url.includes('googlevideo') ||
        contentType.includes('video/mp4') ||
        contentType.includes('video/webm') ||
        contentType.includes('audio/mp4')
      ) {
        console.log(`🎯 VIDEO URL: ${url}`);
        console.log(`   Type: ${contentType}\n`);
      }
    });
    
    page.on('download', async download => {
      console.log(`📥 DOWNLOAD: ${download.url()}`);
      console.log(`📥 FILE: ${download.suggestedFilename()}\n`);
    });
    
    // Go to SSVid
    await page.goto('https://ssvid.net/en');
    console.log('✅ Page loaded');
    
    // Input URL
    await page.fill('#search__input', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.click('button:has-text("Start")');
    console.log('✅ Processing started');
    
    // Wait for convert buttons
    await page.waitForSelector('button:has-text("Convert")', { timeout: 15000 });
    console.log('✅ Convert buttons appeared');
    
    // Click convert
    await page.click('button:has-text("Convert")');
    console.log('✅ Convert clicked');
    
    // Wait for download modal
    await page.waitForSelector('button:has-text("Download"):visible', { timeout: 15000 });
    console.log('✅ Download button visible');
    
    // Click download and monitor
    console.log('🚀 Clicking Download NOW...');
    await page.click('button:has-text("Download")');
    
    // Wait for download to process
    console.log('⏳ Waiting 15 seconds for download...');
    await page.waitForTimeout(15000);
    
    console.log('✅ Done - check output above for video URLs');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  simpleDownloadClick().catch(console.error);
}