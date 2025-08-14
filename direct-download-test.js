// Navigate directly to the download URL to see what it resolves to
const { chromium } = require('playwright');

async function testDirectDownload() {
  console.log('🧪 Testing direct navigation to download URL...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome'
  });
  
  try {
    const page = await browser.newPage();
    
    // Capture all redirects and final URLs
    const capturedUrls = [];
    
    page.on('response', async response => {
      const url = response.url();
      const status = response.status();
      const contentType = response.headers()['content-type'] || '';
      
      console.log(`📡 Response: ${url}`);
      console.log(`   Status: ${status}`);
      console.log(`   Content-Type: ${contentType}`);
      
      // Look for actual video URLs
      if (
        url.includes('.mp4') || 
        url.includes('.mp3') || 
        url.includes('googlevideo') ||
        url.includes('ytimg') ||
        contentType.includes('video/') ||
        contentType.includes('audio/') ||
        status >= 300 && status < 400 // Redirects
      ) {
        console.log(`🎯 IMPORTANT: ${url}`);
        capturedUrls.push({url, status, contentType});
      }
      console.log('');
    });
    
    // Use the download URL we captured earlier
    const downloadUrl = 'https://dl180.dmate19.online/?file=M3R4SUNiN3JsOHJ6WWRUbHEvcUZ2cGlzVGhINmhmb25rNWdiMUFRdkJMSUJpSWc1MHZidEJNWkJJS1pDNm9PMEZKTnQraXVWUk1ER0h3bVB2NXN2UTMvTXdkODV2RENCL3A1MEg4OTRXaFBIaStlM25td3oyeUhzY2MzWkFMcFRLQ1ZkcmxBM2xuUzFuYlNHbnhISnBDbTYvbnFFVkNjN2pXcGJaYVhBdjVKWWdTL01hdmk1NXFORHFENlA2NGhNenZtUXNWeW5sT2RyNlkwaER4d2xOWU5MaEo3M2lnPT0%3D';
    
    console.log(`🚀 Navigating directly to: ${downloadUrl}`);
    
    // Navigate and see what happens
    await page.goto(downloadUrl, { waitUntil: 'networkidle' });
    
    console.log(`📍 Final page URL: ${page.url()}`);
    
    // Check what's on the page
    const pageContent = await page.evaluate(() => {
      return {
        title: document.title,
        hasVideo: !!document.querySelector('video'),
        hasAudio: !!document.querySelector('audio'),
        videoSources: Array.from(document.querySelectorAll('video source')).map(s => s.src),
        videoSrc: document.querySelector('video')?.src,
        downloadLinks: Array.from(document.querySelectorAll('a[href*=".mp4"], a[href*=".mp3"], a[download]')).map(a => ({
          href: a.href,
          text: a.textContent.trim()
        })),
        bodyText: document.body?.textContent?.slice(0, 500)
      };
    });
    
    console.log('\n📄 Page Analysis:');
    console.log(`Title: ${pageContent.title}`);
    console.log(`Has Video: ${pageContent.hasVideo}`);
    console.log(`Has Audio: ${pageContent.hasAudio}`);
    
    if (pageContent.videoSrc) {
      console.log(`🎯 VIDEO SRC: ${pageContent.videoSrc}`);
    }
    
    if (pageContent.videoSources.length > 0) {
      console.log('🎯 VIDEO SOURCES:');
      pageContent.videoSources.forEach((src, i) => {
        console.log(`  ${i + 1}. ${src}`);
      });
    }
    
    if (pageContent.downloadLinks.length > 0) {
      console.log('🎯 DOWNLOAD LINKS:');
      pageContent.downloadLinks.forEach((link, i) => {
        console.log(`  ${i + 1}. ${link.href} (${link.text})`);
      });
    }
    
    console.log(`\nPage content preview: ${pageContent.bodyText}`);
    
    console.log('\n📋 ALL CAPTURED URLS:');
    capturedUrls.forEach((item, i) => {
      console.log(`${i + 1}. ${item.url}`);
      console.log(`   Status: ${item.status}, Type: ${item.contentType}`);
    });
    
    // Keep browser open for inspection
    console.log('\n🔍 Browser staying open for 15 seconds...');
    await page.waitForTimeout(15000);
    
  } catch (error) {
    console.error('❌ Direct download test failed:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  testDirectDownload().catch(console.error);
}