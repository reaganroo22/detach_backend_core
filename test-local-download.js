/**
 * Test local browser automation with real URL
 */

const ComprehensiveDownloaderSuite = require('./comprehensive-downloader-suite');

async function testLocalDownload() {
  console.log('🚀 Testing local browser automation...');
  
  const downloader = new ComprehensiveDownloaderSuite({
    headless: false, // Show browser so we can see what happens
    qualityPreference: 'highest',
    enableLogging: true,
    retryAttempts: 1,
    downloadTimeout: 60000
  });
  
  try {
    await downloader.initialize();
    console.log('✅ Browser initialized');
    
    // Test with Rick Roll URL
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    console.log(`🎯 Testing URL: ${url}`);
    
    const result = await downloader.downloadWithRetry(url, null, (progress) => {
      console.log(`📈 Progress: ${progress.step} - ${progress.tierName || ''}`);
    });
    
    console.log('📊 Result:', JSON.stringify(result, null, 2));
    
    await downloader.close();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    try {
      await downloader.close();
    } catch (closeError) {
      console.error('❌ Close error:', closeError.message);
    }
  }
}

testLocalDownload();