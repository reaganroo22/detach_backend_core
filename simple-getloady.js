const { chromium } = require('playwright');

async function testGetloadyCard() {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    await page.goto('https://getloady.com/', { waitUntil: 'networkidle' });
    
    // Look for TikTok card and click it
    const tikTokCard = await page.$('div:has-text("TikTok Videos")');
    if (tikTokCard) {
      console.log('Found TikTok card, clicking...');
      await tikTokCard.click();
      
      // Wait for navigation or modal
      await page.waitForTimeout(3000);
      
      // Check if we're on a new page or if modal opened
      const currentUrl = page.url();
      console.log('Current URL after click:', currentUrl);
      
      // Look for input fields
      const inputs = await page.$$('input[type="text"], input[type="url"], input[placeholder*="URL"]');
      console.log('Found', inputs.length, 'input fields');
      
      if (inputs.length > 0) {
        console.log('Testing with TikTok URL...');
        await inputs[0].fill('https://www.tiktok.com/@tiktokyoungboss/video/7492418301063187734');
        
        // Look for download button
        const downloadBtn = await page.$('button:has-text("Download"), input[type="submit"], button[type="submit"]');
        if (downloadBtn) {
          console.log('Found download button, clicking...');
          await downloadBtn.click();
          
          // Wait for result
          await page.waitForTimeout(10000);
          
          // Look for download links
          const downloadLinks = await page.$$('a[href*="download"], a[href*=".mp4"], a[download]');
          console.log('Found', downloadLinks.length, 'download links');
          
          if (downloadLinks.length > 0) {
            const href = await downloadLinks[0].getAttribute('href');
            console.log('Download URL:', href);
          }
        }
      }
    }
    
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

testGetloadyCard();