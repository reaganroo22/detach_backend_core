const express = require('express');
const cors = require('cors');
const path = require('path');
const UniversalDownloader = require('./universal-downloader');

const app = express();
const PORT = process.env.PORT || 3003;

// Enhanced CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://detach.app', 'exp://192.168.1.1:8081', 'exp://localhost:8081', /\.exp\.direct$/]
    : true,
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const requestCounts = new Map();
const RATE_LIMIT = 50; // requests per hour
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

app.use((req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!requestCounts.has(clientIP)) {
    requestCounts.set(clientIP, { count: 1, windowStart: now });
    return next();
  }
  
  const clientData = requestCounts.get(clientIP);
  
  if (now - clientData.windowStart > WINDOW_MS) {
    clientData.count = 1;
    clientData.windowStart = now;
    return next();
  }
  
  if (clientData.count >= RATE_LIMIT) {
    return res.status(429).json({ 
      error: 'Too many requests', 
      message: 'Rate limit exceeded. Please try again later.' 
    });
  }
  
  clientData.count++;
  next();
});

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Universal downloader instance (reused across requests)
let universalDownloader = null;

// Initialize downloader
async function initializeDownloader() {
  if (!universalDownloader) {
    console.log('Initializing Universal Downloader...');
    universalDownloader = new UniversalDownloader();
  }
  return universalDownloader;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: 'universal-downloader-v1.0',
    hasUniversalDownloader: true,
    supportedPlatforms: ['youtube', 'tiktok', 'instagram', 'twitter', 'pinterest', 'facebook', 'linkedin', 'vimeo', 'dailymotion'],
    tiers: ['GetLoady (Stealth)', 'SSVid.net', 'Squidlr.com', 'Vercel Backend']
  });
});

// Universal download endpoint
app.post('/api/download', async (req, res) => {
  const startTime = Date.now();
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ 
      error: 'Missing URL parameter',
      message: 'Please provide a valid URL to download'
    });
  }

  // Validate URL format
  let validUrl;
  try {
    validUrl = new URL(url);
  } catch (e) {
    return res.status(400).json({ 
      error: 'Invalid URL format',
      message: 'Please provide a valid URL'
    });
  }

  console.log(`🚀 Universal download request: ${url}`);

  try {
    const downloader = await initializeDownloader();
    const result = await downloader.download(url);

    const processingTime = Date.now() - startTime;
    console.log(`✅ Download completed in ${processingTime}ms:`, result);

    if (result.success) {
      res.json({
        success: true,
        downloadUrl: result.downloadUrl,
        platform: result.platform,
        method: result.method,
        processingTime: processingTime,
        tier: getTierName(result.method),
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        platform: result.platform,
        processingTime: processingTime,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ Download failed in ${processingTime}ms:`, error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Download failed',
      processingTime: processingTime,
      timestamp: new Date().toISOString()
    });
  }
});

// Get platform info endpoint
app.get('/api/platforms', (req, res) => {
  res.json({
    supported: [
      { name: 'YouTube', id: 'youtube', tiers: ['GetLoady', 'SSVid.net', 'Vercel'] },
      { name: 'TikTok', id: 'tiktok', tiers: ['GetLoady', 'SSVid.net', 'Squidlr.com', 'Vercel'] },
      { name: 'Instagram', id: 'instagram', tiers: ['GetLoady', 'SSVid.net', 'Squidlr.com', 'Vercel'] },
      { name: 'Twitter/X', id: 'twitter', tiers: ['GetLoady', 'SSVid.net', 'Squidlr.com', 'Vercel'] },
      { name: 'Pinterest', id: 'pinterest', tiers: ['GetLoady', 'SSVid.net', 'Vercel'] },
      { name: 'Facebook', id: 'facebook', tiers: ['GetLoady', 'SSVid.net', 'Squidlr.com', 'Vercel'] },
      { name: 'LinkedIn', id: 'linkedin', tiers: ['GetLoady', 'SSVid.net', 'Squidlr.com', 'Vercel'] },
      { name: 'Vimeo', id: 'vimeo', tiers: ['SSVid.net', 'Vercel'] },
      { name: 'Dailymotion', id: 'dailymotion', tiers: ['SSVid.net', 'Vercel'] }
    ],
    tiers: [
      { name: 'Tier 1: GetLoady (Stealth)', description: 'Primary stealth browser automation' },
      { name: 'Tier 2: SSVid.net', description: 'Secondary browser automation' },
      { name: 'Tier 3: Squidlr.com', description: 'Tertiary browser automation (no YouTube)' },
      { name: 'Tier 4: Vercel Backend', description: 'Fallback API-based download' }
    ]
  });
});

// Helper function to get tier name
function getTierName(method) {
  if (method === 'intercepted' || method === 'dom_link' || method === 'popup_page') return 'Tier 1: GetLoady';
  if (method === 'ssvid' || method === 'ssvid_dom') return 'Tier 2: SSVid.net';
  if (method === 'squidlr' || method === 'squidlr_dom') return 'Tier 3: Squidlr.com';
  if (method === 'vercel_backend') return 'Tier 4: Vercel Backend';
  return 'Unknown';
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    availableEndpoints: ['/api/health', '/api/download', '/api/platforms']
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message 
  });
});

// Only start server if not in Vercel serverless environment
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const server = app.listen(PORT, () => {
    console.log(`🚀 Universal Social Media Downloader Backend running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🎯 Download endpoint: POST http://localhost:${PORT}/api/download`);
    console.log(`📋 Supported platforms: http://localhost:${PORT}/api/platforms`);
    console.log('');
    console.log('🔥 Features:');
    console.log('  • 4-Tier Fallback System');
    console.log('  • Stealth Browser Automation');
    console.log('  • Universal Platform Support');
    console.log('  • Rotating Proxy Support (configurable)');
    console.log('  • Rate Limiting & CORS Protection');
  });
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('🛑 Shutting down gracefully...');
    if (universalDownloader) {
      await universalDownloader.close();
    }
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
}

module.exports = app;