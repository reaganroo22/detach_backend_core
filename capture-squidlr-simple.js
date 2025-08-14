// Simple Squidlr download capture using proper selectors
const { chromium } = require('playwright');

async function captureSquidlrSimple() {
  console.log('🧪 Simple Squidlr download capture...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome'
  });
  
  try {
    const page = await browser.newPage();
    
    // Monitor downloads
    page.on('download', download => {
      console.log(`📥 DOWNLOAD EVENT: ${download.url()}`);
      console.log(`📥 FILENAME: ${download.suggestedFilename()}\n`);
    });
    
    page.on('response', async response => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';
      
      if (
        url.includes('.mp4') ||
        url.includes('cdninstagram') ||
        url.includes('scontent') ||
        contentType.includes('video/')
      ) {
        console.log(`🎯 VIDEO URL: ${url}`);
        console.log(`   Content-Type: ${contentType}\n`);
      }
    });
    
    const directUrl = 'https://www.squidlr.com/download?url=https://www.instagram.com/reel/DMw7_HDusQY/';
    console.log(`🔗 Loading: ${directUrl}`);
    
    await page.goto(directUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);
    
    // Find download button using simple JavaScript
    const downloadInfo = await page.evaluate(() => {
      // Look for buttons containing "Download" text
      const buttons = Array.from(document.querySelectorAll('button, .btn, [role="button"]'));
      const downloadButtons = buttons.filter(btn => 
        btn.textContent && btn.textContent.toLowerCase().includes('download')
      );
      
      return {
        totalButtons: buttons.length,
        downloadButtons: downloadButtons.length,
        downloadButtonTexts: downloadButtons.map(btn => btn.textContent.trim()),
        hasVideoInfo: document.body.textContent.includes('Video #1'),
        pageTitle: document.title
      };
    });
    
    console.log('Download info:', downloadInfo);
    
    if (downloadInfo.downloadButtons > 0) {
      console.log('✅ Found download button(s)! Attempting to click...');
      
      // Use Playwright's text selector which works correctly
      try {
        await page.click('text=Download');
        console.log('🚀 Clicked download button!');
        
        console.log('⏳ Waiting for download...');
        await page.waitForTimeout(10000);
        
      } catch (e) {
        console.log('❌ Could not click with text selector, trying alternative...');
        
        // Try clicking any button with "Download" in text
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, .btn'));
          const downloadBtn = buttons.find(btn => 
            btn.textContent && btn.textContent.toLowerCase().includes('download')
          );
          if (downloadBtn) {
            downloadBtn.click();
          }
        });
        
        await page.waitForTimeout(8000);
      }
    } else {
      console.log('❌ No download buttons found');
    }
    
    console.log('\n🔍 Browser staying open for 15 seconds...');
    await page.waitForTimeout(15000);
    
  } catch (error) {
    console.error('❌ Simple capture failed:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  captureSquidlrSimple().catch(console.error);
}