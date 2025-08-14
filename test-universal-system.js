// Test the complete universal download system with fallbacks
const UniversalDownloader = require('./universal-downloader');

async function testUniversalSystem() {
  console.log('🧪 Testing Universal Download System with Fallbacks...\n');
  
  const downloader = new UniversalDownloader();
  
  // Test with real URLs
  const testUrls = [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // YouTube - Rick Roll
    'https://www.tiktok.com/@therock/video/7016198567564135686', // TikTok - The Rock
  ];
  
  for (const url of testUrls) {
    console.log(`\n🎯 Testing Universal Download: ${url}`);
    console.log('='.repeat(50));
    
    try {
      const result = await downloader.download(url);
      console.log('✅ Universal Download Result:');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.success) {
        console.log(`✅ SUCCESS: Downloaded via ${result.method} (${result.tier || 'unknown tier'})`);
      } else {
        console.log('❌ FAILED: All tiers failed');
      }
      
    } catch (error) {
      console.error('❌ Universal download error:', error.message);
    }
  }
}

if (require.main === module) {
  testUniversalSystem().catch(console.error);
}