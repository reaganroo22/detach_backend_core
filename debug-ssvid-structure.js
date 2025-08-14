// Debug SSVid.net page structure to find the correct input fields
const { chromium } = require('playwright');

async function debugSSVidStructure() {
  console.log('🧪 Debugging SSVid.net page structure...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome'
  });
  
  try {
    const page = await browser.newPage();
    
    // Go to YouTube downloader page
    console.log('📱 Navigating to SSVid YouTube downloader...');
    await page.goto('https://ssvid.net/youtube-downloader', { waitUntil: 'networkidle' });
    
    // Debug all input elements on the page
    const allInputs = await page.evaluate(() => {
      const inputs = [];
      
      // Get all input elements
      document.querySelectorAll('input').forEach(input => {
        inputs.push({
          type: input.type,
          name: input.name,
          id: input.id,
          className: input.className,
          placeholder: input.placeholder,
          visible: input.offsetParent !== null
        });
      });
      
      // Get all textarea elements
      document.querySelectorAll('textarea').forEach(textarea => {
        inputs.push({
          type: 'textarea',
          name: textarea.name,
          id: textarea.id,
          className: textarea.className,
          placeholder: textarea.placeholder,
          visible: textarea.offsetParent !== null
        });
      });
      
      return inputs;
    });
    
    console.log('🔍 Found input elements:');
    allInputs.forEach((input, i) => {
      console.log(`${i + 1}. Type: ${input.type}`);
      console.log(`   ID: ${input.id || 'none'}`);
      console.log(`   Name: ${input.name || 'none'}`);
      console.log(`   Class: ${input.className || 'none'}`);
      console.log(`   Placeholder: ${input.placeholder || 'none'}`);
      console.log(`   Visible: ${input.visible}`);
      console.log('');
    });
    
    // Also check for any form elements
    const forms = await page.evaluate(() => {
      const formData = [];
      document.querySelectorAll('form').forEach(form => {
        formData.push({
          action: form.action,
          method: form.method,
          id: form.id,
          className: form.className
        });
      });
      return formData;
    });
    
    console.log('🔍 Found forms:');
    forms.forEach((form, i) => {
      console.log(`${i + 1}. Action: ${form.action}`);
      console.log(`   Method: ${form.method}`);
      console.log(`   ID: ${form.id || 'none'}`);
      console.log(`   Class: ${form.className || 'none'}`);
      console.log('');
    });
    
    // Keep browser open for manual inspection
    console.log('🔍 Browser staying open for 20 seconds for manual inspection...');
    await page.waitForTimeout(20000);
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  debugSSVidStructure().catch(console.error);
}