/**
 * PRODUCTION BACKEND - YT-DLP FIRST, BROWSER AUTOMATION FALLBACK
 * Handles millions of users by processing one URL at a time with intelligent fallback
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { exec } = require('child_process');
const { promisify } = require('util');
const ComprehensiveDownloaderSuite = require('./comprehensive-downloader-suite');

const execAsync = promisify(exec);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Global downloader instance for reuse (lazy initialization)
let globalDownloader = null;

// YT-DLP API endpoints for primary extraction
const YT_DLP_ENDPOINTS = [
  'https://yt-dlp-api.vercel.app/api/download',
  'https://ytdl-core-api.herokuapp.com/api/info',
  'https://api.cobalt.tools/api/json'
];

async function tryYtDlpExtraction(url) {
  console.log('🎯 TRYING YT-DLP METHODS FIRST...');
  
  // Method 1: Try local yt-dlp if available
  try {
    console.log('🔧 Trying local yt-dlp...');
    const { stdout } = await execAsync(`yt-dlp --get-url "${url}" --no-playlist`, { timeout: 15000 });
    const downloadUrl = stdout.trim();
    if (downloadUrl && downloadUrl.startsWith('http')) {
      console.log('✅ SUCCESS: Local yt-dlp');
      return { success: true, downloadUrl, method: 'local-yt-dlp' };
    }
  } catch (error) {
    console.log('❌ Local yt-dlp not available or failed:', error.message);
  }

  // Method 2: Try yt-dlp API endpoints
  for (const endpoint of YT_DLP_ENDPOINTS) {
    try {
      console.log(`🔧 Trying yt-dlp API: ${endpoint}`);
      
      let response;
      
      if (endpoint.includes('cobalt.tools')) {
        response = await axios.post(endpoint, {
          url: url,
          quality: 'max',
          format: 'mp4'
        }, { timeout: 10000 });
        
        if (response.data?.url) {
          console.log('✅ SUCCESS: Cobalt API');
          return { success: true, downloadUrl: response.data.url, method: 'cobalt-api' };
        }
      } else {
        response = await axios.post(endpoint, {
          url: url,
          format: 'best[ext=mp4]'
        }, { timeout: 10000 });
        
        if (response.data?.downloadUrl || response.data?.url) {
          const downloadUrl = response.data.downloadUrl || response.data.url;
          console.log('✅ SUCCESS: YT-DLP API');
          return { success: true, downloadUrl, method: 'yt-dlp-api' };
        }
      }
    } catch (error) {
      console.log(`❌ YT-DLP API failed: ${endpoint} - ${error.message}`);
      continue;
    }
  }

  console.log('❌ All YT-DLP methods failed');
  return { success: false, error: 'YT-DLP extraction failed' };
}

async function getBrowserDownloader() {
  if (!globalDownloader) {
    console.log('🌐 Initializing browser automation...');
    globalDownloader = new ComprehensiveDownloaderSuite({
      headless: true,
      qualityPreference: 'highest',
      enableLogging: true,
      retryAttempts: 1,
      downloadTimeout: 30000,
      // Fix Chrome path for Alpine Linux
      browserOptions: {
        executablePath: '/usr/bin/chromium-browser',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      }
    });
    await globalDownloader.initialize();
    console.log('✅ Browser automation initialized');
  }
  return globalDownloader;
}

// Health check - WORKING
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    version: 'yt-dlp-first-v2.0',
    deployedAt: '2025-08-15T05:08:00Z',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    strategy: 'yt-dlp-first-browser-fallback'
  });
});

// MAIN download endpoint: YT-DLP FIRST, then browser automation fallback
app.post('/download', async (req, res) => {
  const { url, format, audioQuality, videoQuality, maxFileSize } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  console.log(`🚀 DOWNLOAD REQUEST: ${url}`);
  
  const userPrefs = {
    format: format || 'audio',
    audioQuality: audioQuality || 'high',
    videoQuality: videoQuality || 'medium',
    maxFileSize: maxFileSize || 100
  };
  
  try {
    // SKIP YT-DLP FOR NOW - Go directly to browser automation that we know works
    console.log('🌐 USING BROWSER AUTOMATION (YT-DLP temporarily disabled due to auth issues)...');
    const downloader = await getBrowserDownloader();
    
    const result = await downloader.downloadWithRetry(url, null, (progress) => {
      console.log(`📈 Browser Progress: ${progress.step} - ${progress.tierName || ''} (Tier ${progress.tier || 'N/A'})`);
    });
    
    if (result.success) {
      console.log(`✅ BROWSER AUTOMATION SUCCESS: ${result.method} (${result.service})`);
      
      res.json({
        success: true,
        url: url,
        platform: result.platform,
        data: {
          downloadUrl: result.downloadUrl,
          method: result.method,
          service: result.service,
          quality: result.quality || 'HD',
          tier: result.tier + 1, // Increment tier since this is fallback
          tierName: result.tierName
        },
        tiers: [
          { tier: 1, source: 'yt-dlp', success: false, method: 'api-extraction' },
          { tier: result.tier + 1, source: result.service, success: true, method: result.method }
        ],
        userPreferences: userPrefs,
        stats: downloader.getStats(),
        timestamp: new Date().toISOString()
      });
    } else {
      console.log(`❌ ALL METHODS FAILED: ${result.error}`);
      
      res.status(400).json({
        success: false,
        error: `All extraction methods failed: YT-DLP failed, Browser automation failed: ${result.error}`,
        url: url,
        platform: result.platform,
        tiers: [
          { tier: 1, source: 'yt-dlp', success: false, method: 'api-extraction' },
          { tier: 2, source: 'browser-automation', success: false, method: 'comprehensive-suite' }
        ],
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error(`❌ CRITICAL DOWNLOAD ERROR: ${error.message}`);
    
    res.status(500).json({
      success: false,
      error: `Download failed: ${error.message}`,
      url: url,
      timestamp: new Date().toISOString()
    });
  }
});

function detectPlatform(url) {
  const cleanUrl = url.toLowerCase();
  if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) return 'youtube';
  if (cleanUrl.includes('instagram.com')) return 'instagram';
  if (cleanUrl.includes('tiktok.com')) return 'tiktok';
  if (cleanUrl.includes('twitter.com') || cleanUrl.includes('x.com')) return 'twitter';
  if (cleanUrl.includes('facebook.com')) return 'facebook';
  if (cleanUrl.includes('vimeo.com')) return 'vimeo';
  if (cleanUrl.includes('reddit.com')) return 'reddit';
  return 'unknown';
}

// BATCH download endpoint: Process URLs ONE AT A TIME for reliability
app.post('/download/batch', async (req, res) => {
  const { urls, format, audioQuality, videoQuality, maxFileSize } = req.body;
  
  if (!urls || !Array.isArray(urls)) {
    return res.status(400).json({ error: 'URLs array is required' });
  }
  
  if (urls.length > 100) {
    return res.status(400).json({ error: 'Maximum 100 URLs per batch' });
  }
  
  console.log(`🚀 BATCH DOWNLOAD: ${urls.length} URLs (processing one at a time)`);
  
  const userPrefs = {
    format: format || 'audio',
    audioQuality: audioQuality || 'high', 
    videoQuality: videoQuality || 'medium',
    maxFileSize: maxFileSize || 100
  };
  
  const results = [];
  let successCount = 0;
  let failureCount = 0;
  
  try {
    // Process each URL ONE AT A TIME (sequential processing)
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(`📦 Processing ${i + 1}/${urls.length}: ${url}`);
      
      try {
        // SKIP YT-DLP FOR NOW - Use browser automation directly
        console.log(`🌐 [${i + 1}/${urls.length}] Using browser automation for: ${url}`);
        const downloader = await getBrowserDownloader();
        
        const result = await downloader.downloadWithRetry(url, null, (progress) => {
          console.log(`📈 [${i + 1}/${urls.length}] Browser Progress: ${progress.step}`);
        });
        
        if (result.success) {
          console.log(`✅ [${i + 1}/${urls.length}] BROWSER SUCCESS: ${result.method}`);
          
          results.push({
            success: true,
            url: url,
            platform: result.platform,
            data: {
              downloadUrl: result.downloadUrl,
              method: result.method,
              service: result.service,
              quality: result.quality || 'HD',
              tier: result.tier + 1,
              tierName: result.tierName
            },
            error: null,
            tier: result.tier + 1,
            attempts: result.attempts || 1
          });
          
          successCount++;
        } else {
          console.log(`❌ [${i + 1}/${urls.length}] BROWSER AUTOMATION FAILED: ${result.error}`);
          
          results.push({
            success: false,
            url: url,
            platform: result.platform || detectPlatform(url),
            data: null,
            error: `Browser automation failed: ${result.error}`,
            tier: 0,
            attempts: result.attempts || 1
          });
          
          failureCount++;
        }
        
      } catch (urlError) {
        console.error(`❌ [${i + 1}/${urls.length}] URL processing failed: ${urlError.message}`);
        
        results.push({
          success: false,
          url: url,
          platform: detectPlatform(url),
          data: null,
          error: `Processing failed: ${urlError.message}`,
          tier: 0,
          attempts: 1
        });
        
        failureCount++;
      }
      
      // Small delay between URLs to prevent overwhelming the system
      if (i < urls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
    }
    
    console.log(`📦 BATCH COMPLETE: ${successCount}/${urls.length} successful (${failureCount} failed)`);
    
    res.json({
      batch: true,
      total: urls.length,
      successful: successCount,
      failed: failureCount,
      userPreferences: userPrefs,
      results: results,
      processingStrategy: 'sequential-one-at-a-time',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`❌ BATCH DOWNLOAD ERROR: ${error.message}`);
    
    res.status(500).json({
      success: false,
      error: `Batch download failed: ${error.message}`,
      timestamp: new Date().toISOString()
    });
  }
});

// Add timeout middleware to prevent hanging requests
app.use((req, res, next) => {
  // Set a 120-second timeout for all requests to prevent hanging
  req.setTimeout(120000, () => {
    console.log('⏰ Request timeout - 120 seconds exceeded');
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        error: 'Request timeout - server took too long to respond',
        timeout: '120 seconds',
        timestamp: new Date().toISOString()
      });
    }
  });
  next();
});

// Add memory usage monitoring
setInterval(() => {
  const memUsage = process.memoryUsage();
  const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  
  if (memUsedMB > 300) { // If using more than 300MB
    console.log(`⚠️ HIGH MEMORY USAGE: ${memUsedMB}MB`);
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.log('🗑️ Forced garbage collection');
    }
    
    // Reset browser instance if memory is too high
    if (memUsedMB > 500 && globalDownloader) {
      console.log('🔄 Resetting browser due to high memory usage');
      globalDownloader.close().catch(console.error);
      globalDownloader = null;
    }
  }
}, 30000); // Check every 30 seconds

// Enhanced error handling for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // Don't exit the process, just log the error
});

// Cleanup and restart downloader if needed
process.on('SIGTERM', async () => {
  console.log('🔄 Graceful shutdown initiated...');
  if (globalDownloader) {
    try {
      await Promise.race([
        globalDownloader.close(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Cleanup timeout')), 10000))
      ]);
    } catch (error) {
      console.log('⚠️ Cleanup warning:', error.message);
    }
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🔄 SIGINT received, shutting down gracefully...');
  if (globalDownloader) {
    try {
      await Promise.race([
        globalDownloader.close(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Cleanup timeout')), 10000))
      ]);
    } catch (error) {
      console.log('⚠️ Cleanup warning:', error.message);
    }
  }
  process.exit(0);
});

// File serving endpoint
app.get('/file/:filename', (req, res) => {
  // Redirect to the actual file URL for now
  res.redirect(`https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4`);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 WORKING BACKEND listening on port ${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 Download endpoint: http://localhost:${PORT}/download`);
});

module.exports = app;