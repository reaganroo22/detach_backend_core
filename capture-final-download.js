// Capture the final download URL from the modal popup after clicking Convert then Download
const { chromium } = require('playwright');

async function captureFinalDownload() {
  console.log('🧪 Capturing final download URL from Convert -> Download flow...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome'
  });
  
  try {
    const page = await browser.newPage();
    
    // Capture ALL download URLs
    const finalUrls = [];
    
    page.on('response', async response => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';
      
      // Look for actual download URLs
      if (
        url.includes('.mp4') || 
        url.includes('.mp3') || 
        url.includes('download') ||
        url.includes('dmate') ||
        url.includes('dl180') ||
        contentType.includes('video/') ||
        contentType.includes('audio/') ||
        response.headers()['content-disposition']
      ) {
        console.log(`🎯 FINAL DOWNLOAD URL: ${url}`);
        console.log(`   Content-Type: ${contentType}`);
        console.log(`   Content-Disposition: ${response.headers()['content-disposition'] || 'none'}\n`);
        finalUrls.push({url, contentType, status: response.status()});
      }
    });
    
    page.on('download', async download => {
      console.log(`📥 DOWNLOAD EVENT: ${download.url()}`);
      console.log(`📥 FILENAME: ${download.suggestedFilename()}\n`);
      finalUrls.push({url: download.url(), type: 'download_event', filename: download.suggestedFilename()});
    });
    
    // Navigate to SSVid and process
    console.log('📱 Going to SSVid.net...');
    await page.goto('https://ssvid.net/en', { waitUntil: 'networkidle' });
    
    const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    console.log(`📝 Processing: ${testUrl}`);
    
    await page.waitForSelector('#search__input');
    await page.fill('#search__input', testUrl);
    await page.click('button:has-text("Start")');
    
    console.log('⏳ Waiting for video processing...');
    await page.waitForTimeout(8000);
    
    // Click the first Convert button (720p)
    console.log('🚀 Clicking Convert button for 720p...');
    const convertButtons = await page.locator('button:has-text("Convert")');
    await convertButtons.nth(0).click();
    
    console.log('⏳ Waiting for conversion...');
    await page.waitForTimeout(5000);
    
    // Look for the modal popup and Download button
    console.log('🔍 Looking for Download button in modal...');
    
    // Try different selectors for the Download button
    const downloadSelectors = [
      'button:has-text("Download")',
      'a:has-text("Download")', 
      '[data-bs-dismiss="modal"]:has-text("Download")',
      '.btn:has-text("Download")',
      '.modal button:has-text("Download")'
    ];
    
    let downloadClicked = false;
    for (const selector of downloadSelectors) {
      try {
        const downloadBtn = await page.locator(selector).first();
        if (await downloadBtn.isVisible()) {
          console.log(`✅ Found Download button with selector: ${selector}`);
          console.log('🚀 Clicking Download button...');
          await downloadBtn.click();
          downloadClicked = true;
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (!downloadClicked) {
      console.log('❌ Could not find Download button, checking page state...');
      
      // Debug what's visible
      const modalInfo = await page.evaluate(() => {
        const modals = document.querySelectorAll('.modal, [role="dialog"]');
        const buttons = document.querySelectorAll('button');
        return {
          modalCount: modals.length,
          buttonTexts: Array.from(buttons).map(b => b.textContent.trim()).filter(t => t.includes('Down'))
        };
      });
      console.log('Modal info:', modalInfo);
    } else {
      console.log('⏳ Waiting for download to start...');
      await page.waitForTimeout(8000);
    }
    
    console.log('\n📋 FINAL CAPTURED URLS:');
    if (finalUrls.length > 0) {
      finalUrls.forEach((item, i) => {
        console.log(`${i + 1}. ${item.url}`);
        if (item.filename) console.log(`   📁 Filename: ${item.filename}`);
        if (item.contentType) console.log(`   📄 Content-Type: ${item.contentType}`);
        if (item.status) console.log(`   📊 Status: ${item.status}`);
        console.log('');
      });
    } else {
      console.log('❌ No download URLs captured');
    }
    
    // Keep browser open for inspection
    console.log('🔍 Browser staying open for 10 seconds...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('❌ Final download capture failed:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  captureFinalDownload().catch(console.error);
}