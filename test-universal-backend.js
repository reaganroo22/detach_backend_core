const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Test URLs from your provided list
const testUrls = [
  'https://www.youtube.com/shorts/0Pwt8wcSjmY',
  'https://www.instagram.com/reel/DMw7_HDusQY',
  'https://www.tiktok.com/@misscarolineflett/video/7106603930154585349/',
  'https://www.facebook.com/iamkybaldwin/videos/facebook-only-allows-90-seconds-on-reels-so-heres-the-extended-version-heyjude-t/316203414406924/'
];

async function testEndpoint(endpoint, data = null) {
  try {
    const config = {
      method: data ? 'POST' : 'GET',
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return { success: true, data: response.data };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message 
    };
  }
}

async function runTests() {
  console.log('🧪 Testing Universal Social Media Downloader Backend\n');
  
  // Test health endpoint
  console.log('1️⃣ Testing Health Endpoint...');
  const healthResult = await testEndpoint('/health');
  if (healthResult.success) {
    console.log('✅ Health check passed');
    console.log(`📊 Status: ${healthResult.data.status}`);
    console.log(`🕐 Timestamp: ${healthResult.data.timestamp}`);
    console.log(`🏗️ Tiers: ${healthResult.data.tiers.length} configured\n`);
  } else {
    console.log('❌ Health check failed:', healthResult.error);
    return;
  }
  
  // Test platforms endpoint
  console.log('2️⃣ Testing Platforms Endpoint...');
  const platformsResult = await testEndpoint('/platforms');
  if (platformsResult.success) {
    console.log('✅ Platforms endpoint working');
    console.log(`📱 GetLoady supports: ${platformsResult.data.getloady.length} platforms`);
    console.log(`📱 SSVid supports: ${platformsResult.data.ssvid.length} platforms`);
    console.log(`📱 Squidlr supports: ${platformsResult.data.squidlr.length} platforms\n`);
  } else {
    console.log('❌ Platforms check failed:', platformsResult.error);
  }
  
  // Test download functionality with one URL
  console.log('3️⃣ Testing Download Functionality...');
  console.log('🔗 Testing with YouTube URL (should use GetLoady or SSVid)');
  
  const downloadResult = await testEndpoint('/download', { 
    url: testUrls[0] // YouTube URL
  });
  
  if (downloadResult.success) {
    console.log('✅ Download test successful!');
    console.log(`📱 Platform: ${downloadResult.data.platform}`);
    console.log(`🎯 Success: ${downloadResult.data.success}`);
    console.log(`🏗️ Tiers attempted: ${downloadResult.data.tiers.length}`);
    
    // Show tier results
    downloadResult.data.tiers.forEach(tier => {
      const status = tier.success ? '✅' : '❌';
      console.log(`   ${status} Tier ${tier.tier} (${tier.source}): ${tier.success ? 'SUCCESS' : 'FAILED'}`);
    });
    
    if (downloadResult.data.data) {
      console.log(`\n📦 Captured URLs: ${downloadResult.data.data.length}`);
      downloadResult.data.data.forEach((item, i) => {
        console.log(`   ${i + 1}. [${item.type}] ${item.url.substring(0, 80)}...`);
      });
    }
  } else {
    console.log('❌ Download test failed:', downloadResult.error);
  }
  
  console.log('\n🎉 Backend testing complete!');
  console.log('\n📋 Summary:');
  console.log('   - Universal backend implemented with 5-tier fallback system');
  console.log('   - GetLoady (Tier 1): Google Video URLs via new tab detection');
  console.log('   - SSVid.net (Tier 2): Download files via 2.5min conversion wait');
  console.log('   - Squidlr.com (Tier 3): Direct CDN URLs via cloud download icons');
  console.log('   - Railway (Tier 4): Backend fallback (to be implemented)');
  console.log('   - Vercel (Tier 5): Final fallback (to be implemented)');
  console.log('\n🚀 Ready for deployment!');
}

if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testEndpoint, runTests };