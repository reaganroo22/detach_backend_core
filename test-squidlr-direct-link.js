// Test the direct Squidlr link you provided
const { chromium } = require('playwright');

async function testSquidlrDirectLink() {
  console.log('🧪 Testing direct Squidlr link...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome'
  });
  
  try {
    const page = await browser.newPage();
    
    // Monitor downloads and responses
    page.on('download', download => {
      console.log(`📥 DOWNLOAD: ${download.url()}`);
      console.log(`📥 FILE: ${download.suggestedFilename()}\n`);
    });
    
    page.on('response', async response => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';
      
      if (
        url.includes('.mp4') ||
        url.includes('.mp3') ||
        url.includes('download') ||
        url.includes('cdninstagram') ||
        url.includes('instagram') ||
        contentType.includes('video/') ||
        contentType.includes('audio/')
      ) {
        console.log(`🎯 POTENTIAL DOWNLOAD: ${url}`);
        console.log(`   Type: ${contentType}\n`);
      }
    });
    
    const directUrl = 'https://www.squidlr.com/download?url=https://www.instagram.com/reel/DMw7_HDusQY/';
    console.log(`🔗 Testing URL: ${directUrl}`);
    
    // Navigate to the direct URL
    await page.goto(directUrl, { waitUntil: 'networkidle' });
    
    console.log('⏳ Waiting for page to load...');
    await page.waitForTimeout(5000);
    
    // Check if download button exists and is enabled
    const buttonInfo = await page.evaluate(() => {
      const btn = document.querySelector('#download-button');
      return {
        exists: !!btn,
        enabled: btn ? !btn.disabled : false,
        text: btn ? btn.textContent.trim() : null,
        visible: btn ? btn.offsetParent !== null : false
      };
    });
    
    console.log('Button info:', buttonInfo);
    
    if (buttonInfo.exists && buttonInfo.enabled) {
      console.log('✅ Download button is enabled! Clicking...');
      await page.click('#download-button');
      
      console.log('⏳ Waiting for download to start...');
      await page.waitForTimeout(10000);
      
      // Check for any download links that appeared
      const links = await page.evaluate(() => {
        const foundLinks = [];
        document.querySelectorAll('a[href*=".mp4"], a[href*=".mp3"], a[href*="download"], a[download]').forEach(el => {
          if (el.href && el.href.startsWith('http')) {
            foundLinks.push({
              text: el.textContent.trim(),
              url: el.href,
              hasDownload: el.hasAttribute('download')
            });
          }
        });
        return foundLinks;
      });
      
      if (links.length > 0) {
        console.log('🎯 Found download links:');
        links.forEach((link, i) => {
          console.log(`${i + 1}. ${link.text}`);
          console.log(`   📥 URL: ${link.url}`);
          console.log(`   Has download attr: ${link.hasDownload}\n`);
        });
      }
    } else if (buttonInfo.exists && !buttonInfo.enabled) {
      console.log('❌ Button exists but is disabled');
      
      // Check for error messages
      const pageContent = await page.evaluate(() => {
        return {
          title: document.title,
          bodyText: document.body.textContent.slice(0, 500),
          hasError: document.body.textContent.toLowerCase().includes('error'),
          urlInputValue: document.querySelector('#url')?.value || 'not found'
        };
      });
      
      console.log('Page analysis:', pageContent);
    } else {
      console.log('❌ Download button not found');
    }
    
    console.log('\n🔍 Browser staying open for 15 seconds...');
    await page.waitForTimeout(15000);
    
  } catch (error) {
    console.error('❌ Direct link test failed:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  testSquidlrDirectLink().catch(console.error);
}