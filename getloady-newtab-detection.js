// GetLoady - Detect NEW TAB with direct Google Video URL
const { chromium } = require('playwright');

async function getloadyNewTabDetection() {
  console.log('🧪 GetLoady - NEW TAB Detection...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome'
  });
  
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Listen for NEW TABS/PAGES
    const capturedUrls = [];
    
    context.on('page', async (newPage) => {
      console.log('🆕 NEW TAB DETECTED!');
      
      // Wait for the new page to load
      await newPage.waitForLoadState('networkidle').catch(() => {});
      
      const newUrl = newPage.url();
      console.log(`📍 New Tab URL: ${newUrl}`);
      
      if (newUrl.includes('googlevideo')) {
        console.log('🎯 GOOGLE VIDEO URL FOUND IN NEW TAB!');
        console.log(`📥 DIRECT URL: ${newUrl}`);
        capturedUrls.push({
          type: 'new_tab_google_video',
          url: newUrl,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    const youtubeUrl = 'https://www.youtube.com/shorts/0Pwt8wcSjmY';
    console.log(`🎯 Testing URL: ${youtubeUrl}`);
    
    // Navigate to GetLoady YouTube
    await page.goto('https://getloady.com/youtube', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Type slowly and undetectably
    console.log('📝 Typing URL slowly and undetectably...');
    const input = await page.locator('input[type="text"]').first();
    await input.click();
    await input.fill(''); // Clear first
    
    // Type character by character with human-like delays
    for (let char of youtubeUrl) {
      await input.type(char, { delay: Math.random() * 100 + 50 }); // 50-150ms delay
    }
    
    await page.waitForTimeout(1000);
    
    // Click "Get YouTube download link" button
    console.log('🚀 Clicking "Get YouTube download link"...');
    await page.click('button:has-text("Get")');
    
    console.log('⏳ Waiting for "fetching video information" and NEW TAB...');
    
    // Wait for processing and new tab
    await page.waitForTimeout(15000);
    
    // Check all pages in context
    const allPages = context.pages();
    console.log(`\n📊 Total pages in context: ${allPages.length}`);
    
    for (let i = 0; i < allPages.length; i++) {
      const pageUrl = allPages[i].url();
      console.log(`   Page ${i + 1}: ${pageUrl}`);
      
      if (pageUrl.includes('googlevideo')) {
        console.log(`   🎯 FOUND GOOGLE VIDEO URL: ${pageUrl}`);
        capturedUrls.push({
          type: 'google_video_page',
          url: pageUrl,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    console.log('\n📋 CAPTURED DIRECT URLs:');
    if (capturedUrls.length > 0) {
      capturedUrls.forEach((item, i) => {
        console.log(`${i + 1}. [${item.type}] ${item.url}`);
        console.log(`   Time: ${item.timestamp}\n`);
      });
    } else {
      console.log('❌ No direct URLs captured yet, waiting longer...');
      
      // Wait additional time and check again
      await page.waitForTimeout(10000);
      
      const finalPages = context.pages();
      console.log(`\n📊 Final check - Total pages: ${finalPages.length}`);
      
      for (let i = 0; i < finalPages.length; i++) {
        const pageUrl = finalPages[i].url();
        console.log(`   Final Page ${i + 1}: ${pageUrl}`);
        
        if (pageUrl.includes('googlevideo')) {
          console.log(`   ✅ FINAL GOOGLE VIDEO URL: ${pageUrl}`);
        }
      }
    }
    
    // Keep browser open for inspection
    console.log('\n🔍 Browser staying open for 15 seconds...');
    await page.waitForTimeout(15000);
    
  } catch (error) {
    console.error('❌ GetLoady new tab detection failed:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  getloadyNewTabDetection().catch(console.error);
}