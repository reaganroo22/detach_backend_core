const { chromium } = require('playwright');

async function debugGetloady() {
  const browser = await chromium.launch({ 
    headless: false,  // Show browser for debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to getloady.com...');
    await page.goto('https://getloady.com/', { waitUntil: 'networkidle' });
    
    // Take a screenshot
    await page.screenshot({ path: 'getloady-homepage.png', fullPage: true });
    
    // Get page title
    const title = await page.title();
    console.log('Page title:', title);
    
    // Look for TikTok elements
    const tikTokElements = await page.$$eval('*', elements => {
      return elements
        .filter(el => el.textContent && el.textContent.toLowerCase().includes('tiktok'))
        .map(el => ({
          tagName: el.tagName,
          className: el.className,
          textContent: el.textContent.trim(),
          href: el.href
        }))
        .slice(0, 10);
    });
    
    console.log('Elements containing "TikTok":', tikTokElements);
    
    // Look for input fields
    const inputs = await page.$$eval('input', elements => {
      return elements.map(el => ({
        type: el.type,
        placeholder: el.placeholder,
        name: el.name,
        id: el.id,
        className: el.className
      }));
    });
    
    console.log('Input fields found:', inputs);
    
    // Look for buttons
    const buttons = await page.$$eval('button', elements => {
      return elements.map(el => ({
        textContent: el.textContent.trim(),
        className: el.className,
        type: el.type
      })).slice(0, 10);
    });
    
    console.log('Buttons found:', buttons);
    
    // Wait a bit for user to see
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error('Debug error:', error);
  } finally {
    await browser.close();
  }
}

debugGetloady();