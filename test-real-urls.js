// Test all tiers with real, valid URLs
const UniversalDownloader = require('./universal-downloader');

async function testRealUrls() {
  console.log('🧪 Testing all tiers with real URLs...\n');
  
  const downloader = new UniversalDownloader();
  
  // Real URLs that actually exist
  const testUrls = [
    {
      platform: 'youtube',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Rick Roll - always exists
      description: 'YouTube - Rick Roll'
    },
    {
      platform: 'tiktok', 
      url: 'https://www.tiktok.com/@therock/video/7016198567564135686', // The Rock's TikTok
      description: 'TikTok - The Rock'
    },
    {
      platform: 'instagram',
      url: 'https://www.instagram.com/p/B_Ua6ZbAoAA/', // Popular Instagram post
      description: 'Instagram - Popular post'
    }
  ];
  
  for (const test of testUrls) {
    console.log(`\n🎯 Testing: ${test.description}`);
    console.log(`URL: ${test.url}`);
    
    try {
      // Test GetLoady (Tier 1)
      console.log('\n--- Testing GetLoady (Tier 1) ---');
      const tier1Result = await downloader.downloadWithGetLoady(test.url, test.platform);
      console.log('Tier 1 Result:', JSON.stringify(tier1Result, null, 2));
      
      // Test SSVid (Tier 2) 
      console.log('\n--- Testing SSVid (Tier 2) ---');
      const tier2Result = await downloader.downloadWithSSVid(test.url, test.platform);
      console.log('Tier 2 Result:', JSON.stringify(tier2Result, null, 2));
      
      // Test Squidlr (Tier 3) - only if not YouTube
      if (test.platform !== 'youtube') {
        console.log('\n--- Testing Squidlr (Tier 3) ---');
        const tier3Result = await downloader.downloadWithSquidlr(test.url, test.platform);
        console.log('Tier 3 Result:', JSON.stringify(tier3Result, null, 2));
      } else {
        console.log('\n--- Skipping Squidlr (Tier 3) - No YouTube support ---');
      }
      
    } catch (error) {
      console.error(`❌ Error testing ${test.description}:`, error.message);
    }
    
    console.log('\n' + '='.repeat(60));
  }
}

if (require.main === module) {
  testRealUrls().catch(console.error);
}