/**
 * Test full download process locally - automation + file download
 */

const express = require('express');
const ComprehensiveDownloaderSuite = require('./comprehensive-downloader-suite');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { createWriteStream } = require('fs');

async function downloadFile(downloadUrl, filename) {
  try {
    console.log(`⬇️ Downloading file: ${filename} from: ${downloadUrl.substring(0, 100)}...`);
    
    // Ensure downloads directory exists
    await fs.mkdir('./downloads', { recursive: true });
    
    const filePath = path.join('./downloads', filename);
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Referer': 'https://www.youtube.com/',
      'Origin': 'https://www.youtube.com'
    };
    
    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'stream',
      timeout: 60000,
      maxRedirects: 10,
      headers: headers,
      validateStatus: (status) => status < 400
    });
    
    console.log(`📁 Content-Type: ${response.headers['content-type']}, Content-Length: ${response.headers['content-length'] || 'unknown'}`);
    
    const writer = createWriteStream(filePath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', async () => {
        try {
          const stats = await fs.stat(filePath);
          console.log(`✅ File downloaded: ${filename}, Size: ${stats.size} bytes`);
          resolve(filePath);
        } catch (statError) {
          reject(statError);
        }
      });
      
      writer.on('error', reject);
      response.data.on('error', reject);
    });
  } catch (error) {
    console.error(`❌ Download failed for ${filename}: ${error.message}`);
    throw error;
  }
}

async function testFullDownload() {
  console.log('🚀 Testing full download process locally...');
  
  const downloader = new ComprehensiveDownloaderSuite({
    headless: false, // Show browser
    qualityPreference: 'highest',
    enableLogging: true,
    retryAttempts: 1,
    downloadTimeout: 60000
  });
  
  try {
    await downloader.initialize();
    console.log('✅ Browser initialized');
    
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    console.log(`🎯 Testing URL: ${url}`);
    
    // Get the video URL through automation
    const result = await downloader.downloadWithRetry(url);
    console.log('📊 Automation Result:', result.success ? 'SUCCESS' : 'FAILED');
    
    if (result.success) {
      console.log(`🎬 Video URL: ${result.downloadUrl.substring(0, 100)}...`);
      
      // Download the actual file
      const filename = `test_download_${Date.now()}.mp4`;
      const filePath = await downloadFile(result.downloadUrl, filename);
      
      console.log(`🎉 COMPLETE SUCCESS! File saved to: ${filePath}`);
      
      // Check file stats
      const stats = await fs.stat(filePath);
      console.log(`📄 Final file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      
    } else {
      console.log(`❌ Automation failed: ${result.error}`);
    }
    
    await downloader.close();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    try {
      await downloader.close();
    } catch (closeError) {
      // ignore
    }
  }
}

testFullDownload();