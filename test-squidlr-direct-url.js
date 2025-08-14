// Test Squidlr.com using the direct URL pattern you provided
const { chromium } = require('playwright');

async function testSquidlrDirectUrl() {
  console.log('🧪 Testing Squidlr.com direct URL pattern...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome'
  });
  
  try {
    const page = await browser.newPage();
    
    // Monitor downloads
    page.on('download', download => {
      console.log(`📥 DOWNLOAD: ${download.url()}`);
      console.log(`📥 FILE: ${download.suggestedFilename()}\n`);
    });
    
    page.on('response', async response => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';
      
      if (
        url.includes('.mp4') ||
        url.includes('download') ||
        url.includes('cdninstagram') ||
        contentType.includes('video/')
      ) {
        console.log(`🎯 DOWNLOAD URL: ${url}`);
        console.log(`   Type: ${contentType}\n`);
      }
    });
    
    // Use a real, working Instagram URL
    const realInstagramUrl = 'https://www.instagram.com/p/CyQzKzMLVeB/'; // Real Instagram post
    const encodedUrl = encodeURIComponent(realInstagramUrl);
    const directSquidlrUrl = `https://www.squidlr.com/download?url=${encodedUrl}`;
    
    console.log(`📱 Using real Instagram URL: ${realInstagramUrl}`);
    console.log(`🔗 Direct Squidlr URL: ${directSquidlrUrl}`);
    
    // Navigate directly to the Squidlr download URL
    await page.goto(directSquidlrUrl, { waitUntil: 'networkidle' });
    
    console.log('⏳ Waiting for page to load and process...');
    await page.waitForTimeout(5000);
    
    // Check if download button is enabled
    const downloadButton = await page.locator('#download-button');
    const isEnabled = await downloadButton.isEnabled().catch(() => false);
    
    console.log(`Download button enabled: ${isEnabled}`);
    
    if (isEnabled) {
      console.log('✅ Button enabled! Clicking download...');
      await downloadButton.click();
      
      console.log('⏳ Waiting for download...');
      await page.waitForTimeout(10000);
      
      // Check for download links
      const links = await page.evaluate(() => {
        const foundLinks = [];
        document.querySelectorAll('a[href*=".mp4"], a[href*="download"], a[download]').forEach(el => {
          if (el.href && el.href.startsWith('http')) {
            foundLinks.push({
              text: el.textContent.trim(),
              url: el.href
            });
          }
        });
        return foundLinks;
      });
      
      if (links.length > 0) {
        console.log('🎯 Found download links:');
        links.forEach((link, i) => {
          console.log(`${i + 1}. ${link.text}`);
          console.log(`   📥 URL: ${link.url}\n`);
        });
      }
    } else {
      console.log('❌ Button still disabled. Checking page content...');
      
      const pageInfo = await page.evaluate(() => {
        return {
          title: document.title,
          hasError: document.body.textContent.toLowerCase().includes('error'),
          buttonExists: !!document.querySelector('#download-button'),
          buttonText: document.querySelector('#download-button')?.textContent,
          inputValue: document.querySelector('#url')?.value
        };
      });
      
      console.log('Page info:', pageInfo);
    }
    
    console.log('\n🔍 Browser staying open for 15 seconds...');
    await page.waitForTimeout(15000);
    
  } catch (error) {
    console.error('❌ Direct URL test failed:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  testSquidlrDirectUrl().catch(console.error);
}