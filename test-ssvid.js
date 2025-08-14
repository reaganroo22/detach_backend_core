const UniversalDownloader = require('./universal-downloader');

async function testSSVid() {
  const downloader = new UniversalDownloader();
  
  console.log('🧪 Testing SSVid.net (Tier 2)...\n');

  try {
    const url = 'https://www.youtube.com/shorts/0Pwt8wcSjmY';
    console.log(`Testing YouTube URL: ${url}`);
    
    const result = await downloader.downloadWithSSVid(url, 'youtube');
    console.log('✅ SSVid.net Success:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.log('❌ SSVid.net Failed:', error.message);
    console.log('Full error:', error);
  } finally {
    await downloader.close();
  }
}

if (require.main === module) {
  testSSVid().catch(console.error);
}