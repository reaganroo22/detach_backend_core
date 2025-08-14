const { chromium } = require('playwright');

async function debugYouTubePage() {
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to YouTube downloader page...');
    await page.goto('https://getloady.com/youtube', { waitUntil: 'networkidle' });
    
    // Take screenshot
    await page.screenshot({ path: 'youtube-page.png' });
    
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
    
    // Fill in YouTube URL
    console.log('Filling in YouTube URL...');
    const urlInput = await page.$('input[type="text"], input[type="url"], input[placeholder*="URL"]');
    if (urlInput) {
      await urlInput.fill('https://www.youtube.com/shorts/0Pwt8wcSjmY');
      console.log('URL filled');
      
      // Wait and look for buttons again
      await page.waitForTimeout(2000);
      
      console.log('Looking for download buttons after filling URL...');
      const downloadButtons = await page.$$eval('*', elements => 
        elements
          .filter(el => 
            (el.tagName === 'BUTTON' || el.tagName === 'INPUT') && 
            el.textContent && 
            (el.textContent.toLowerCase().includes('download') ||
             el.textContent.toLowerCase().includes('get') ||
             el.textContent.toLowerCase().includes('submit'))
          )
          .map(el => ({
            tagName: el.tagName,
            textContent: el.textContent.trim(),
            type: el.type,
            className: el.className,
            visible: el.offsetParent !== null
          }))
      );
      console.log('Download buttons found:', downloadButtons);
      
    } else {
      console.log('No input field found');
    }
    
    // Wait for manual inspection
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('Debug error:', error);
  } finally {
    await browser.close();
  }
}

debugYouTubePage();