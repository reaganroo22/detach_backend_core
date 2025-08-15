/**
 * Test browser-based download to avoid IP restrictions
 */

const ComprehensiveDownloaderSuite = require('./comprehensive-downloader-suite');
const fs = require('fs').promises;

async function testBrowserDownload() {
  console.log('🚀 Testing browser-based download to avoid IP restrictions...');
  
  const downloader = new ComprehensiveDownloaderSuite({
    headless: false, // Show browser for debugging
    qualityPreference: 'highest',
    enableLogging: true,
    retryAttempts: 1,
    downloadTimeout: 90000,
    downloadPath: './downloads'
  });
  
  try {
    await downloader.initialize();
    console.log('✅ Browser initialized');
    
    // Test with YouTube URL
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    console.log(`🎯 Testing URL: ${url}`);
    
    const result = await downloader.downloadWithRetry(url, null, (progress) => {
      console.log(`📈 Progress: ${progress.step} - ${progress.tierName || ''}`);
    });
    
    console.log('📊 Result:', JSON.stringify(result, null, 2));
    
    if (result.success && result.localFile) {
      // Check if the downloaded file exists and has reasonable size
      try {
        const stats = await fs.stat(result.localFile);
        console.log(`🎉 SUCCESS! Browser downloaded file: ${result.localFile}`);
        console.log(`📄 File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        
        if (stats.size > 1024 * 1024) { // More than 1MB
          console.log('✅ File size looks good - likely a real video file!');
        } else {
          console.log('⚠️ File size is small - might be an error file');
        }
      } catch (statError) {
        console.error(`❌ Could not check file stats: ${statError.message}`);
      }
    } else if (result.success) {
      console.log('📝 Got download URL but no local file - will need IP-based download');
    } else {
      console.log(`❌ Download failed: ${result.error}`);
    }
    
    await downloader.close();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    try {
      await downloader.close();
    } catch (closeError) {
      // ignore
    }
  }
}

testBrowserDownload();