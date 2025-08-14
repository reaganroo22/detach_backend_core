// Capture the actual download URLs when clicking Convert buttons on SSVid
const { chromium } = require('playwright');

async function captureSSVidConvert() {
  console.log('🧪 Capturing SSVid.net Convert button download URLs...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome'
  });
  
  try {
    const page = await browser.newPage();
    
    // Set up comprehensive URL capture
    const capturedUrls = [];
    
    page.on('response', async response => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';
      
      // Capture any URLs that look like downloads
      if (
        url.includes('.mp4') || 
        url.includes('.mp3') || 
        url.includes('googlevideo') ||
        url.includes('download') ||
        contentType.includes('video/') ||
        contentType.includes('audio/') ||
        response.status() === 302 || // Redirects often lead to download URLs
        url.includes('convert') ||
        url.includes('file')
      ) {
        console.log(`🎯 CAPTURED URL: ${url}`);
        console.log(`   Status: ${response.status()}`);
        console.log(`   Content-Type: ${contentType}\n`);
        capturedUrls.push({
          url: url,
          status: response.status(),
          contentType: contentType
        });
      }
    });
    
    page.on('download', async download => {
      const downloadUrl = download.url();
      console.log(`📥 DOWNLOAD EVENT: ${downloadUrl}`);
      console.log(`📥 FILENAME: ${download.suggestedFilename()}\n`);
      capturedUrls.push({
        url: downloadUrl,
        type: 'download_event',
        filename: download.suggestedFilename()
      });
    });
    
    // Navigate to SSVid and process the URL
    console.log('📱 Going to SSVid.net...');
    await page.goto('https://ssvid.net/en', { waitUntil: 'networkidle' });
    
    const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    console.log(`📝 Processing URL: ${testUrl}`);
    
    await page.waitForSelector('#search__input');
    await page.fill('#search__input', testUrl);
    await page.click('button:has-text("Start")');
    
    console.log('⏳ Waiting for processing...');
    await page.waitForTimeout(8000);
    
    // Look for Convert buttons and click the first one
    console.log('🔍 Looking for Convert buttons...');
    const convertButtons = await page.locator('button:has-text("Convert"), a:has-text("Convert")');
    const buttonCount = await convertButtons.count();
    
    console.log(`Found ${buttonCount} Convert buttons`);
    
    if (buttonCount > 0) {
      console.log('🚀 Clicking first Convert button (720p)...');
      await convertButtons.nth(0).click();
      
      console.log('⏳ Waiting for conversion and download...');
      await page.waitForTimeout(10000);
      
      // Look for any download links that appeared
      const downloadLinks = await page.evaluate(() => {
        const links = [];
        document.querySelectorAll('a[href*=".mp4"], a[href*="download"], a[download]').forEach(el => {
          if (el.href && el.href.startsWith('http')) {
            links.push({
              text: el.textContent.trim(),
              url: el.href,
              hasDownloadAttr: el.hasAttribute('download')
            });
          }
        });
        return links;
      });
      
      if (downloadLinks.length > 0) {
        console.log('🎯 Found download links on page:');
        downloadLinks.forEach((link, i) => {
          console.log(`${i + 1}. ${link.text}`);
          console.log(`   📥 DOWNLOAD URL: ${link.url}`);
          console.log(`   Has download attr: ${link.hasDownloadAttr}\n`);
        });
      }
      
      // Try clicking another convert button for different quality
      if (buttonCount > 1) {
        console.log('🚀 Clicking second Convert button (480p)...');
        await convertButtons.nth(1).click();
        await page.waitForTimeout(8000);
      }
    }
    
    console.log('\n📋 FINAL SUMMARY OF ALL CAPTURED URLS:');
    if (capturedUrls.length > 0) {
      capturedUrls.forEach((item, i) => {
        console.log(`${i + 1}. ${item.url}`);
        if (item.filename) console.log(`   Filename: ${item.filename}`);
        if (item.status) console.log(`   Status: ${item.status}`);
        console.log('');
      });
    } else {
      console.log('❌ No URLs captured');
    }
    
    // Keep browser open for inspection
    console.log('🔍 Browser staying open for 10 seconds...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('❌ SSVid convert test failed:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  captureSSVidConvert().catch(console.error);
}