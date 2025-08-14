// Test SSVid.net by actually inputting URLs and getting real download links
const { chromium } = require('playwright');

async function testSSVidReal() {
  console.log('🧪 Testing SSVid.net with real URL input...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome'
  });
  
  try {
    const page = await browser.newPage();
    
    // Navigate to SSVid
    console.log('📱 Navigating to SSVid.net...');
    await page.goto('https://ssvid.net/en', { waitUntil: 'networkidle' });
    
    // Input the YouTube URL
    const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    console.log(`📝 Inputting URL: ${testUrl}`);
    
    await page.waitForSelector('#search__input');
    await page.fill('#search__input', testUrl);
    
    // Click Start button
    console.log('🚀 Clicking Start button...');
    await page.click('button:has-text("Start")');
    
    // Wait for results page
    console.log('⏳ Waiting for download options...');
    await page.waitForTimeout(5000);
    
    // Look for download links
    const downloadLinks = await page.evaluate(() => {
      const links = [];
      
      // Look for download buttons/links
      const downloadElements = document.querySelectorAll('a[href*="download"], a[href*=".mp4"], a[href*=".mp3"], button[onclick*="download"]');
      downloadElements.forEach(el => {
        if (el.href && el.href.includes('http')) {
          links.push({
            text: el.textContent.trim(),
            url: el.href,
            type: 'link'
          });
        }
      });
      
      // Also check for any video/audio elements
      const mediaElements = document.querySelectorAll('video source, audio source');
      mediaElements.forEach(el => {
        if (el.src) {
          links.push({
            text: 'Media Source',
            url: el.src,
            type: 'media'
          });
        }
      });
      
      return links;
    });
    
    console.log('\n🎯 Found Download Links:');
    downloadLinks.forEach((link, i) => {
      console.log(`${i + 1}. ${link.text} (${link.type})`);
      console.log(`   URL: ${link.url}`);
    });
    
    // Also check the current page URL in case it redirects to download
    const currentUrl = page.url();
    console.log(`\n📍 Current Page URL: ${currentUrl}`);
    
    if (downloadLinks.length === 0) {
      console.log('\n🔍 No direct download links found. Checking page content...');
      const pageContent = await page.evaluate(() => {
        return {
          title: document.title,
          bodyText: document.body.textContent.slice(0, 500)
        };
      });
      console.log('Page Title:', pageContent.title);
      console.log('Page Content Preview:', pageContent.bodyText);
    }
    
    // Keep browser open for manual inspection
    console.log('\n🔍 Browser staying open for 10 seconds...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('❌ SSVid test failed:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  testSSVidReal().catch(console.error);
}