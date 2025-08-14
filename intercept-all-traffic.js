// Intercept ALL network traffic to find the real video URL
const { chromium } = require('playwright');

async function interceptAllTraffic() {
  console.log('🧪 Intercepting ALL network traffic during download...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome'
  });
  
  try {
    const page = await browser.newPage();
    
    // Capture EVERYTHING
    const allRequests = [];
    
    page.on('request', request => {
      console.log(`🔵 REQUEST: ${request.method()} ${request.url()}`);
      allRequests.push({type: 'request', url: request.url(), method: request.method()});
    });
    
    page.on('response', async response => {
      const url = response.url();
      const status = response.status();
      const contentType = response.headers()['content-type'] || '';
      
      console.log(`🟢 RESPONSE: ${status} ${url}`);
      console.log(`   Content-Type: ${contentType}`);
      
      // Highlight anything that looks like video content
      if (
        contentType.includes('video/') ||
        contentType.includes('audio/') ||
        url.includes('.mp4') ||
        url.includes('.mp3') ||
        url.includes('googlevideo') ||
        status >= 300 && status < 400 // Redirects
      ) {
        console.log(`🎯🎯🎯 POTENTIAL VIDEO: ${url} (${status}) ${contentType} 🎯🎯🎯`);
      }
      
      allRequests.push({
        type: 'response', 
        url: url, 
        status: status, 
        contentType: contentType
      });
      console.log('');
    });
    
    // Navigate to SSVid
    console.log('📱 Going to SSVid.net...');
    await page.goto('https://ssvid.net/en', { waitUntil: 'networkidle' });
    
    const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    console.log(`📝 Processing: ${testUrl}`);
    
    await page.waitForSelector('#search__input');
    await page.fill('#search__input', testUrl);
    await page.click('button:has-text("Start")');
    
    console.log('⏳ Waiting for processing...');
    await page.waitForTimeout(6000);
    
    // Click Convert
    console.log('🚀 Clicking Convert...');
    const convertButtons = await page.locator('button:has-text("Convert")');
    await convertButtons.nth(0).click();
    await page.waitForTimeout(3000);
    
    // Click Download
    console.log('🚀 Clicking Download...');
    await page.click('button:has-text("Download")');
    
    console.log('⏳ Monitoring all traffic after download click...');
    await page.waitForTimeout(8000);
    
    console.log('\n📋 SUMMARY - Looking for video URLs in all traffic:');
    const videoUrls = allRequests.filter(req => 
      req.url?.includes('googlevideo') ||
      req.url?.includes('.mp4') ||
      req.contentType?.includes('video/') ||
      req.contentType?.includes('audio/')
    );
    
    if (videoUrls.length > 0) {
      console.log('🎯 FOUND VIDEO URLS:');
      videoUrls.forEach((item, i) => {
        console.log(`${i + 1}. [${item.type}] ${item.url}`);
        if (item.status) console.log(`   Status: ${item.status}`);
        if (item.contentType) console.log(`   Type: ${item.contentType}`);
        console.log('');
      });
    } else {
      console.log('❌ No video URLs found in traffic');
    }
    
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error('❌ Traffic interception failed:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  interceptAllTraffic().catch(console.error);
}