// Extract the actual Google Video URL from GetLoady after processing
const { chromium } = require('playwright');

async function extractGetloadyGoogleUrl() {
  console.log('🧪 Extracting Google Video URL from GetLoady...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome'
  });
  
  try {
    const page = await browser.newPage();
    
    const youtubeUrl = 'https://www.youtube.com/shorts/0Pwt8wcSjmY';
    console.log(`🎯 Testing URL: ${youtubeUrl}`);
    
    // Navigate to GetLoady YouTube platform
    await page.goto('https://getloady.com/youtube', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Input URL and submit
    await page.fill('input[type="text"]', youtubeUrl);
    await page.click('button:has-text("Get")');
    
    console.log('⏳ Waiting for video processing...');
    await page.waitForTimeout(10000);
    
    // Now look for the video element and extract the Google Video URL
    const videoInfo = await page.evaluate(() => {
      // Check for video elements
      const videos = document.querySelectorAll('video');
      const videoSources = [];
      
      videos.forEach(video => {
        if (video.src) videoSources.push(video.src);
        if (video.currentSrc) videoSources.push(video.currentSrc);
        
        // Check video sources
        video.querySelectorAll('source').forEach(source => {
          if (source.src) videoSources.push(source.src);
        });
      });
      
      // Also check the current URL in case it redirected
      const currentUrl = window.location.href;
      
      // Look for any links containing googlevideo
      const googleLinks = [];
      document.querySelectorAll('a[href*="googlevideo"]').forEach(link => {
        googleLinks.push(link.href);
      });
      
      return {
        currentUrl: currentUrl,
        videoSources: videoSources,
        googleLinks: googleLinks,
        hasVideo: videos.length > 0,
        pageTitle: document.title
      };
    });
    
    console.log('📹 Video Analysis:');
    console.log(`   Current URL: ${videoInfo.currentUrl}`);
    console.log(`   Has Video Elements: ${videoInfo.hasVideo}`);
    console.log(`   Page Title: ${videoInfo.pageTitle}`);
    
    if (videoInfo.videoSources.length > 0) {
      console.log('\n🎯 VIDEO SOURCES FOUND:');
      videoInfo.videoSources.forEach((src, i) => {
        console.log(`${i + 1}. ${src}`);
        if (src.includes('googlevideo')) {
          console.log(`   ✅ GOOGLE VIDEO URL: ${src}`);
        }
      });
    }
    
    if (videoInfo.googleLinks.length > 0) {
      console.log('\n🔗 GOOGLE VIDEO LINKS:');
      videoInfo.googleLinks.forEach((link, i) => {
        console.log(`${i + 1}. ${link}`);
      });
    }
    
    // Check if the current URL is a Google Video URL
    if (videoInfo.currentUrl.includes('googlevideo')) {
      console.log('\n✅ CURRENT PAGE IS GOOGLE VIDEO URL:');
      console.log(videoInfo.currentUrl);
    }
    
    // Wait longer and check again in case it takes time to load
    console.log('\n⏳ Waiting additional 10 seconds for video to fully load...');
    await page.waitForTimeout(10000);
    
    // Check again
    const finalCheck = await page.evaluate(() => {
      const videos = document.querySelectorAll('video');
      const finalSources = [];
      
      videos.forEach(video => {
        if (video.src) finalSources.push(video.src);
        if (video.currentSrc) finalSources.push(video.currentSrc);
      });
      
      return {
        finalSources: finalSources,
        currentUrl: window.location.href
      };
    });
    
    console.log('\n🔍 FINAL CHECK:');
    console.log(`   Final URL: ${finalCheck.currentUrl}`);
    if (finalCheck.finalSources.length > 0) {
      console.log('   Final Video Sources:');
      finalCheck.finalSources.forEach((src, i) => {
        console.log(`   ${i + 1}. ${src}`);
      });
    }
    
    // Keep browser open for manual inspection
    console.log('\n🔍 Browser staying open for 20 seconds for manual inspection...');
    await page.waitForTimeout(20000);
    
  } catch (error) {
    console.error('❌ Extraction failed:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  extractGetloadyGoogleUrl().catch(console.error);
}