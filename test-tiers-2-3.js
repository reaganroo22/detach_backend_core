// Test Tier 2 (SSVid.net) and Tier 3 (Squidlr.com) directly, skipping GetLoady
const UniversalDownloader = require('./universal-downloader');

async function testTiers2And3() {
  console.log('🧪 Testing Tier 2 (SSVid.net) and Tier 3 (Squidlr.com) directly...\n');
  
  const downloader = new UniversalDownloader();
  
  // Real URLs to test
  const testUrls = [
    {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      platform: 'youtube',
      description: 'YouTube - Rick Roll'
    },
    {
      url: 'https://www.tiktok.com/@therock/video/7016198567564135686',
      platform: 'tiktok', 
      description: 'TikTok - The Rock'
    },
    {
      url: 'https://www.instagram.com/p/B_Ua6ZbAoAA/',
      platform: 'instagram',
      description: 'Instagram - Popular post'
    }
  ];
  
  for (const test of testUrls) {
    console.log(`\n🎯 Testing: ${test.description}`);
    console.log(`URL: ${test.url}`);
    console.log('='.repeat(60));
    
    // Test SSVid.net (Tier 2) directly
    console.log('\n🔥 TIER 2: SSVid.net');
    try {
      const tier2Result = await downloader.downloadWithSSVid(test.url, test.platform);
      console.log('✅ SSVid.net Result:');
      console.log(`   Success: ${tier2Result.success}`);
      console.log(`   Download URL: ${tier2Result.downloadUrl}`);
      console.log(`   Method: ${tier2Result.method}`);
      console.log(`   Platform: ${tier2Result.platform}`);
    } catch (error) {
      console.log('❌ SSVid.net Failed:', error.message);
    }
    
    // Test Squidlr.com (Tier 3) directly - skip YouTube since it doesn't support it
    if (test.platform !== 'youtube') {
      console.log('\n🔥 TIER 3: Squidlr.com');
      try {
        const tier3Result = await downloader.downloadWithSquidlr(test.url, test.platform);
        console.log('✅ Squidlr.com Result:');
        console.log(`   Success: ${tier3Result.success}`);
        console.log(`   Download URL: ${tier3Result.downloadUrl}`);
        console.log(`   Method: ${tier3Result.method}`);
        console.log(`   Platform: ${tier3Result.platform}`);
      } catch (error) {
        console.log('❌ Squidlr.com Failed:', error.message);
      }
    } else {
      console.log('\n🔥 TIER 3: Squidlr.com - SKIPPED (No YouTube support)');
    }
    
    console.log('\n' + '='.repeat(60));
  }
}

if (require.main === module) {
  testTiers2And3().catch(console.error);
}