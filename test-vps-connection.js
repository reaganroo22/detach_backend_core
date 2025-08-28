// Test VPS Connection Script
// Run this to verify your Expo app can connect to your VPS

const axios = require('axios');

const VPS_IP = '69.48.202.90';
const VPS_PORT = '3000';
const VPS_BASE_URL = `http://${VPS_IP}:${VPS_PORT}`;

async function testVPSConnection() {
  console.log('🧪 Testing VPS Connection...');
  console.log(`🎯 Target: ${VPS_BASE_URL}`);
  console.log('');

  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing Health Endpoint...');
    const healthResponse = await axios.get(`${VPS_BASE_URL}/health`, {
      timeout: 10000
    });
    
    if (healthResponse.status === 200) {
      console.log('✅ Health Check: PASSED');
      console.log(`   Status: ${healthResponse.data.status}`);
      console.log(`   Version: ${healthResponse.data.version || 'N/A'}`);
      console.log(`   Strategy: ${healthResponse.data.strategy || 'N/A'}`);
    } else {
      console.log('❌ Health Check: FAILED');
      return;
    }

    console.log('');

    // Test 2: Download Endpoint Connectivity
    console.log('2️⃣ Testing Download Endpoint Connectivity...');
    try {
      const downloadResponse = await axios.post(`${VPS_BASE_URL}/download`, {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Rick Roll test
        format: 'audio',
        audioQuality: 'high'
      }, {
        timeout: 30000
      });

      if (downloadResponse.status === 200 && downloadResponse.data.success) {
        console.log('✅ Download Endpoint: PASSED');
        console.log(`   Platform: ${downloadResponse.data.platform}`);
        console.log(`   Method: ${downloadResponse.data.data?.method || 'N/A'}`);
        console.log(`   Tier: ${downloadResponse.data.data?.tier || 'N/A'}`);
        console.log(`   Download URL: ${downloadResponse.data.data?.downloadUrl ? 'Generated' : 'Missing'}`);
      } else {
        console.log('⚠️ Download Endpoint: PARTIAL - Connected but failed to process');
        console.log(`   Error: ${downloadResponse.data?.error || 'Unknown error'}`);
      }
    } catch (downloadError) {
      if (downloadError.code === 'ECONNREFUSED') {
        console.log('❌ Download Endpoint: CONNECTION REFUSED');
        console.log('   Backend is not running on the VPS');
        return;
      } else if (downloadError.response) {
        console.log('⚠️ Download Endpoint: REACHABLE but returned error');
        console.log(`   Status: ${downloadError.response.status}`);
        console.log(`   Error: ${downloadError.response.data?.error || 'Server error'}`);
      } else {
        console.log('❌ Download Endpoint: NETWORK ERROR');
        console.log(`   Error: ${downloadError.message}`);
      }
    }

    console.log('');

    // Test 3: File Serving
    console.log('3️⃣ Testing File Serving Endpoint...');
    try {
      const filesResponse = await axios.get(`${VPS_BASE_URL}/files/`, {
        timeout: 5000,
        validateStatus: () => true // Accept any status
      });
      
      if (filesResponse.status === 200 || filesResponse.status === 403) {
        console.log('✅ File Serving: ACCESSIBLE');
        console.log('   Files endpoint is reachable');
      } else {
        console.log('⚠️ File Serving: PARTIAL');
        console.log(`   Status: ${filesResponse.status}`);
      }
    } catch (filesError) {
      console.log('❌ File Serving: ERROR');
      console.log(`   Error: ${filesError.message}`);
    }

    console.log('');
    console.log('🎉 VPS CONNECTION TEST COMPLETED');
    console.log('');
    console.log('📋 Next Steps:');
    console.log('1. If health check failed: Start your backend on the VPS');
    console.log('2. If download failed: Check backend logs for errors');
    console.log('3. If all passed: Your Expo app should work perfectly!');
    console.log('');
    console.log('🔧 VPS Backend Commands:');
    console.log('   Start: npm start');
    console.log('   Logs: pm2 logs detach-backend');
    console.log('   Status: pm2 status');

  } catch (error) {
    console.log('❌ CRITICAL ERROR: Cannot reach VPS');
    console.log(`Error: ${error.message}`);
    console.log('');
    console.log('🔍 Troubleshooting:');
    console.log(`1. Verify VPS IP: ${VPS_IP}`);
    console.log(`2. Check if backend is running on port ${VPS_PORT}`);
    console.log('3. Verify Windows Firewall allows port 3000');
    console.log('4. Check if VPS is accessible from internet');
  }
}

// Configuration Summary
console.log('📱 EXPO APP CONFIGURATION SUMMARY');
console.log('=====================================');
console.log(`VPS IP: ${VPS_IP}`);
console.log(`Backend URL: ${VPS_BASE_URL}`);
console.log(`API Config File: /config/api.ts`);
console.log(`Current Setting: http://69.48.202.90:3000`);
console.log('');

testVPSConnection().catch(console.error);