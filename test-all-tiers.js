const UniversalDownloader = require('./universal-downloader');

async function testAllTiers() {
  const downloader = new UniversalDownloader();
  
  const testUrls = [
    'https://www.youtube.com/shorts/0Pwt8wcSjmY',
    'https://www.tiktok.com/@tiktokyoungboss/video/7492418301063187734',
    'https://www.instagram.com/reel/DMw7_HDusQY/',
    'https://x.com/_allanguo/status/1945185671054024828'
  ];

  console.log('🧪 Testing all tiers individually...\n');

  for (const url of testUrls) {
    const platform = downloader.detectPlatform(url);
    console.log(`\n📱 Testing ${platform.toUpperCase()}: ${url}`);
    console.log('━'.repeat(80));

    // Test Tier 1: GetLoady
    try {
      console.log('🎯 TIER 1: GetLoady');
      const result1 = await downloader.downloadWithGetLoady(url, platform);
      console.log(`✅ Tier 1 Success: ${result1.downloadUrl}`);
    } catch (error) {
      console.log(`❌ Tier 1 Failed: ${error.message}`);
    }

    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test Tier 2: SSVid.net
    try {
      console.log('🎯 TIER 2: SSVid.net');
      const result2 = await downloader.downloadWithSSVid(url, platform);
      console.log(`✅ Tier 2 Success: ${result2.downloadUrl}`);
    } catch (error) {
      console.log(`❌ Tier 2 Failed: ${error.message}`);
    }

    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test Tier 3: Squidlr.com (skip YouTube)
    if (platform !== 'youtube') {
      try {
        console.log('🎯 TIER 3: Squidlr.com');
        const result3 = await downloader.downloadWithSquidlr(url, platform);
        console.log(`✅ Tier 3 Success: ${result3.downloadUrl}`);
      } catch (error) {
        console.log(`❌ Tier 3 Failed: ${error.message}`);
      }
    } else {
      console.log('🎯 TIER 3: Squidlr.com - Skipped (YouTube not supported)');
    }

    console.log('\n' + '='.repeat(80));
  }

  await downloader.close();
  console.log('\n🏁 All tier tests completed!');
}

if (require.main === module) {
  testAllTiers().catch(console.error);
}