const { chromium } = require('playwright');

async function debugSquidlr() {
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to squidlr.com...');
    await page.goto('https://www.squidlr.com/', { waitUntil: 'networkidle' });
    
    // Take screenshot
    await page.screenshot({ path: 'squidlr-homepage.png' });
    
    console.log('Looking for input fields...');
    const inputs = await page.$$eval('input', elements => 
      elements.map(el => ({
        type: el.type,
        placeholder: el.placeholder,
        name: el.name,
        id: el.id,
        className: el.className,
        visible: el.offsetParent !== null
      }))
    );
    console.log('Input fields:', inputs);
    
    console.log('Looking for buttons...');
    const buttons = await page.$$eval('button, input[type="submit"]', elements => 
      elements.map(el => ({
        tagName: el.tagName,
        textContent: el.textContent?.trim(),
        type: el.type,
        className: el.className,
        visible: el.offsetParent !== null
      }))
    );
    console.log('Buttons:', buttons);
    
    // Wait for manual inspection
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('Debug error:', error);
  } finally {
    await browser.close();
  }
}

debugSquidlr();