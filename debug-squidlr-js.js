// Debug Squidlr's JavaScript validation logic
const { chromium } = require('playwright');

async function debugSquidlrValidation() {
  console.log('🧪 Debugging Squidlr validation logic...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome'
  });
  
  try {
    const page = await browser.newPage();
    
    // Listen for console logs from the page
    page.on('console', msg => {
      console.log(`📄 Page Console: ${msg.text()}`);
    });
    
    await page.goto('https://www.squidlr.com/', { waitUntil: 'networkidle' });
    
    // Get the page's JavaScript to understand validation
    const validationScript = await page.evaluate(() => {
      // Check if there are any event listeners on the URL input
      const urlInput = document.querySelector('#url');
      const downloadButton = document.querySelector('#download-button');
      
      return {
        urlInputValue: urlInput ? urlInput.value : null,
        buttonDisabled: downloadButton ? downloadButton.disabled : null,
        buttonClass: downloadButton ? downloadButton.className : null,
        hasValidationEvents: !!urlInput && Object.getOwnPropertyNames(urlInput).includes('onchange')
      };
    });
    
    console.log('Initial state:', validationScript);
    
    // Try different validation approaches
    const testUrl = 'https://www.tiktok.com/@tiktokyoungboss/video/7492418301063187734';
    
    // Method 1: Direct input
    console.log('\n🔧 Method 1: Direct fill and trigger events');
    await page.fill('#url', testUrl);
    
    // Trigger various events that might enable the button
    await page.evaluate(() => {
      const input = document.querySelector('#url');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    });
    
    await page.waitForTimeout(2000);
    
    const afterEvents = await page.evaluate(() => {
      const downloadButton = document.querySelector('#download-button');
      return downloadButton ? downloadButton.disabled : null;
    });
    
    console.log('Button disabled after events:', afterEvents);
    
    // Method 2: Type character by character
    console.log('\n🔧 Method 2: Type character by character');
    await page.fill('#url', ''); // Clear first
    await page.type('#url', testUrl, { delay: 100 });
    
    await page.waitForTimeout(2000);
    
    const afterTyping = await page.evaluate(() => {
      const downloadButton = document.querySelector('#download-button');
      return downloadButton ? downloadButton.disabled : null;
    });
    
    console.log('Button disabled after typing:', afterTyping);
    
    // Method 3: Check for specific patterns
    console.log('\n🔧 Method 3: Testing simpler URLs');
    const simpleUrls = [
      'https://tiktok.com/test',
      'https://www.instagram.com/p/test/',
      'https://x.com/user/status/123'
    ];
    
    for (const url of simpleUrls) {
      await page.fill('#url', url);
      await page.evaluate(() => {
        const input = document.querySelector('#url');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.waitForTimeout(1000);
      
      const isEnabled = await page.evaluate(() => {
        const downloadButton = document.querySelector('#download-button');
        return downloadButton ? !downloadButton.disabled : false;
      });
      
      console.log(`URL: ${url} -> Button enabled: ${isEnabled}`);
      
      if (isEnabled) {
        console.log('✅ Found working URL pattern!');
        break;
      }
    }
    
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error('Validation debug failed:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  debugSquidlrValidation().catch(console.error);
}