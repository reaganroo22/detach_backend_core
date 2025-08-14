const UniversalDownloader = require('./universal-downloader');

async function testSquidlr() {
  const downloader = new UniversalDownloader();
  
  console.log('🧪 Testing Squidlr.com (Tier 3)...\n');

  try {
    const url = 'https://www.tiktok.com/@tiktokyoungboss/video/7492418301063187734';
    console.log(`Testing TikTok URL: ${url}`);
    
    const result = await downloader.downloadWithSquidlr(url, 'tiktok');
    console.log('✅ Squidlr.com Success:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.log('❌ Squidlr.com Failed:', error.message);
    console.log('Full error:', error);
  } finally {
    await downloader.close();
  }
}

if (require.main === module) {
  testSquidlr().catch(console.error);
}