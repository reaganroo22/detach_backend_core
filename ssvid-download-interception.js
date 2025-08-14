// SSVid.net - Intercept DOWNLOAD FILE with URL
const { chromium } = require('playwright');

async function ssvidDownloadInterception() {
  console.log('🧪 SSVid.net - DOWNLOAD FILE Interception...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome'
  });
  
  try {
    const page = await browser.newPage();
    
    // Capture download files and URLs
    const capturedUrls = [];
    
    page.on('download', async download => {
      console.log(`📥 DOWNLOAD FILE INTERCEPTED: ${download.url()}`);
      console.log(`📁 Filename: ${download.suggestedFilename()}`);
      
      // Save the download path info
      const downloadInfo = {
        type: 'download_file',
        url: download.url(),
        filename: download.suggestedFilename(),
        timestamp: new Date().toISOString()
      };
      
      capturedUrls.push(downloadInfo);
      
      // Don't cancel the download - let it proceed
      console.log('💾 Allowing download to proceed...');
    });
    
    // Also capture any direct URLs
    page.on('response', async response => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';
      
      if (
        url.includes('dmate') ||
        url.includes('dl180') ||
        url.includes('.mp4') ||
        contentType.includes('video/') ||
        contentType.includes('audio/')
      ) {
        console.log(`🎯 POTENTIAL DOWNLOAD URL: ${url}`);
        console.log(`   Content-Type: ${contentType}\n`);
        
        capturedUrls.push({
          type: 'response_url',
          url: url,
          contentType: contentType,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    const youtubeUrl = 'https://www.youtube.com/shorts/0Pwt8wcSjmY';
    console.log(`🎯 Testing URL: ${youtubeUrl}`);
    
    // Navigate to SSVid.net
    await page.goto('https://ssvid.net/en', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Input URL undetectably
    console.log('📝 Inputting URL undetectably...');
    const input = await page.locator('#search__input');
    await input.click();
    await input.fill(''); // Clear first
    
    // Type slowly and undetectably
    for (let char of youtubeUrl) {
      await input.type(char, { delay: Math.random() * 80 + 40 }); // 40-120ms delay
    }
    
    await page.waitForTimeout(1000);
    
    // Click "Start"
    console.log('🚀 Clicking "Start"...');
    await page.click('button:has-text("Start")');
    
    console.log('⏳ Waiting for file type options...');
    await page.waitForTimeout(8000);
    
    // Look for Convert buttons and click one
    console.log('🔧 Looking for Convert buttons...');
    const convertButtons = await page.locator('button:has-text("Convert")');
    const buttonCount = await convertButtons.count();
    
    console.log(`Found ${buttonCount} Convert buttons`);
    
    if (buttonCount > 0) {
      console.log('🚀 Clicking first Convert button...');
      await convertButtons.nth(0).click();
      
      console.log('⏳ Waiting for conversion to complete (up to 2.5 minutes)...');
      await page.waitForTimeout(5000);
      
      // Wait for Download button to appear after conversion (up to 2.5 minutes)
      console.log('🔍 Looking for Download button (waiting up to 2.5 minutes)...');
      const downloadSelectors = [
        'button:has-text("Download")',
        '.btn:has-text("Download")',
        'a:has-text("Download")',
        '[role="button"]:has-text("Download")'
      ];
      
      let downloadClicked = false;
      const maxWaitTime = 150000; // 2.5 minutes
      const checkInterval = 15000; // 15 seconds
      const startTime = Date.now();
      
      // Check for download button every 15 seconds, up to 2.5 minutes
      while (Date.now() - startTime < maxWaitTime && !downloadClicked) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        console.log(`⏳ Checking for download button... (${elapsed}s elapsed)`);
        
        for (const selector of downloadSelectors) {
          try {
            const downloadBtn = await page.locator(selector).first();
            if (await downloadBtn.isVisible()) {
              console.log(`🚀 Found and clicking Download button: ${selector}`);
              await downloadBtn.click();
              downloadClicked = true;
              break;
            }
          } catch (e) {
            // Continue to next selector
          }
        }
        
        if (!downloadClicked) {
          console.log(`⏳ No download button yet, waiting 15 more seconds...`);
          await page.waitForTimeout(checkInterval);
        }
      }
      
      if (!downloadClicked) {
        console.log(`❌ Download button not found after 2.5 minutes - deeming unsuccessful`);
      }
      
      if (downloadClicked) {
        console.log('⏳ Waiting for download file...');
        await page.waitForTimeout(10000);
      } else {
        console.log('❌ Could not find Download button');
      }
    } else {
      console.log('❌ No Convert buttons found');
    }
    
    console.log('\n📋 CAPTURED DOWNLOAD DATA:');
    if (capturedUrls.length > 0) {
      capturedUrls.forEach((item, i) => {
        console.log(`${i + 1}. [${item.type}] ${item.url}`);
        if (item.filename) console.log(`   📁 Filename: ${item.filename}`);
        if (item.contentType) console.log(`   📄 Type: ${item.contentType}`);
        console.log(`   🕐 Time: ${item.timestamp}\n`);
      });
      
      // Look for the actual download URLs
      const downloadUrls = capturedUrls.filter(item => 
        item.type === 'download_file' || 
        item.url?.includes('dmate') || 
        item.url?.includes('dl180')
      );
      
      if (downloadUrls.length > 0) {
        console.log('🎯 EXTRACTED DOWNLOAD URLS:');
        downloadUrls.forEach((item, i) => {
          console.log(`${i + 1}. ${item.url}`);
        });
      }
    } else {
      console.log('❌ No download data captured');
    }
    
    console.log('\n🔍 Browser staying open for 15 seconds...');
    await page.waitForTimeout(15000);
    
  } catch (error) {
    console.error('❌ SSVid download interception failed:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  ssvidDownloadInterception().catch(console.error);
}