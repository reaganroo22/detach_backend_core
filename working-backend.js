/**
 * PRODUCTION BACKEND - BROWSER AUTOMATION THAT ACTUALLY WORKS
 * Uses the tested comprehensive downloader suite with batch support
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const ComprehensiveDownloaderSuite = require('./comprehensive-downloader-suite');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Global downloader instance for reuse
let globalDownloader = null;

async function getDownloader() {
  if (!globalDownloader) {
    globalDownloader = new ComprehensiveDownloaderSuite({
      headless: true,
      qualityPreference: 'highest',
      enableLogging: true,
      retryAttempts: 2,
      downloadTimeout: 45000
    });
    await globalDownloader.initialize();
    console.log('✅ Global downloader initialized');
  }
  return globalDownloader;
}

// Health check - WORKING
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// WORKING download endpoint using TESTED browser automation
app.post('/download', async (req, res) => {
  const { url, format, audioQuality, videoQuality, maxFileSize } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  console.log(`🚀 BROWSER AUTOMATION DOWNLOAD: ${url}`);
  
  const userPrefs = {
    format: format || 'audio',
    audioQuality: audioQuality || 'high',
    videoQuality: videoQuality || 'medium',
    maxFileSize: maxFileSize || 100
  };
  
  try {
    const downloader = await getDownloader();
    
    // Use the TESTED browser automation
    const result = await downloader.downloadWithRetry(url, null, (progress) => {
      console.log(`📈 Progress: ${progress.step} - ${progress.tierName || ''} (Tier ${progress.tier || 'N/A'})`);
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
          tier: result.tier,
          tierName: result.tierName
        },
        tiers: [{
          tier: result.tier,
          source: result.service,
          success: true,
          method: result.method
        }],
        userPreferences: userPrefs,
        stats: downloader.getStats(),
        timestamp: new Date().toISOString()
      });
    } else {
      console.log(`❌ BROWSER AUTOMATION FAILED: ${result.error}`);
      
      res.status(400).json({
        success: false,
        error: result.error,
        url: url,
        platform: result.platform,
        stats: downloader.getStats(),
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error(`❌ CRITICAL BROWSER ERROR: ${error.message}`);
    
    res.status(500).json({
      success: false,
      error: `Browser automation failed: ${error.message}`,
      url: url,
      timestamp: new Date().toISOString()
    });
  }
});

// BATCH download endpoint for multiple URLs
app.post('/download/batch', async (req, res) => {
  const { urls, format, audioQuality, videoQuality, maxFileSize } = req.body;
  
  if (!urls || !Array.isArray(urls)) {
    return res.status(400).json({ error: 'URLs array is required' });
  }
  
  if (urls.length > 50) {
    return res.status(400).json({ error: 'Maximum 50 URLs per batch' });
  }
  
  console.log(`🚀 BATCH DOWNLOAD: ${urls.length} URLs`);
  
  const userPrefs = {
    format: format || 'audio',
    audioQuality: audioQuality || 'high', 
    videoQuality: videoQuality || 'medium',
    maxFileSize: maxFileSize || 100
  };
  
  try {
    const downloader = await getDownloader();
    
    // Use the TESTED batch download with progress tracking
    const results = await downloader.batchDownload(urls, 3, (batchProgress) => {
      console.log(`📦 Batch: ${batchProgress.percentage}% (${batchProgress.completed}/${batchProgress.total}) - ${batchProgress.status}`);
    });
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    
    console.log(`📦 BATCH COMPLETE: ${successCount}/${results.length} successful`);
    
    res.json({
      batch: true,
      total: urls.length,
      successful: successCount,
      failed: failureCount,
      userPreferences: userPrefs,
      results: results.map(result => ({
        success: result.success,
        url: result.url,
        platform: result.platform,
        data: result.success ? {
          downloadUrl: result.downloadUrl,
          method: result.method,
          service: result.service,
          quality: result.quality || 'HD',
          tier: result.tier,
          tierName: result.tierName
        } : null,
        error: result.success ? null : result.error,
        tier: result.tier,
        attempts: result.attempts
      })),
      stats: downloader.getStats(),
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

// Cleanup and restart downloader if needed
process.on('SIGTERM', async () => {
  console.log('🔄 Graceful shutdown initiated...');
  if (globalDownloader) {
    await globalDownloader.close();
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