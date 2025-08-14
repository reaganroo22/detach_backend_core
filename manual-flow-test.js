// Manual flow exactly as shown in screenshots
const { chromium } = require('playwright');

async function manualFlowTest() {
  console.log('🧪 Manual flow test - exactly as screenshots show...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome'
  });
  
  try {
    const page = await browser.newPage();
    
    // Monitor for any direct video URLs
    const videoUrls = [];
    
    page.on('response', async response => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';
      
      if (
        url.includes('googlevideo') ||
        url.includes('ytimg.com') ||
        url.includes('youtube.com') ||
        contentType.includes('video/') ||
        url.includes('.mp4')
      ) {
        console.log(`🎯 POTENTIAL VIDEO: ${url}`);
        console.log(`   Content-Type: ${contentType}\n`);
        videoUrls.push({ url, contentType });
      }
    });
    
    page.on('download', download => {
      console.log(`📥 DOWNLOAD EVENT: ${download.url()}`);
      console.log(`📥 FILENAME: ${download.suggestedFilename()}\n`);
      videoUrls.push({ url: download.url(), type: 'download', filename: download.suggestedFilename() });
    });
    
    console.log('📱 Step 1: Navigate to SSVid.net');
    await page.goto('https://ssvid.net/en');
    await page.waitForTimeout(2000);
    
    console.log('📝 Step 2: Input YouTube URL');
    await page.fill('#search__input', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    
    console.log('🚀 Step 3: Click Start');
    await page.click('button:has-text("Start")');
    await page.waitForTimeout(8000);
    
    console.log('🔧 Step 4: Click Convert');
    await page.click('button:has-text("Convert")');
    await page.waitForTimeout(5000);
    
    console.log('📥 Step 5: Look for and click Download button');
    
    // Try different approaches to find the download button
    const downloadButton = await page.locator('.btn:has-text("Download"), button:has-text("Download")').first();
    
    if (await downloadButton.isVisible()) {
      console.log('✅ Found Download button - clicking now!');
      await downloadButton.click();
      
      console.log('⏳ Waiting 10 seconds for download processing...');
      await page.waitForTimeout(10000);
      
    } else {
      console.log('❌ Download button not found - checking page state');
      const pageState = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, .btn'));
        return buttons.map(btn => ({
          text: btn.textContent.trim(),
          visible: btn.offsetParent !== null,
          disabled: btn.disabled
        })).filter(btn => btn.text.toLowerCase().includes('download'));
      });
      console.log('Download buttons found:', pageState);
    }
    
    console.log('\n📋 FINAL RESULTS:');
    if (videoUrls.length > 0) {
      videoUrls.forEach((item, i) => {
        console.log(`${i + 1}. ${item.url}`);
        if (item.contentType) console.log(`   Type: ${item.contentType}`);
        if (item.filename) console.log(`   File: ${item.filename}`);
        console.log('');
      });
    } else {
      console.log('❌ No video URLs captured');
    }
    
    // Keep browser open for manual verification
    console.log('🔍 Keeping browser open for 20 seconds for manual inspection...');
    await page.waitForTimeout(20000);
    
  } catch (error) {
    console.error('❌ Manual flow failed:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  manualFlowTest().catch(console.error);
}