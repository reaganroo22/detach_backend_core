// Test API with real URLs provided by user
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const testUrls = [
  {
    name: 'TikTok',
    url: 'https://www.tiktok.com/@tiktokyoungboss/video/7492418301063187734',
    expectedTiers: ['GetLoady', 'SSVid.net', 'Squidlr.com']
  },
  {
    name: 'LinkedIn Video',
    url: 'https://www.linkedin.com/videos/ben-hanlin_you-asked-here-it-is-how-to-make-linkedin-activity-7269245338190843904-m5n6',
    expectedTiers: ['GetLoady', 'SSVid.net', 'Squidlr.com']
  },
  {
    name: 'YouTube Shorts',
    url: 'https://www.youtube.com/shorts/0Pwt8wcSjmY',
    expectedTiers: ['GetLoady', 'SSVid.net']
  },
  {
    name: 'Instagram Reel (clean URL)',
    url: 'https://www.instagram.com/reel/DMw7_HDusQY/', // Stripped utm_source
    expectedTiers: ['GetLoady', 'SSVid.net', 'Squidlr.com']
  },
  {
    name: 'Facebook Video',
    url: 'https://www.facebook.com/LifeWithGaitlyn/videos/314846414760933/',
    expectedTiers: ['GetLoady', 'SSVid.net', 'Squidlr.com']
  },
  {
    name: 'Pinterest Video',
    url: 'https://www.pinterest.com/pin/7670261861859938/',
    expectedTiers: ['GetLoady', 'SSVid.net']
  },
  {
    name: 'Apple Podcast',
    url: 'https://podcasts.apple.com/tt/podcast/day-217-the-effects-of-holy-orders-2025/id1648949780?i=1000720689799',
    expectedTiers: ['Fallback backends']
  },
  {
    name: 'Spotify Track',
    url: 'https://open.spotify.com/track/7uKqnK0Fe6mWIDocv4YhOw?si=00423c28cb73407b',
    expectedTiers: ['SSVid.net', 'Fallback backends']
  },
  {
    name: 'YouTube Music',
    url: 'https://music.youtube.com/watch?v=jm7T71wIT1c&feature=shared',
    expectedTiers: ['GetLoady', 'SSVid.net']
  }
];

function cleanUrl(url) {
  // Remove UTM parameters and other tracking parameters
  const urlObj = new URL(url);
  const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'si', 'feature'];
  
  paramsToRemove.forEach(param => {
    urlObj.searchParams.delete(param);
  });
  
  return urlObj.toString();
}

async function testRealUrlsApi() {
  console.log('🧪 Testing API with real URLs...\n');
  console.log('🔧 Note: Cleaning URLs by removing UTM parameters\n');
  
  const results = [];
  
  for (let i = 0; i < testUrls.length; i++) {
    const test = testUrls[i];
    const cleanedUrl = cleanUrl(test.url);
    
    console.log(`\n🎯 Test ${i + 1}/${testUrls.length}: ${test.name}`);
    console.log(`Original: ${test.url}`);
    console.log(`Cleaned:  ${cleanedUrl}`);
    console.log(`Expected: ${test.expectedTiers.join(' → ')}`);
    console.log('='.repeat(80));
    
    const startTime = Date.now();
    
    try {
      console.log('🚀 Making API request...');
      const response = await fetch('http://localhost:3004/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: cleanedUrl })
      });
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      if (response.ok) {
        const result = await response.json();
        
        console.log('✅ SUCCESS!');
        console.log(`   Platform: ${result.platform}`);
        console.log(`   Method: ${result.method}`);
        console.log(`   Tier: ${result.tier || 'Not specified'}`);
        console.log(`   Processing Time: ${result.processingTime || totalTime}ms`);
        console.log(`   Download URL: ${result.downloadUrl?.slice(0, 100)}${result.downloadUrl?.length > 100 ? '...' : ''}`);
        
        // Validate URL format for app compatibility
        const isValidUrl = result.downloadUrl?.startsWith('http');
        console.log(`   App Compatible: ${isValidUrl ? '✅ YES' : '❌ NO'}`);
        
        results.push({
          name: test.name,
          success: true,
          tier: result.tier,
          method: result.method,
          appCompatible: isValidUrl,
          processingTime: totalTime
        });
        
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.log(`❌ API Error: ${response.status} ${response.statusText}`);
        console.log(`   Details: ${errorText}`);
        
        results.push({
          name: test.name,
          success: false,
          error: `${response.status} ${response.statusText}`,
          processingTime: totalTime
        });
      }
      
    } catch (error) {
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      console.log(`❌ Request Failed: ${error.message}`);
      
      results.push({
        name: test.name,
        success: false,
        error: error.message,
        processingTime: totalTime
      });
    }
    
    // Wait between requests to avoid overwhelming the services
    if (i < testUrls.length - 1) {
      console.log('\n⏳ Waiting 3 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  // Summary
  console.log('\n📋 FINAL SUMMARY');
  console.log('='.repeat(80));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const appCompatible = successful.filter(r => r.appCompatible);
  
  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  console.log(`📱 App Compatible: ${appCompatible.length}/${successful.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}`);
  
  if (successful.length > 0) {
    console.log('\n🎯 Successful Downloads:');
    successful.forEach(r => {
      console.log(`   ${r.name}: ${r.tier} (${r.method}) - ${r.processingTime}ms`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Failed Downloads:');
    failed.forEach(r => {
      console.log(`   ${r.name}: ${r.error}`);
    });
  }
  
  // Performance analysis
  const avgTime = successful.reduce((sum, r) => sum + r.processingTime, 0) / successful.length;
  console.log(`\n⚡ Average Processing Time: ${Math.round(avgTime)}ms`);
}

if (require.main === module) {
  testRealUrlsApi().catch(console.error);
}