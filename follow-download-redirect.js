// Follow the download link to get the actual video URL
const { chromium } = require('playwright');

async function followDownloadRedirect() {
  console.log('🧪 Following download link to get actual video URL...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome'
  });
  
  try {
    const page = await browser.newPage();
    
    // Capture all redirects and final URLs
    const redirectChain = [];
    
    page.on('response', async response => {
      const url = response.url();
      const status = response.status();
      
      // Capture redirects and final video URLs
      if (
        status >= 300 && status < 400 || // Redirects
        url.includes('.mp4') || 
        url.includes('.mp3') || 
        url.includes('googlevideo') ||
        url.includes('ytimg') ||
        url.includes('youtube') ||
        response.headers()['content-type']?.includes('video/') ||
        response.headers()['content-type']?.includes('audio/')
      ) {
        const location = response.headers()['location'];
        console.log(`🔗 REDIRECT/VIDEO URL: ${url}`);
        console.log(`   Status: ${status}`);
        console.log(`   Content-Type: ${response.headers()['content-type'] || 'none'}`);
        if (location) console.log(`   Location: ${location}`);
        console.log('');
        
        redirectChain.push({
          url,
          status,
          location,
          contentType: response.headers()['content-type']
        });
      }
    });
    
    // Navigate to SSVid and process
    console.log('📱 Going to SSVid.net...');
    await page.goto('https://ssvid.net/en', { waitUntil: 'networkidle' });
    
    const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    console.log(`📝 Processing: ${testUrl}`);
    
    await page.waitForSelector('#search__input');
    await page.fill('#search__input', testUrl);
    await page.click('button:has-text("Start")');
    
    console.log('⏳ Waiting for processing...');
    await page.waitForTimeout(8000);
    
    // Click Convert
    console.log('🚀 Clicking Convert...');
    const convertButtons = await page.locator('button:has-text("Convert")');
    await convertButtons.nth(0).click();
    await page.waitForTimeout(5000);
    
    // Click Download in modal - but this time follow the navigation
    console.log('🚀 Clicking Download and following redirect...');
    
    // Set up navigation listener before clicking
    const navigationPromise = page.waitForEvent('response', response => {
      return response.url().includes('dmate') && response.status() === 200;
    });
    
    // Click the download button
    await page.click('button:has-text("Download")');
    
    console.log('⏳ Following redirect chain...');
    
    // Wait for navigation and capture the final URL
    try {
      const finalResponse = await navigationPromise;
      console.log(`🎯 FINAL RESPONSE URL: ${finalResponse.url()}`);
      console.log(`   Status: ${finalResponse.status()}`);
      console.log(`   Content-Type: ${finalResponse.headers()['content-type']}`);
      
      // If this is still a redirect page, let's extract any video URLs from it
      const currentUrl = page.url();
      console.log(`📍 Current page URL: ${currentUrl}`);
      
      // Look for any direct video links on the final page
      await page.waitForTimeout(3000);
      
      const videoLinks = await page.evaluate(() => {
        const links = [];
        
        // Look for video elements
        document.querySelectorAll('video').forEach(video => {
          if (video.src) links.push({ type: 'video_src', url: video.src });
          video.querySelectorAll('source').forEach(source => {
            if (source.src) links.push({ type: 'video_source', url: source.src });
          });
        });
        
        // Look for direct video links
        document.querySelectorAll('a[href*=".mp4"], a[href*="googlevideo"], a[href*="youtube"]').forEach(link => {
          if (link.href && link.href.startsWith('http')) {
            links.push({ type: 'link', url: link.href, text: link.textContent.trim() });
          }
        });
        
        // Check if there's a direct download happening
        const metaRefresh = document.querySelector('meta[http-equiv="refresh"]');
        if (metaRefresh) {
          const content = metaRefresh.getAttribute('content');
          const urlMatch = content.match(/url=(.+)/);
          if (urlMatch) {
            links.push({ type: 'meta_refresh', url: urlMatch[1] });
          }
        }
        
        return links;
      });
      
      console.log('\n🎯 EXTRACTED VIDEO LINKS:');
      if (videoLinks.length > 0) {
        videoLinks.forEach((link, i) => {
          console.log(`${i + 1}. [${link.type}] ${link.url}`);
          if (link.text) console.log(`   Text: ${link.text}`);
        });
      } else {
        console.log('❌ No direct video links found on final page');
      }
      
    } catch (e) {
      console.log('⚠️  Navigation timeout, checking current state...');
    }
    
    console.log('\n📋 COMPLETE REDIRECT CHAIN:');
    redirectChain.forEach((item, i) => {
      console.log(`${i + 1}. ${item.url}`);
      console.log(`   Status: ${item.status}`);
      if (item.location) console.log(`   → ${item.location}`);
      if (item.contentType) console.log(`   Type: ${item.contentType}`);
      console.log('');
    });
    
    // Keep browser open
    console.log('🔍 Browser staying open for 15 seconds...');
    await page.waitForTimeout(15000);
    
  } catch (error) {
    console.error('❌ Download redirect follow failed:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  followDownloadRedirect().catch(console.error);
}