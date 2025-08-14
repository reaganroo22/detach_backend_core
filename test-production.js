const axios = require('axios');

// Test script for production Railway deployment
const PRODUCTION_URL = process.env.RAILWAY_URL || 'http://localhost:3000';

const testUrls = [
  'https://www.youtube.com/shorts/0Pwt8wcSjmY',
  'https://www.instagram.com/reel/DMw7_HDusQY',
  'https://www.tiktok.com/@misscarolineflett/video/7106603930154585349/',
  'https://www.facebook.com/iamkybaldwin/videos/facebook-only-allows-90-seconds-on-reels-so-heres-the-extended-version-heyjude-t/316203414406924/'
];

async function testProductionDeployment() {
  console.log('🧪 Testing Production Railway Deployment');
  console.log(`🔗 Testing URL: ${PRODUCTION_URL}\n`);
  
  try {
    // Test health endpoint
    console.log('1️⃣ Testing Health Endpoint...');
    const health = await axios.get(`${PRODUCTION_URL}/health`);
    console.log('✅ Health check passed');
    console.log(`📊 Status: ${health.data.status}`);
    console.log(`🏗️ Tiers: ${health.data.tiers.length} configured\n`);
    
    // Test platforms endpoint
    console.log('2️⃣ Testing Platforms Endpoint...');
    const platforms = await axios.get(`${PRODUCTION_URL}/platforms`);
    console.log('✅ Platforms endpoint working');
    console.log(`📱 Total platforms supported: ${Object.keys(platforms.data).length}\n`);
    
    // Test download with one URL
    console.log('3️⃣ Testing Download Functionality...');
    console.log('🔗 Testing with YouTube URL (6-tier system)');
    
    const startTime = Date.now();
    const download = await axios.post(`${PRODUCTION_URL}/download`, {
      url: testUrls[0]
    }, {
      timeout: 180000 // 3 minute timeout
    });
    const duration = Date.now() - startTime;
    
    console.log(`✅ Download test completed in ${duration}ms`);
    console.log(`📱 Platform: ${download.data.platform}`);
    console.log(`🎯 Success: ${download.data.success}`);
    console.log(`🏗️ Tiers attempted: ${download.data.tiers.length}`);
    
    // Show tier results
    download.data.tiers.forEach(tier => {
      const status = tier.success ? '✅' : '❌';
      console.log(`   ${status} Tier ${tier.tier} (${tier.source}): ${tier.success ? 'SUCCESS' : 'FAILED'}`);
      if (tier.error) console.log(`      Error: ${tier.error}`);
    });
    
    if (download.data.data && download.data.data.length > 0) {
      console.log(`\n📦 Captured URLs: ${download.data.data.length}`);
      download.data.data.forEach((item, i) => {
        console.log(`   ${i + 1}. [${item.source}] ${item.type}`);
        console.log(`      URL: ${item.url.substring(0, 80)}...`);
        if (item.title) console.log(`      Title: ${item.title}`);
        if (item.filename) console.log(`      Filename: ${item.filename}`);
      });
    }
    
    console.log('\n🎉 Production deployment test successful!');
    
  } catch (error) {
    console.error('\n❌ Production test failed:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(`Error: ${error.message}`);
    }
  }
}

if (require.main === module) {
  testProductionDeployment().catch(console.error);
}

module.exports = { testProductionDeployment };