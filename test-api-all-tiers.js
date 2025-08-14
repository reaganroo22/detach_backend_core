// Test API with multiple URLs to verify all tiers work correctly
const testUrls = [
  {
    name: 'YouTube',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    expectedTier: 'Tier 1: GetLoady'
  },
  {
    name: 'Instagram Reel', 
    url: 'https://www.instagram.com/reel/DMw7_HDusQY/',
    expectedTier: 'Tier 2 or 3'
  },
  {
    name: 'TikTok',
    url: 'https://www.tiktok.com/@therock/video/7016198567564135686',
    expectedTier: 'Tier 1: GetLoady'
  }
];

async function testApiAllTiers() {
  console.log('🧪 Testing API with all tiers...\n');
  
  for (const test of testUrls) {
    console.log(`\n🎯 Testing ${test.name}: ${test.url}`);
    console.log(`Expected: ${test.expectedTier}`);
    console.log('='.repeat(60));
    
    try {
      const response = await fetch('http://localhost:3004/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: test.url })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ API Response:');
        console.log(`   Success: ${result.success}`);
        console.log(`   Download URL: ${result.downloadUrl?.slice(0, 100)}...`);
        console.log(`   Platform: ${result.platform}`);
        console.log(`   Method: ${result.method}`);
        console.log(`   Tier: ${result.tier || 'not specified'}`);
        console.log(`   Processing Time: ${result.processingTime}ms`);
        
        // Validate URL format for app compatibility
        if (result.downloadUrl?.startsWith('http')) {
          console.log('✅ URL Format: Valid for app use');
        } else {
          console.log('❌ URL Format: Invalid - needs fixing');
        }
      } else {
        console.log(`❌ API Error: ${response.status} ${response.statusText}`);
      }
      
    } catch (error) {
      console.log(`❌ Request failed: ${error.message}`);
    }
    
    // Wait between requests
    console.log('\n⏳ Waiting 5 seconds before next test...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

// Add fetch polyfill for Node.js
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

if (require.main === module) {
  testApiAllTiers().catch(console.error);
}

module.exports = { testApiAllTiers };