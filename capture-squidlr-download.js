// Capture the final Squidlr download URL by clicking the Download button
const { chromium } = require('playwright');

async function captureSquidlrDownload() {
  console.log('🧪 Capturing Squidlr download URL...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome'
  });
  
  try {
    const page = await browser.newPage();
    
    // Monitor ALL download events and URLs
    const capturedUrls = [];
    
    page.on('download', download => {
      console.log(`📥 DOWNLOAD EVENT: ${download.url()}`);
      console.log(`📥 FILENAME: ${download.suggestedFilename()}\n`);
      capturedUrls.push({
        type: 'download_event',
        url: download.url(),
        filename: download.suggestedFilename()
      });
    });
    
    page.on('response', async response => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';
      
      if (
        url.includes('.mp4') ||
        url.includes('.mp3') ||
        url.includes('cdninstagram') ||
        url.includes('scontent') ||
        contentType.includes('video/') ||
        contentType.includes('audio/') ||
        (url.includes('download') && !url.includes('squidlr.com'))
      ) {
        console.log(`🎯 VIDEO URL: ${url}`);
        console.log(`   Content-Type: ${contentType}\n`);
        capturedUrls.push({
          type: 'response',
          url: url,
          contentType: contentType
        });
      }
    });
    
    const directUrl = 'https://www.squidlr.com/download?url=https://www.instagram.com/reel/DMw7_HDusQY/';
    console.log(`🔗 Loading: ${directUrl}`);
    
    // Navigate to the direct URL
    await page.goto(directUrl, { waitUntil: 'networkidle' });
    
    console.log('⏳ Waiting for page to fully load...');
    await page.waitForTimeout(5000);
    
    // Check if we're in the success state (like your screenshot)
    const pageState = await page.evaluate(() => {
      const downloadBtn = document.querySelector('button:has-text("Download"), .btn:has-text("Download"), [role="button"]:has-text("Download")');
      const videoInfo = document.body.textContent;
      
      return {
        hasDownloadButton: !!downloadBtn,
        downloadButtonEnabled: downloadBtn ? !downloadBtn.disabled : false,
        hasVideoInfo: videoInfo.includes('Video #1') || videoInfo.includes('MB'),
        pageText: document.body.textContent.slice(0, 300)
      };
    });
    
    console.log('Page state:', pageState);
    
    if (pageState.hasDownloadButton && pageState.downloadButtonEnabled) {
      console.log('✅ Found enabled download button! Clicking...');
      
      // Try different selectors for the download button
      const downloadSelectors = [
        'button:has-text("Download")',
        '.btn:has-text("Download")',
        '[role="button"]:has-text("Download")',
        'button[type="button"]:has-text("Download")',
        'div:has-text("Download")'
      ];
      
      let clicked = false;
      for (const selector of downloadSelectors) {
        try {
          const element = await page.locator(selector).first();
          if (await element.isVisible() && await element.isEnabled()) {
            console.log(`🚀 Clicking download with selector: ${selector}`);
            await element.click();
            clicked = true;
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      if (clicked) {
        console.log('⏳ Waiting for download to start...');
        await page.waitForTimeout(10000);
      } else {
        console.log('❌ Could not click download button');
      }
      
    } else {
      console.log('❌ Download button not found or not enabled');
      console.log('Page text:', pageState.pageText);
    }
    
    console.log('\n📋 CAPTURED DOWNLOAD URLS:');
    if (capturedUrls.length > 0) {
      capturedUrls.forEach((item, i) => {
        console.log(`${i + 1}. [${item.type}] ${item.url}`);
        if (item.filename) console.log(`   📁 Filename: ${item.filename}`);
        if (item.contentType) console.log(`   📄 Content-Type: ${item.contentType}`);
        console.log('');
      });
    } else {
      console.log('❌ No download URLs captured');
    }
    
    console.log('\n🔍 Browser staying open for 15 seconds...');
    await page.waitForTimeout(15000);
    
  } catch (error) {
    console.error('❌ Squidlr download capture failed:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  captureSquidlrDownload().catch(console.error);
}