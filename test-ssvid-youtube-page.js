// Test SSVid.net YouTube downloader page directly
const { chromium } = require('playwright');

async function testSSVidYouTubePage() {
  console.log('🧪 Testing SSVid.net YouTube downloader page directly...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome'
  });
  
  try {
    const page = await browser.newPage();
    
    // Go directly to YouTube downloader page
    console.log('📱 Navigating to SSVid YouTube downloader...');
    await page.goto('https://ssvid.net/youtube-downloader', { waitUntil: 'networkidle' });
    
    // Input the YouTube URL
    const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    console.log(`📝 Inputting URL: ${testUrl}`);
    
    // Wait for and find the input field
    await page.waitForSelector('input[type="url"], input[name*="url"], input[placeholder*="url"], #url, .url-input', { timeout: 10000 });
    
    // Try different possible input selectors
    const inputSelectors = [
      'input[type="url"]',
      'input[name*="url"]', 
      'input[placeholder*="url"]',
      '#url',
      '.url-input',
      'input[type="text"]'
    ];
    
    let inputFound = false;
    for (const selector of inputSelectors) {
      try {
        const input = await page.locator(selector).first();
        if (await input.isVisible()) {
          console.log(`✅ Found input with selector: ${selector}`);
          await input.fill(testUrl);
          inputFound = true;
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (!inputFound) {
      console.log('❌ No URL input field found');
      return;
    }
    
    // Look for and click download/submit button
    const buttonSelectors = [
      'button:has-text("Download")',
      'button:has-text("Start")', 
      'input[type="submit"]',
      '.download-btn',
      '#download'
    ];
    
    let buttonClicked = false;
    for (const selector of buttonSelectors) {
      try {
        const button = await page.locator(selector).first();
        if (await button.isVisible()) {
          console.log(`🚀 Clicking button: ${selector}`);
          await button.click();
          buttonClicked = true;
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (!buttonClicked) {
      console.log('❌ No download button found');
      return;
    }
    
    // Wait for results
    console.log('⏳ Waiting for download results...');
    await page.waitForTimeout(8000);
    
    // Look for actual download links
    const downloadLinks = await page.evaluate(() => {
      const links = [];
      
      // Look for direct download links
      const downloadElements = document.querySelectorAll('a[href*=".mp4"], a[href*=".mp3"], a[href*=".webm"], a[download], a[href*="googlevideo"], a[href*="youtube"]');
      downloadElements.forEach(el => {
        if (el.href && el.href.startsWith('http') && !el.href.includes('ssvid.net')) {
          links.push({
            text: el.textContent.trim(),
            url: el.href,
            type: 'download'
          });
        }
      });
      
      return links;
    });
    
    console.log('\n🎯 Found Download Links:');
    if (downloadLinks.length > 0) {
      downloadLinks.forEach((link, i) => {
        console.log(`${i + 1}. ${link.text}`);
        console.log(`   📥 DOWNLOAD URL: ${link.url}\n`);
      });
    } else {
      console.log('❌ No direct download URLs found');
      
      // Check what's on the page
      const pageInfo = await page.evaluate(() => {
        return {
          title: document.title,
          url: window.location.href,
          hasVideo: document.querySelector('video') !== null,
          hasDownloadButtons: document.querySelectorAll('[href*="download"], [onclick*="download"]').length
        };
      });
      
      console.log('Page Info:', pageInfo);
    }
    
    // Keep browser open for inspection
    console.log('🔍 Browser staying open for 15 seconds...');
    await page.waitForTimeout(15000);
    
  } catch (error) {
    console.error('❌ SSVid YouTube test failed:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  testSSVidYouTubePage().catch(console.error);
}