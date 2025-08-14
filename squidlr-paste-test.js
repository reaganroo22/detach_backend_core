const { chromium } = require('playwright');

async function testSquidlrPaste() {
  console.log('🔄 Starting Squidlr.com paste test...');
  
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  let capturedUrls = [];
  
  // Monitor downloads
  page.on('download', async download => {
    console.log(`📥 DOWNLOAD INTERCEPTED: ${download.url()}`);
    console.log(`📁 Filename: ${download.suggestedFilename()}`);
    capturedUrls.push({
      type: 'download_file',
      url: download.url(),
      filename: download.suggestedFilename(),
      timestamp: new Date().toISOString()
    });
  });
  
  // Monitor new tabs (like GetLoady)
  context.on('page', async (newPage) => {
    console.log(`🆕 NEW TAB OPENED: ${newPage.url()}`);
    await newPage.waitForLoadState('networkidle').catch(() => {});
    const newUrl = newPage.url();
    
    // Check if it's a direct download URL
    if (newUrl.includes('.mp4') || newUrl.includes('.mp3') || newUrl.includes('download') || newUrl.includes('dl.')) {
      console.log('🎯 DIRECT DOWNLOAD URL FOUND IN NEW TAB!');
      capturedUrls.push({
        type: 'new_tab_download',
        url: newUrl,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  try {
    // Go to Squidlr.com - test Facebook with user provided URL
    console.log('📍 Navigating to squidlr.com/facebook...');
    await page.goto('https://squidlr.com/facebook', { waitUntil: 'networkidle' });
    
    // Wait for page to fully load (longer wait)
    await page.waitForTimeout(5000);
    
    // Find input field
    console.log('🔍 Looking for input field...');
    const inputSelector = 'input[type="text"], input[placeholder*="URL"], input[placeholder*="link"], textarea';
    await page.waitForSelector(inputSelector, { timeout: 15000 });
    
    // Use actual Facebook reel URL provided by user
    const testUrl = 'https://www.facebook.com/iamkybaldwin/videos/facebook-only-allows-90-seconds-on-reels-so-heres-the-extended-version-heyjude-t/316203414406924/';
    console.log(`📋 Pasting URL: ${testUrl}`);
    
    // Clear and paste the URL (as specified by user - must paste, not type)
    await page.fill(inputSelector, '');
    await page.evaluate(async (url) => {
      await navigator.clipboard.writeText(url);
    }, testUrl);
    
    // Focus and paste
    await page.focus(inputSelector);
    await page.keyboard.press('Meta+V'); // Paste on Mac
    await page.waitForTimeout(1000);
    
    console.log('📋 URL pasted, now waiting for processing (NOT clicking initial button)...');
    
    // Wait for "download in progress" message and then the download (2.5 minutes max)
    console.log('⏳ Waiting for download processing (up to 2.5 minutes as specified)...');
    
    let downloadProcessed = false;
    const maxWait = 150000; // 2.5 minutes
    const checkInterval = 15000; // 15 seconds  
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait && !downloadProcessed) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`⏳ Checking for download completion... (${elapsed}s elapsed)`);
      
      // Check for specific cloud download icon elements
      try {
        // Look for the specific cloud download icon span
        const cloudDownloadIcons = await page.$$('span.oi.oi-cloud-download, span[class*="oi-cloud-download"]');
        
        if (cloudDownloadIcons.length > 0) {
          console.log(`✅ Found ${cloudDownloadIcons.length} cloud download icons!`);
          
          // Click the first cloud download icon (best quality)
          const firstIcon = cloudDownloadIcons[0];
          
          // Try clicking the icon itself or its parent clickable element
          try {
            await firstIcon.click();
            console.log('🖱️ Clicked cloud download icon directly');
          } catch (e) {
            // If direct click fails, try clicking the parent element
            const parentElement = await firstIcon.evaluateHandle(el => el.closest('button, a, [onclick], [role="button"]'));
            if (parentElement) {
              await parentElement.click();
              console.log('🖱️ Clicked cloud download icon parent element');
            } else {
              console.log('⚠️ Could not find clickable parent for cloud download icon');
            }
          }
          
          downloadProcessed = true;
        } else {
          console.log('⚠️ No cloud download icons found, trying fallback method...');
          
          // Fallback: look for any buttons with download-related content
          const downloadButtons = await page.$$('button');
          for (const btn of downloadButtons) {
            const isVisible = await btn.isVisible();
            const isEnabled = !await btn.isDisabled();
            
            if (isVisible && isEnabled) {
              const btnContent = await btn.innerHTML().catch(() => '');
              const btnText = await btn.textContent().catch(() => '');
              
              if (btnContent.includes('download') || 
                  btnContent.includes('cloud') || 
                  btnText.toLowerCase().includes('download')) {
                
                console.log('✅ Found download button via fallback!');
                await btn.click();
                console.log('🖱️ Clicked download button');
                downloadProcessed = true;
                break;
              }
            }
          }
        }
      } catch (e) {
        console.log('⚠️ Error checking download elements:', e.message);
      }
      
      // Also check for download links
      const downloadLinks = await page.$$eval('a[download], a[href*=".mp4"], a[href*=".mp3"]', links => 
        links.map(link => ({ href: link.href, text: link.textContent?.trim() }))
      ).catch(() => []);
      
      if (downloadLinks.length > 0 && !downloadProcessed) {
        console.log('✅ Download links found!');
        downloadProcessed = true;
        
        // Click the first download link
        try {
          const firstDownloadLink = await page.locator('a[download], a[href*=".mp4"], a[href*=".mp3"]').first();
          await firstDownloadLink.click();
          console.log('🖱️ Clicked download link');
        } catch (e) {
          console.log('⚠️ Could not click download link');
        }
      }
      
      if (!downloadProcessed) {
        await page.waitForTimeout(checkInterval);
      }
    }
    
    if (!downloadProcessed) {
      console.log('❌ Download not ready after 2.5 minutes - deeming unsuccessful');
    }
    
    // Look for final download button after processing
    console.log('🔍 Looking for final download button...');
    try {
      const finalDownloadBtn = await page.waitForSelector('a[download], button:has-text("Download"), .download-link', { timeout: 10000 });
      if (finalDownloadBtn) {
        console.log('🖱️ Clicking final download button...');
        await finalDownloadBtn.click();
        await page.waitForTimeout(3000);
      }
    } catch (e) {
      console.log('⚠️ No final download button found, checking for direct downloads...');
    }
    
  } catch (error) {
    console.error('❌ Error during Squidlr test:', error.message);
  }
  
  console.log('\n📊 SQUIDLR TEST RESULTS:');
  console.log('========================');
  
  if (capturedUrls.length > 0) {
    capturedUrls.forEach((capture, index) => {
      console.log(`\n${index + 1}. ${capture.type.toUpperCase()}`);
      console.log(`   URL: ${capture.url}`);
      if (capture.filename) console.log(`   Filename: ${capture.filename}`);
      console.log(`   Time: ${capture.timestamp}`);
    });
    
    console.log('\n✅ SUCCESS: Captured download URLs from Squidlr!');
  } else {
    console.log('\n❌ NO DOWNLOADS CAPTURED');
    
    // Check current page content for debugging
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
    
    // Look for any download links on the page
    const downloadLinks = await page.$$eval('a[href*="download"], a[href*=".mp4"], a[href*=".mp3"]', links => 
      links.map(link => ({ href: link.href, text: link.textContent?.trim() }))
    );
    
    if (downloadLinks.length > 0) {
      console.log('\n📎 Found potential download links:');
      downloadLinks.forEach((link, i) => {
        console.log(`${i + 1}. ${link.href} (${link.text})`);
      });
    }
  }
  
  await browser.close();
  return capturedUrls;
}

// Run the test
testSquidlrPaste().catch(console.error);