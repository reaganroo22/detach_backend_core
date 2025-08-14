const { chromium } = require('playwright');

async function debugAfterDownload() {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    await page.goto('https://getloady.com/tiktok', { waitUntil: 'networkidle' });
    
    await page.waitForSelector('input[type="text"], input[type="url"], input[placeholder*="URL"]', { timeout: 10000 });
    await page.fill('input[type="text"], input[type="url"], input[placeholder*="URL"]', 'https://www.tiktok.com/@tiktokyoungboss/video/7492418301063187734');
    
    console.log('Clicking download button...');
    await page.click('button:has-text("Download"), input[type="submit"], button[type="submit"]');
    
    // Wait a moment for processing
    await page.waitForTimeout(5000);
    
    console.log('Looking for all links after download...');
    const allLinks = await page.$$eval('a', links => 
      links.map(link => ({
        href: link.href,
        text: link.textContent?.trim(),
        download: link.download,
        visible: link.offsetParent !== null
      })).filter(link => link.href && (
        link.href.includes('download') || 
        link.href.includes('.mp4') || 
        link.href.includes('blob:') ||
        link.download
      ))
    );
    
    console.log('Download links found:', allLinks);
    
    // Look for any error messages
    const errorMessages = await page.$$eval('*', elements => 
      elements
        .filter(el => el.textContent && (
          el.textContent.includes('error') ||
          el.textContent.includes('Error') ||
          el.textContent.includes('failed') ||
          el.textContent.includes('Failed')
        ))
        .map(el => el.textContent.trim())
        .slice(0, 5)
    );
    
    console.log('Error messages:', errorMessages);
    
    // Wait to see what happens
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('Debug error:', error);
  } finally {
    await browser.close();
  }
}

debugAfterDownload();