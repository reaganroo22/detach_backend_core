/**
 * Test all three services with actual browser downloads
 */

const ComprehensiveDownloaderSuite = require('./comprehensive-downloader-suite');
const fs = require('fs').promises;

async function testAllServices() {
  console.log('🚀 Testing all services with browser downloads...');
  
  const downloader = new ComprehensiveDownloaderSuite({
    headless: false, // Show browser to see what's happening
    qualityPreference: 'highest',
    enableLogging: true,
    retryAttempts: 1, // Only try each tier once for testing
    downloadTimeout: 120000, // 2 minutes for each attempt
    downloadPath: './downloads'
  });
  
  try {
    await downloader.initialize();
    console.log('✅ Browser initialized');
    
    // Test URLs for different platforms
    const testUrls = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // YouTube - Rick Roll
      'https://www.tiktok.com/@kingjafi/video/7303512180263554346', // TikTok
      'https://twitter.com/elonmusk/status/1849904132370317608' // Twitter/X
    ];
    
    for (const url of testUrls) {
      console.log(`\n🎯 Testing URL: ${url}`);
      console.log('=' * 60);
      
      const result = await downloader.downloadWithRetry(url, null, (progress) => {
        console.log(`📈 Progress: ${progress.step} - ${progress.tierName || ''} (Tier ${progress.tier || 'N/A'})`);
      });
      
      console.log('\n📊 Result Summary:');
      console.log(`Success: ${result.success ? '✅' : '❌'}`);
      
      if (result.success) {
        console.log(`Platform: ${result.platform}`);
        console.log(`Method: ${result.method}`);
        console.log(`Service: ${result.service}`);
        console.log(`Tier: ${result.tier} (${result.tierName})`);
        
        if (result.localFile) {
          try {
            const stats = await fs.stat(result.localFile);
            console.log(`💾 Local File: ${result.localFile}`);
            console.log(`📄 File Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            
            if (stats.size > 1024 * 1024) { // More than 1MB
              console.log('🎉 SUCCESS! File size looks good - likely a real video!');
            } else {
              console.log('⚠️ File size is small - might be an error file');
            }
          } catch (statError) {
            console.error(`❌ Could not check file stats: ${statError.message}`);
          }
        } else {
          console.log(`🔗 Download URL: ${result.downloadUrl?.substring(0, 100)}...`);
          console.log('⚠️ No local file - will need IP-based download');
        }
      } else {
        console.log(`❌ Error: ${result.error}`);
      }
      
      console.log('\n' + '=' * 60);
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    console.log('\n📈 Final Statistics:');
    console.log(JSON.stringify(downloader.getStats(), null, 2));
    
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

testAllServices();