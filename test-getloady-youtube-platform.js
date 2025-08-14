// Test GetLoady YouTube platform directly at getloady.com/youtube
const { chromium } = require('playwright');

async function testGetloadyYoutubePlatform() {
  console.log('🧪 Testing GetLoady YouTube platform directly...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome'
  });
  
  try {
    const page = await browser.newPage();
    
    // Capture ALL URLs with detailed info
    const capturedUrls = [];
    
    page.on('response', async response => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';
      const status = response.status();
      
      // Capture video-related responses
      if (
        url.includes('googlevideo') ||
        url.includes('ytimg') ||
        url.includes('youtube') ||
        url.includes('blob:') ||
        contentType.includes('video/') ||
        contentType.includes('audio/') ||
        status >= 300 && status < 400
      ) {
        const urlInfo = {
          url: url,
          status: status,
          contentType: contentType,
          timestamp: new Date().toISOString()
        };
        
        console.log(`📡 ${status} ${url}`);
        console.log(`   Content-Type: ${contentType}`);
        console.log(`   Time: ${urlInfo.timestamp}\n`);
        
        capturedUrls.push(urlInfo);
      }
    });
    
    page.on('download', async download => {
      const downloadInfo = {
        type: 'download_event',
        url: download.url(),
        filename: download.suggestedFilename(),
        timestamp: new Date().toISOString()
      };
      
      console.log(`📥 DOWNLOAD: ${download.url()}`);
      console.log(`📥 FILE: ${download.suggestedFilename()}\n`);
      
      capturedUrls.push(downloadInfo);
    });
    
    const youtubeUrl = 'https://www.youtube.com/shorts/0Pwt8wcSjmY';
    console.log(`🎯 Testing URL: ${youtubeUrl}`);
    console.log(`🌐 Going to: https://getloady.com/youtube\n`);
    
    // Navigate to GetLoady YouTube platform
    await page.goto('https://getloady.com/youtube', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    // Find URL input field (try common selectors)
    const inputSelectors = [
      'input[type="url"]',
      'input[placeholder*="url"]',
      'input[placeholder*="URL"]',
      'input[name*="url"]',
      '#url',
      '.url-input',
      'input[type="text"]'
    ];
    
    let inputFound = false;
    for (const selector of inputSelectors) {
      try {
        const input = await page.locator(selector).first();
        if (await input.isVisible()) {
          console.log(`✅ Found input: ${selector}`);
          await input.fill(youtubeUrl);
          inputFound = true;
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (!inputFound) {
      console.log('❌ Could not find URL input field');
      // Debug available inputs
      const inputs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input')).map(input => ({
          type: input.type,
          placeholder: input.placeholder,
          name: input.name,
          id: input.id,
          className: input.className
        }));
      });
      console.log('Available inputs:', inputs);
      return;
    }
    
    // Find and click submit/download button
    const buttonSelectors = [
      'button[type="submit"]',
      'button:has-text("Download")',
      'button:has-text("Get")',
      'button:has-text("Submit")',
      '.download-btn',
      '#download-btn',
      'input[type="submit"]'
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
      console.log('❌ Could not find submit button');
      // Press Enter as fallback
      await page.keyboard.press('Enter');
    }
    
    console.log('⏳ Waiting for processing and downloads...');
    await page.waitForTimeout(15000);
    
    // Analysis
    console.log('\n📋 CAPTURED URLS ANALYSIS:');
    console.log('='.repeat(60));
    
    const googleUrls = capturedUrls.filter(u => u.url?.includes('googlevideo'));
    const blobUrls = capturedUrls.filter(u => u.url?.includes('blob:'));
    const downloadEvents = capturedUrls.filter(u => u.type === 'download_event');
    const videoResponses = capturedUrls.filter(u => u.contentType?.includes('video/'));
    
    console.log(`🎯 Google Video URLs: ${googleUrls.length}`);
    googleUrls.forEach((item, i) => {
      console.log(`   ${i + 1}. ${item.url.slice(0, 100)}...`);
    });
    
    console.log(`\n🔄 Blob URLs: ${blobUrls.length}`);
    blobUrls.forEach((item, i) => {
      console.log(`   ${i + 1}. ${item.url}`);
    });
    
    console.log(`\n📥 Download Events: ${downloadEvents.length}`);
    downloadEvents.forEach((item, i) => {
      console.log(`   ${i + 1}. ${item.url} (${item.filename})`);
    });
    
    console.log(`\n📹 Video Responses: ${videoResponses.length}`);
    videoResponses.forEach((item, i) => {
      console.log(`   ${i + 1}. ${item.url.slice(0, 100)}... (${item.contentType})`);
    });
    
    console.log('\n🔍 Browser staying open for 15 seconds...');
    await page.waitForTimeout(15000);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  testGetloadyYoutubePlatform().catch(console.error);
}