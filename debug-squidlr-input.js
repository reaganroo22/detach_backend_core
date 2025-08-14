// Debug why the Squidlr input field isn't accepting any values
const { chromium } = require('playwright');

async function debugSquidlrInput() {
  console.log('🧪 Debugging Squidlr input field...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome'
  });
  
  try {
    const page = await browser.newPage();
    
    await page.goto('https://www.squidlr.com/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    // Debug the input field properties
    const inputInfo = await page.evaluate(() => {
      const input = document.querySelector('#url');
      if (!input) return { exists: false };
      
      return {
        exists: true,
        tagName: input.tagName,
        type: input.type,
        disabled: input.disabled,
        readOnly: input.readOnly,
        value: input.value,
        placeholder: input.placeholder,
        className: input.className,
        id: input.id,
        hasEventListeners: input.onclick !== null || input.oninput !== null,
        style: input.style.cssText,
        computedDisplay: window.getComputedStyle(input).display,
        isVisible: input.offsetParent !== null
      };
    });
    
    console.log('Input field analysis:');
    console.log(JSON.stringify(inputInfo, null, 2));
    
    if (inputInfo.exists) {
      console.log('\n🔧 Trying to interact with input...');
      
      // Try clicking first
      await page.click('#url');
      console.log('✅ Clicked input');
      
      // Try typing a simple character
      await page.type('#url', 'a');
      await page.waitForTimeout(1000);
      
      const valueAfterType = await page.inputValue('#url');
      console.log(`Value after typing 'a': "${valueAfterType}"`);
      
      // Clear and try fill
      await page.fill('#url', '');
      await page.fill('#url', 'test');
      await page.waitForTimeout(1000);
      
      const valueAfterFill = await page.inputValue('#url');
      console.log(`Value after fill 'test': "${valueAfterFill}"`);
      
      // Check if Blazor is interfering
      const blazorInfo = await page.evaluate(() => {
        return {
          hasBlazor: !!window.Blazor,
          blazorState: window.Blazor ? 'loaded' : 'not found',
          documentReady: document.readyState
        };
      });
      
      console.log('\nBlazor analysis:');
      console.log(JSON.stringify(blazorInfo, null, 2));
    }
    
    console.log('\n🔍 Browser staying open for 20 seconds for manual inspection...');
    await page.waitForTimeout(20000);
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  debugSquidlrInput().catch(console.error);
}