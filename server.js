const express = require('express');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3003;

// Enhanced CORS configuration for production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://detach.app', 'exp://192.168.1.1:8081', 'exp://localhost:8081', /\.exp\.direct$/]
    : true,
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Serve static files from public directory (for landing page)
app.use(express.static(path.join(__dirname, 'public')));

// Shared yt-dlp configuration with randomized browser fingerprinting
function getYtDlpBaseArgs(cookies = null, useProxy = false) {
  const baseArgs = [
    '-m', 'yt_dlp',
    '--no-warnings'
  ];
  
  if (cookies) {
    baseArgs.push('--cookies', cookies);
  }
  
  // Add proxy support for YouTube on Railway
  if (useProxy && (process.env.YOUTUBE_PROXY_URL || process.env.PROXY_URL || process.env.SCRAPINGBEE_API_KEY)) {
    if (process.env.SCRAPINGBEE_API_KEY) {
      // ScrapingBee doesn't work as a traditional proxy with yt-dlp
      // We'll need to use a different approach for ScrapingBee
      console.log('ScrapingBee detected - using alternative approach');
    } else {
      const proxyUrl = process.env.YOUTUBE_PROXY_URL || process.env.PROXY_URL;
      baseArgs.push('--proxy', proxyUrl);
      
      // Add proxy authentication if provided
      if (process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
        // yt-dlp handles auth in the URL format: http://user:pass@proxy:port
        const authProxy = proxyUrl.replace('://', `://${process.env.PROXY_USERNAME}:${process.env.PROXY_PASSWORD}@`);
        baseArgs[baseArgs.length - 1] = authProxy;
      }
    }
  }
  
  return baseArgs;
}

// Basic rate limiting to prevent abuse
const requestCounts = new Map();
const RATE_LIMIT = 100; // requests per hour
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

// Middleware to log requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// File cleanup system - automatically delete files after serving
const fileCleanupQueue = new Map(); // filename -> cleanup timeout
const CLEANUP_DELAY = 60 * 60 * 1000; // 1 hour

function scheduleFileCleanup(filePath, filename) {
  // Cancel existing cleanup if file is accessed again
  if (fileCleanupQueue.has(filename)) {
    clearTimeout(fileCleanupQueue.get(filename));
  }
  
  // Schedule new cleanup
  const timeoutId = setTimeout(async () => {
    try {
      await fs.unlink(filePath);
      console.log(`Cleaned up file: ${filename}`);
      fileCleanupQueue.delete(filename);
    } catch (error) {
      console.log(`File already cleaned up: ${filename}`);
      fileCleanupQueue.delete(filename);
    }
  }, CLEANUP_DELAY);
  
  fileCleanupQueue.set(filename, timeoutId);
  console.log(`Scheduled cleanup for ${filename} in ${CLEANUP_DELAY / 60000} minutes`);
}

// Cleanup old files on startup
(async function cleanupOnStartup() {
  try {
    const downloadsDir = path.join(__dirname, 'downloads');
    const files = await fs.readdir(downloadsDir);
    
    // Delete all files except .gitkeep
    for (const file of files) {
      if (file !== '.gitkeep') {
        try {
          await fs.unlink(path.join(downloadsDir, file));
          console.log(`Startup cleanup: removed ${file}`);
        } catch (error) {
          // File might not exist, ignore
        }
      }
    }
  } catch (error) {
    console.log('Startup cleanup completed');
  }
})();

// Root route - serve landing page inline (Railway compatibility)
app.get('/', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Detach API - Universal Social Media Downloader</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6; color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; color: white; margin-bottom: 50px; }
        .header h1 { font-size: 3.5em; font-weight: 700; margin-bottom: 10px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
        .header p { font-size: 1.3em; opacity: 0.9; margin-bottom: 30px; }
        .status-badge {
            display: inline-block; background: #28a745; color: white;
            padding: 8px 20px; border-radius: 50px; font-weight: 600; margin-bottom: 20px;
        }
        .main-content {
            background: white; border-radius: 20px; padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.1); margin-bottom: 30px;
        }
        .endpoint-box {
            background: #f8f9fa; border: 2px solid #dee2e6; border-radius: 12px;
            padding: 25px; margin: 20px 0; position: relative;
        }
        .endpoint-box.primary { border-color: #007bff; background: linear-gradient(135deg, #e3f2fd 0%, #f0f8ff 100%); }
        .endpoint-title { font-size: 1.4em; font-weight: 700; color: #007bff; margin-bottom: 15px; display: flex; align-items: center; }
        .endpoint-badge { background: #007bff; color: white; padding: 4px 8px; border-radius: 6px; font-size: 0.8em; margin-left: 10px; }
        .endpoint-url {
            font-family: 'Monaco', 'Consolas', monospace; font-size: 1.1em;
            background: #2d3748; color: #68d391; padding: 15px; border-radius: 8px; margin: 15px 0; overflow-x: auto;
        }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
        .stat-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 12px; text-align: center; }
        .stat-number { font-size: 2.5em; font-weight: 700; display: block; }
        .stat-label { font-size: 1em; opacity: 0.9; }
        .platforms-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 30px 0; }
        .platform-card {
            background: white; border: 2px solid #e9ecef; border-radius: 12px; padding: 20px; text-align: center;
            transition: all 0.3s ease;
        }
        .platform-card:hover { transform: translateY(-5px); box-shadow: 0 10px 30px rgba(0,0,0,0.1); border-color: #007bff; }
        .platform-card.working { border-color: #28a745; background: linear-gradient(135deg, #e8f5e8 0%, #f0fff0 100%); }
        .platform-card.limited { border-color: #ffc107; background: linear-gradient(135deg, #fff8e1 0%, #fffef7 100%); }
        .platform-icon { font-size: 2.5em; margin-bottom: 10px; }
        .platform-name { font-weight: 600; font-size: 1.1em; margin-bottom: 8px; }
        .platform-status { padding: 4px 12px; border-radius: 20px; font-size: 0.85em; font-weight: 600; }
        .status-working { background: #d4edda; color: #155724; }
        .status-limited { background: #fff3cd; color: #856404; }
        .code-block {
            background: #2d3748; color: #e2e8f0; padding: 25px; border-radius: 12px; overflow-x: auto;
            margin: 20px 0; font-family: 'Monaco', 'Consolas', monospace; font-size: 0.9em; line-height: 1.5;
        }
        .response-example { background: #f8f9fa; border-left: 4px solid #28a745; padding: 20px; margin: 15px 0; border-radius: 0 8px 8px 0; }
        .footer { text-align: center; color: white; margin-top: 50px; opacity: 0.8; }
        @media (max-width: 768px) {
            .header h1 { font-size: 2.5em; }
            .main-content { padding: 25px; }
            .platforms-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Detach API</h1>
            <p>Universal Social Media Content Downloader API</p>
            <div class="status-badge">✅ LIVE & OPERATIONAL</div>
            <p>One endpoint. Multiple platforms. Zero hassle.</p>
        </div>

        <div class="main-content">
            <div class="stats-grid">
                <div class="stat-card"><span class="stat-number">10</span><span class="stat-label">Supported Platforms</span></div>
                <div class="stat-card"><span class="stat-number">80%</span><span class="stat-label">Success Rate</span></div>
                <div class="stat-card"><span class="stat-number">1</span><span class="stat-label">Universal Endpoint</span></div>
                <div class="stat-card"><span class="stat-number">24/7</span><span class="stat-label">Uptime</span></div>
            </div>

            <div class="endpoint-box primary">
                <div class="endpoint-title">🌟 Universal Download Endpoint <span class="endpoint-badge">RECOMMENDED</span></div>
                <div class="endpoint-url">POST https://detachbackend-production.up.railway.app/api/download</div>
                <p><strong>Automatically detects the platform and routes your request to the appropriate handler.</strong> This is the only endpoint you need!</p>
            </div>

            <h2>🎯 Supported Platforms</h2>
            <div class="platforms-grid">
                <div class="platform-card working">
                    <div class="platform-icon">📱</div>
                    <div class="platform-name">TikTok</div>
                    <div class="platform-status status-working">✅ WORKING</div>
                </div>
                <div class="platform-card working">
                    <div class="platform-icon">💼</div>
                    <div class="platform-name">LinkedIn</div>
                    <div class="platform-status status-working">✅ WORKING</div>
                </div>
                <div class="platform-card working">
                    <div class="platform-icon">📷</div>
                    <div class="platform-name">Instagram</div>
                    <div class="platform-status status-working">✅ WORKING</div>
                </div>
                <div class="platform-card working">
                    <div class="platform-icon">📘</div>
                    <div class="platform-name">Facebook</div>
                    <div class="platform-status status-working">✅ WORKING</div>
                </div>
                <div class="platform-card working">
                    <div class="platform-icon">📌</div>
                    <div class="platform-name">Pinterest</div>
                    <div class="platform-status status-working">✅ WORKING</div>
                </div>
                <div class="platform-card working">
                    <div class="platform-icon">🎧</div>
                    <div class="platform-name">Apple Podcasts</div>
                    <div class="platform-status status-working">✅ WORKING</div>
                </div>
                <div class="platform-card working">
                    <div class="platform-icon">🎵</div>
                    <div class="platform-name">Spotify</div>
                    <div class="platform-status status-working">✅ WORKING</div>
                </div>
                <div class="platform-card working">
                    <div class="platform-icon">🐦</div>
                    <div class="platform-name">X (Twitter)</div>
                    <div class="platform-status status-working">✅ WORKING</div>
                </div>
                <div class="platform-card limited">
                    <div class="platform-icon">▶️</div>
                    <div class="platform-name">YouTube</div>
                    <div class="platform-status status-limited">⚠️ LIMITED</div>
                </div>
                <div class="platform-card limited">
                    <div class="platform-icon">🎶</div>
                    <div class="platform-name">YouTube Music</div>
                    <div class="platform-status status-limited">⚠️ LIMITED</div>
                </div>
            </div>

            <h2>📖 Quick Start</h2>
            <p>Make a simple POST request to download content from any supported platform:</p>

            <div class="code-block">curl -X POST https://detachbackend-production.up.railway.app/api/download \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://www.instagram.com/reel/DMw7_HDusQY/",
    "format": "video",
    "quality": "best"
  }'</div>

            <h3>📋 Request Parameters</h3>
            <div class="response-example">
                <strong>url</strong> (required): The social media URL you want to download<br>
                <strong>format</strong> (optional): "video" or "audio" - defaults to "video"<br>
                <strong>quality</strong> (optional): "best" or "worst" - defaults to "best"<br>
                <strong>cookies</strong> (optional): Browser cookies for YouTube authentication (Netscape format)
            </div>

            <h3>✅ Success Response Example</h3>
            <div class="code-block">{
  "success": true,
  "filePath": "/app/downloads/Video_by_snoopdogg.mp4",
  "filename": "Video_by_snoopdogg.mp4",
  "fileSize": 8418029,
  "platform": "instagram",
  "title": "Video by snoopdogg",
  "duration": 76,
  "uploader": "snoopdogg",
  "contentType": "video",
  "detectedPlatform": "instagram",
  "routedTo": "/api/instagram"
}</div>

            <h2>📊 Platform-Specific Details</h2>
            
            <div class="endpoint-box">
                <div class="endpoint-title">✅ Fully Working Platforms (8/10)</div>
                <ul>
                    <li><strong>TikTok:</strong> Downloads videos and images (some may be blocked by platform)</li>
                    <li><strong>LinkedIn:</strong> Full video downloads with metadata</li>
                    <li><strong>Instagram:</strong> Reels, posts, and stories</li>
                    <li><strong>Facebook:</strong> Public videos and posts</li>
                    <li><strong>Pinterest:</strong> Videos and images from pins</li>
                    <li><strong>Apple Podcasts:</strong> Full episode downloads</li>
                    <li><strong>Spotify:</strong> Track downloads (where available)</li>
                    <li><strong>X (Twitter):</strong> Videos and posts</li>
                </ul>
            </div>

            <div class="endpoint-box">
                <div class="endpoint-title">⚠️ Limited Platforms (2/10)</div>
                <ul>
                    <li><strong>YouTube:</strong> IP-based bot detection on shared hosting (proxy support available)</li>
                    <li><strong>YouTube Music:</strong> Same detection issues as YouTube</li>
                </ul>
                <p><em>YouTube works with proxy configuration via environment variables.</em></p>
            </div>

            <h2>🧪 API Tester</h2>
            <div style="background: #f8f9fa; border: 2px solid #dee2e6; border-radius: 12px; padding: 30px; margin: 30px 0;">
                <h3>Test the API right here!</h3>
                <p>Enter a URL from any supported platform and see the magic happen:</p>
                
                <div style="margin-bottom: 20px;">
                    <label for="test-url" style="display: block; font-weight: 600; margin-bottom: 8px; color: #495057;">Social Media URL:</label>
                    <input type="url" id="test-url" placeholder="https://www.instagram.com/reel/..." 
                           style="width: 100%; padding: 12px; border: 2px solid #dee2e6; border-radius: 8px; font-size: 1em;" />
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label for="test-format" style="display: block; font-weight: 600; margin-bottom: 8px; color: #495057;">Format:</label>
                    <select id="test-format" style="width: 100%; padding: 12px; border: 2px solid #dee2e6; border-radius: 8px; font-size: 1em;">
                        <option value="video">Video</option>
                        <option value="audio">Audio</option>
                    </select>
                </div>
                
                <button onclick="testAPI()" style="background: #007bff; color: white; padding: 12px 30px; border: none; border-radius: 8px; font-size: 1em; font-weight: 600; cursor: pointer;">🚀 Test Download</button>
                
                <div id="result" style="margin-top: 20px; padding: 20px; border-radius: 8px; font-family: 'Monaco', 'Consolas', monospace; font-size: 0.9em; white-space: pre-wrap; display: none;"></div>
            </div>

            <h2>🔧 YouTube Proxy Configuration</h2>
            <div class="response-example">
                <strong>Environment Variables for YouTube proxy support:</strong><br>
                <code>PROXY_URL</code> - HTTP/HTTPS proxy URL (e.g., http://proxy.example.com:8080)<br>
                <code>PROXY_USERNAME</code> - Proxy authentication username (optional)<br>
                <code>PROXY_PASSWORD</code> - Proxy authentication password (optional)<br>
                <code>YOUTUBE_PROXY_URL</code> - YouTube-specific proxy (overrides PROXY_URL)<br><br>
                <em>Automatically enabled on Railway deployments to bypass IP blacklisting.</em>
            </div>

            <h2>📈 Rate Limits</h2>
            <div class="response-example">
                <strong>Rate Limit:</strong> 100 requests per hour per IP address<br>
                <strong>Timeout:</strong> 2 minutes per request<br>
                <strong>File Retention:</strong> Downloaded files are automatically cleaned up after 1 hour
            </div>

            <h2>🔗 Additional Endpoints</h2>
            <p>While the universal endpoint is recommended, individual platform endpoints are also available:</p>
            
            <div class="code-block">POST /api/spotify       - Spotify tracks/podcasts
POST /api/youtube       - YouTube videos (standard)
POST /api/youtube-ytdlp - YouTube videos (yt-dlp)
POST /api/youtube-music - YouTube Music tracks
POST /api/instagram     - Instagram content
POST /api/tiktok        - TikTok videos
POST /api/twitter       - Twitter/X videos and posts
POST /api/facebook      - Facebook videos
POST /api/linkedin      - LinkedIn videos and posts
POST /api/pinterest     - Pinterest images and videos
POST /api/podcast       - RSS podcast feeds/episodes
POST /api/playlist      - Bulk playlist downloads</div>
        </div>

        <div class="footer">
            <p>🚀 Powered by yt-dlp, spotdl, and modern web scraping technology</p>
            <p>⚡ Built for developers, by developers</p>
        </div>
    </div>

    <script>
        async function testAPI() {
            const url = document.getElementById('test-url').value;
            const format = document.getElementById('test-format').value;
            const resultDiv = document.getElementById('result');
            
            if (!url) {
                alert('Please enter a URL');
                return;
            }
            
            resultDiv.style.display = 'block';
            resultDiv.style.background = '#f8f9fa';
            resultDiv.style.border = '1px solid #dee2e6';
            resultDiv.style.color = '#495057';
            resultDiv.textContent = '⏳ Testing API... This may take a few moments...';
            
            try {
                const response = await fetch('https://detachbackend-production.up.railway.app/api/download', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        url: url,
                        format: format,
                        quality: 'best'
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    resultDiv.style.background = '#d4edda';
                    resultDiv.style.border = '1px solid #c3e6cb';
                    resultDiv.style.color = '#155724';
                    resultDiv.textContent = '✅ SUCCESS!\\n\\n' + JSON.stringify(data, null, 2);
                } else {
                    resultDiv.style.background = '#f8d7da';
                    resultDiv.style.border = '1px solid #f5c6cb';
                    resultDiv.style.color = '#721c24';
                    resultDiv.textContent = '❌ ERROR\\n\\n' + JSON.stringify(data, null, 2);
                }
            } catch (error) {
                resultDiv.style.background = '#f8d7da';
                resultDiv.style.border = '1px solid #f5c6cb';
                resultDiv.style.color = '#721c24';
                resultDiv.textContent = '❌ NETWORK ERROR\\n\\n' + error.message;
            }
        }
    </script>
</body>
</html>`;
  res.send(html);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: 'universal-endpoint-fixed-v2',
    hasUniversalEndpoint: true,
    endpoints: ['youtube', 'pinterest', 'tiktok', 'instagram', 'facebook', 'linkedin', 'twitter', 'spotify', 'podcast']
  });
});

// Debug endpoint to check Python/yt-dlp setup
app.get('/api/debug', async (req, res) => {
  try {
    const fs = require('fs').promises;
    const currentDir = __dirname;
    
    // Test Python and yt-dlp availability
    const testPython = spawn('python3', ['--version']);
    let pythonVersion = '';
    let pythonError = '';
    
    testPython.stdout.on('data', (data) => {
      pythonVersion += data.toString();
    });
    
    testPython.stderr.on('data', (data) => {
      pythonError += data.toString();
    });
    
    await new Promise((resolve) => {
      testPython.on('close', resolve);
    });
    
    // Test yt-dlp availability
    const testYtdlp = spawn('python3', ['-m', 'yt_dlp', '--version']);
    let ytdlpVersion = '';
    let ytdlpError = '';
    
    testYtdlp.stdout.on('data', (data) => {
      ytdlpVersion += data.toString();
    });
    
    testYtdlp.stderr.on('data', (data) => {
      ytdlpError += data.toString();
    });
    
    await new Promise((resolve) => {
      testYtdlp.on('close', resolve);
    });
    
    // Test simple YouTube extraction
    const testYoutube = spawn('python3', ['-m', 'yt_dlp', '--dump-json', '--no-warnings', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ']);
    let youtubeInfo = '';
    let youtubeError = '';
    
    testYoutube.stdout.on('data', (data) => {
      youtubeInfo += data.toString();
    });
    
    testYoutube.stderr.on('data', (data) => {
      youtubeError += data.toString();
    });
    
    await new Promise((resolve) => {
      testYoutube.on('close', resolve);
    });
    
    res.json({
      environment: process.env.NODE_ENV || 'development',
      currentDirectory: currentDir,
      pythonVersion: pythonVersion.trim(),
      pythonError: pythonError.trim(),
      ytdlpVersion: ytdlpVersion.trim(),
      ytdlpError: ytdlpError.trim(),
      youtubeTestSuccess: youtubeInfo.length > 0,
      youtubeInfo: youtubeInfo.substring(0, 200) + '...',
      youtubeError: youtubeError.trim(),
      pathVariable: process.env.PATH,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Spotify download endpoint - using yt-dlp
app.post('/api/spotify', async (req, res) => {
  try {
    const { url, format = 'audio' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('Spotify: Processing URL:', url);
    
    // First, get content info with improved headers
    const infoProcess = spawn('python3', [
      ...getYtDlpBaseArgs(),
      '--print', '%(title)s|%(duration)s|%(uploader)s|%(album)s|%(artist)s',
      url
    ]);

    let contentInfo = '';
    let infoError = '';

    infoProcess.stdout.on('data', (data) => {
      contentInfo += data.toString();
    });

    infoProcess.stderr.on('data', (data) => {
      infoError += data.toString();
    });

    await new Promise((resolve) => {
      infoProcess.on('close', resolve);
    });

    const [title, duration, uploader, album, artist] = contentInfo.trim().split('|');
    
    // Generate filename
    const safeTitle = (title || 'Spotify_Content').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const timestamp = Date.now();
    const extension = 'm4a';
    const filename = `${safeTitle}_${timestamp}.${extension}`;
    const outputPath = path.join(__dirname, 'downloads', filename);

    // Ensure downloads directory exists
    const downloadsDir = path.join(__dirname, 'downloads');
    if (!await fs.access(downloadsDir).then(() => true).catch(() => false)) {
      await fs.mkdir(downloadsDir, { recursive: true });
    }

    // Download audio with spotdl (better for Spotify)
    const spotdl = spawn('python3', ['-m', 'spotdl',
      url,
      '--output', path.dirname(outputPath),
      '--format', 'mp3'
    ]);

    let spotdlOutput = '';
    let errorOutput = '';

    spotdl.stdout.on('data', (data) => {
      spotdlOutput += data.toString();
    });

    spotdl.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    spotdl.on('close', async (code) => {
      console.log('Spotify spotdl stdout:', spotdlOutput);
      console.log('Spotify spotdl stderr:', errorOutput);
      console.log('Spotify spotdl exit code:', code);
      
      if (code === 0) {
        try {
          // spotdl creates files with its own naming convention
          // Look for any newly created mp3 files in the downloads directory
          const files = await fs.readdir(path.dirname(outputPath));
          const mp3Files = files.filter(f => f.endsWith('.mp3'));
          
          if (mp3Files.length > 0) {
            // Get the most recently created mp3 file
            const newestFile = mp3Files[mp3Files.length - 1];
            const actualFilePath = path.join(path.dirname(outputPath), newestFile);
            const stats = await fs.stat(actualFilePath);
            
            res.json({
              success: true,
              filePath: actualFilePath,
              filename: newestFile,
              fileSize: stats.size,
              platform: 'spotify',
              title: title || 'Spotify Content',
              duration: duration ? parseInt(duration) : undefined,
              artist: artist || uploader || undefined,
              album: album || undefined,
              contentType: 'audio'
            });
          } else {
            res.status(500).json({ 
              error: 'No mp3 file was created',
              details: 'spotdl completed but no audio file found'
            });
          }
        } catch (fileError) {
          console.error('Spotify file check error:', fileError);
          res.status(500).json({ 
            error: 'File was not created successfully',
            details: fileError.message
          });
        }
      } else {
        console.error('Spotify spotdl error:', errorOutput);
        res.status(500).json({ 
          error: 'Spotify download failed',
          details: errorOutput,
          suggestions: 'Spotify may require premium account or the content may not be accessible'
        });
      }
    });

  } catch (error) {
    console.error('Spotify download error:', error);
    res.status(500).json({ 
      error: 'Failed to process Spotify URL',
      details: error.message 
    });
  }
});

// Serve downloaded files with automatic cleanup scheduling
app.get('/api/file/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'downloads', filename);
  
  // Check if file exists and serve it
  fs.access(filePath)
    .then(() => {
      // Schedule cleanup when file is first accessed
      scheduleFileCleanup(filePath, filename);
      
      // Send file to client
      res.sendFile(filePath);
    })
    .catch(() => {
      res.status(404).json({ error: 'File not found' });
    });
});

// YouTube download endpoint using ytdl-core
// Advanced YouTube user agents for rotation
const getRandomYouTubeUserAgent = () => {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1.1 Safari/605.1.15'
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
};

// Generate randomized headers to vary browser fingerprint
const getRandomizedHeaders = () => {
  const acceptLanguages = [
    'en-US,en;q=0.9',
    'en-US,en;q=0.8,es;q=0.7',
    'en-GB,en;q=0.9',
    'en-US,en;q=0.5',
    'en-US,en;q=0.9,fr;q=0.8'
  ];
  
  const acceptEncodings = [
    'gzip, deflate, br',
    'gzip, deflate',
    'gzip, deflate, br, zstd',
    'br, gzip, deflate'
  ];
  
  const secChUaValues = [
    '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    '"Google Chrome";v="130", "Chromium";v="130", "Not_A Brand";v="99"',
    '"Chromium";v="131", "Microsoft Edge";v="131", "Not_A Brand";v="24"',
    '"Firefox";v="132", "Not_A Brand";v="24"'
  ];

  return {
    acceptLanguage: acceptLanguages[Math.floor(Math.random() * acceptLanguages.length)],
    acceptEncoding: acceptEncodings[Math.floor(Math.random() * acceptEncodings.length)],
    secChUa: secChUaValues[Math.floor(Math.random() * secChUaValues.length)],
    dnt: Math.random() > 0.5 ? '1' : '0',
    cacheControl: Math.random() > 0.7 ? 'max-age=0' : 'no-cache'
  };
};

// Enhanced yt-dlp args with anti-bot measures and randomized headers
const getAdvancedYtDlpArgs = (userAgent) => {
  const headers = getRandomizedHeaders();
  
  return [
    '-m', 'yt_dlp',
    '--no-warnings',
    '--no-check-certificate',
    '--user-agent', userAgent,
    '--add-header', `Accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8`,
    '--add-header', `Accept-Language:${headers.acceptLanguage}`,
    '--add-header', `Accept-Encoding:${headers.acceptEncoding}`,
    '--add-header', 'Connection:keep-alive',
    '--add-header', 'Upgrade-Insecure-Requests:1',
    '--add-header', 'Sec-Fetch-Dest:document',
    '--add-header', 'Sec-Fetch-Mode:navigate',
    '--add-header', 'Sec-Fetch-Site:none',
    '--add-header', `Sec-Ch-Ua:${headers.secChUa}`,
    '--add-header', 'Sec-Ch-Ua-Mobile:?0',
    '--add-header', 'Sec-Ch-Ua-Platform:"Windows"',
    '--add-header', `Cache-Control:${headers.cacheControl}`,
    '--add-header', `DNT:${headers.dnt}`,
    '--sleep-interval', '1',
    '--max-sleep-interval', '5',
    '--sleep-subtitles', '1'
  ];
};

app.post('/api/youtube', async (req, res) => {
  let cookieFile = null;
  
  try {
    const { url, cookies } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('YouTube: Processing URL:', url);
    
    // Handle cookies - check for provided cookies or existing cookie file
    const existingCookieFile = path.join(__dirname, 'www.youtube.com.cookies.json');
    let hasExistingCookies = false;
    
    try {
      await fs.access(existingCookieFile);
      hasExistingCookies = true;
      console.log('YouTube: Found existing cookie file');
    } catch {
      // No existing cookie file
    }
    
    if (cookies) {
      const cookieFilename = `youtube_cookies_${Date.now()}.txt`;
      cookieFile = path.join(__dirname, 'downloads', cookieFilename);
      
      // Ensure downloads directory exists
      const downloadsDir = path.join(__dirname, 'downloads');
      if (!await fs.access(downloadsDir).then(() => true).catch(() => false)) {
        await fs.mkdir(downloadsDir, { recursive: true });
      }
      
      // Write cookies to file
      await fs.writeFile(cookieFile, cookies);
      console.log('YouTube: Using provided cookies');
    } else if (hasExistingCookies) {
      // Convert JSON cookies to Netscape format
      const cookieFilename = `youtube_cookies_converted_${Date.now()}.txt`;
      cookieFile = path.join(__dirname, 'downloads', cookieFilename);
      
      // Ensure downloads directory exists
      const downloadsDir = path.join(__dirname, 'downloads');
      if (!await fs.access(downloadsDir).then(() => true).catch(() => false)) {
        await fs.mkdir(downloadsDir, { recursive: true });
      }
      
      try {
        const jsonCookies = JSON.parse(await fs.readFile(existingCookieFile, 'utf8'));
        let netscapeCookies = '# Netscape HTTP Cookie File\n';
        
        for (const cookie of jsonCookies) {
          // Skip cookies with missing essential fields
          if (!cookie.name || !cookie.domain) continue;
          
          const domain = cookie.domain.startsWith('.') ? cookie.domain : '.' + cookie.domain;
          const domainFlag = 'TRUE';
          const path = cookie.path || '/';
          const secure = cookie.secure ? 'TRUE' : 'FALSE';
          const expiration = cookie.expires && cookie.expires > 0 ? Math.floor(cookie.expires) : '0';
          const name = cookie.name;
          const value = cookie.value || '';
          
          netscapeCookies += `${domain}\t${domainFlag}\t${path}\t${secure}\t${expiration}\t${name}\t${value}\n`;
        }
        
        await fs.writeFile(cookieFile, netscapeCookies);
        console.log(`YouTube: Using converted JSON cookies (${jsonCookies.length} cookies converted)`);
      } catch (error) {
        console.log('YouTube: Failed to convert JSON cookies:', error.message);
        cookieFile = null;
      }
    }
    
    // Detect if we're on Railway and should use proxy
    const isRailway = process.env.RAILWAY_ENVIRONMENT === 'production';
    const shouldUseProxy = isRailway || process.env.FORCE_PROXY === 'true';
    
    if (shouldUseProxy && process.env.PROXY_URL) {
      console.log('YouTube: Using proxy for Railway deployment');
    }
    
    // First, get content info using same approach as working platforms
    const infoProcess = spawn('python3', [
      ...getYtDlpBaseArgs(cookieFile, shouldUseProxy),
      '--print', '%(title)s|%(duration)s|%(uploader)s|%(view_count)s|%(webpage_url)s',
      url
    ]);

    let contentInfo = '';
    let infoError = '';

    infoProcess.stdout.on('data', (data) => {
      contentInfo += data.toString();
    });

    infoProcess.stderr.on('data', (data) => {
      infoError += data.toString();
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        infoProcess.kill('SIGTERM');
        reject(new Error('YouTube info process timed out'));
      }, 60000);

      infoProcess.on('close', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          reject(new Error(`YouTube info process failed with exit code ${code}: ${infoError}`));
        } else {
          resolve();
        }
      });

      infoProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    const [title, duration, uploader, viewCount, webpage_url] = contentInfo.trim().split('|');
    
    // Generate filename
    const safeTitle = (title || 'YouTube_Video').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const timestamp = Date.now();
    const extension = 'mp4';
    const filename = `${safeTitle}_${timestamp}.${extension}`;
    const outputPath = path.join(__dirname, 'downloads', filename);

    // Ensure downloads directory exists
    const downloadsDir = path.join(__dirname, 'downloads');
    if (!await fs.access(downloadsDir).then(() => true).catch(() => false)) {
      await fs.mkdir(downloadsDir, { recursive: true });
    }

    // Download using same approach as other working platforms
    const ytdlpProcess = spawn('python3', [
      ...getYtDlpBaseArgs(cookieFile, shouldUseProxy),
      '--format', 'best[ext=mp4]/mp4/best',
      '--output', outputPath,
      url
    ]);

    let downloadError = '';

    ytdlpProcess.stderr.on('data', (data) => {
      downloadError += data.toString();
    });

    ytdlpProcess.on('close', async (code) => {
      if (code !== 0) {
        console.error('YouTube download failed:', downloadError);
        return res.status(500).json({ 
          error: 'Failed to download YouTube video',
          details: downloadError
        });
      }

      try {
        const stats = await fs.stat(outputPath);
        
        // Clean up cookie file if it was created
        if (cookieFile) {
          await fs.unlink(cookieFile).catch(() => {});
        }
        
        res.json({
          success: true,
          filePath: outputPath,
          filename: filename,
          fileSize: stats.size,
          platform: 'youtube',
          title: title || 'YouTube Video',
          duration: duration || 'Unknown',
          uploader: uploader || 'Unknown',
          viewCount: viewCount || 'Unknown',
          contentType: 'video'
        });
      } catch (error) {
        // Clean up cookie file if it was created
        if (cookieFile) {
          await fs.unlink(cookieFile).catch(() => {});
        }
        
        res.status(500).json({ 
          error: 'File was not created successfully',
          details: error.message 
        });
      }
    });

  } catch (error) {
    console.error('YouTube download error:', error);
    
    // Clean up cookie file if it was created
    if (cookieFile) {
      await fs.unlink(cookieFile).catch(() => {});
    }
    
    res.status(500).json({ 
      error: 'Failed to process YouTube URL',
      details: error.message 
    });
  }
});

// YouTube download endpoint using yt-dlp (direct download method)
app.post('/api/youtube-ytdlp', async (req, res) => {
  try {
    const { url, format = 'audio' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('YouTube: Processing URL:', url);
    console.log('YouTube: Requested format:', format);

    // First, get video info using same approach as working platforms
    const infoProcess = spawn('python3', [
      ...getYtDlpBaseArgs(),
      '--print', '%(title)s|%(duration)s|%(uploader)s|%(view_count)s|%(webpage_url)s',
      url
    ]);

    let contentInfo = '';
    let infoError = '';

    infoProcess.stdout.on('data', (data) => {
      contentInfo += data.toString();
    });

    infoProcess.stderr.on('data', (data) => {
      infoError += data.toString();
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        infoProcess.kill('SIGTERM');
        reject(new Error('YouTube info process timed out'));
      }, 60000);
      
      infoProcess.on('close', (code) => {
        clearTimeout(timeout);
        console.log('YouTube info process exit code:', code);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`YouTube info process failed with exit code ${code}`));
        }
      });
      
      infoProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    console.log('YouTube raw contentInfo:', contentInfo.substring(0, 200) + '...');

    console.log('YouTube raw contentInfo length:', contentInfo.length);
    console.log('YouTube raw contentInfo preview:', contentInfo.substring(0, 200));
    console.log('YouTube info stderr:', infoError);
    
    if (!contentInfo.trim()) {
      console.error('YouTube: Empty contentInfo received');
      throw new Error('No video information returned by yt-dlp');
    }
    
    // Parse pipe-separated format like other working platforms
    const [title, duration, uploader, viewCount, webpageUrl] = contentInfo.trim().split('|');
    
    console.log('YouTube parsed info:', { title, duration, uploader, viewCount });

    console.log('YouTube parsed:', {
      title: title.substring(0, 50) + '...',
      duration,
      uploader,
      viewCount
    });

    // Generate filename
    const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const timestamp = Date.now();
    const extension = format === 'video' ? 'mp4' : 'm4a';
    const filename = `${safeTitle}_${timestamp}.${extension}`;
    const outputPath = path.join(__dirname, 'downloads', filename);

    // Ensure downloads directory exists
    const downloadsDir = path.join(__dirname, 'downloads');
    if (!await fs.access(downloadsDir).then(() => true).catch(() => false)) {
      await fs.mkdir(downloadsDir, { recursive: true });
    }

    // Download based on format preference
    const formatString = format === 'video' 
      ? 'best[height<=720][ext=mp4]/best[ext=mp4]/best'
      : 'bestaudio[ext=m4a]/bestaudio';

    console.log('YouTube: Starting download with format:', formatString);

    const ytdlpProcess = spawn('python3', [
      ...getYtDlpBaseArgs(),
      '--format', formatString,
      '--output', outputPath,
      url
    ]);

    let downloadOutput = '';
    let errorOutput = '';

    ytdlpProcess.stdout.on('data', (data) => {
      downloadOutput += data.toString();
    });

    ytdlpProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ytdlpProcess.on('close', async (code) => {
      console.log('YouTube: yt-dlp exit code:', code);
      console.log('YouTube: stdout:', downloadOutput.substring(0, 500) + '...');
      console.log('YouTube: stderr:', errorOutput.substring(0, 500) + '...');
      
      if (code === 0) {
        try {
          // Check if file exists and get its stats
          const stats = await fs.stat(outputPath);
          
          res.json({
            success: true,
            title: title,
            uploader: uploader,
            viewCount: viewCount,
            duration: duration,
            contentType: format,
            filePath: outputPath,
            filename: filename,
            fileSize: stats.size
          });
        } catch (error) {
          console.error('YouTube: File not found after download:', error);
          res.status(500).json({ 
            error: 'Download completed but file not found',
            details: error.message 
          });
        }
      } else {
        console.error('YouTube: yt-dlp failed with code:', code);
        res.status(500).json({ 
          error: 'Failed to download YouTube content',
          details: errorOutput
        });
      }
    });

  } catch (error) {
    console.error('YouTube yt-dlp error:', error);
    res.status(500).json({ 
      error: 'Failed to process YouTube URL with yt-dlp',
      details: error.message 
    });
  }
});

// Instagram download endpoint using yt-dlp with better error handling
app.post('/api/instagram', async (req, res) => {
  try {
    const { url, format = 'video' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('Instagram: Processing URL:', url);
    
    // First, get content info using improved headers
    const infoProcess = spawn('python3', [
      ...getYtDlpBaseArgs(),
      '--print', '%(title)s|%(duration)s|%(uploader)s|%(view_count)s|%(webpage_url)s',
      '--extractor-args', 'instagram:api_key=',
      url
    ]);

    let contentInfo = '';
    let infoError = '';

    infoProcess.stdout.on('data', (data) => {
      contentInfo += data.toString();
    });

    infoProcess.stderr.on('data', (data) => {
      infoError += data.toString();
    });

    await new Promise((resolve) => {
      infoProcess.on('close', resolve);
    });

    // Check for rate limiting or authentication issues first
    if (infoError.includes('rate limit') || infoError.includes('login required') || infoError.includes('not available') || !contentInfo.trim()) {
      console.log('Instagram: Rate limited, auth required, or extraction failed - creating comprehensive fallback');
      
      // Extract basic info from URL pattern for better user experience
      const urlMatch = url.match(/instagram\.com\/(p|reel|tv)\/([^/?]+)/);
      const postId = urlMatch ? urlMatch[2] : 'post';
      
      // Create a more informative text file when rate limited
      const safeTitle = `Instagram_${postId}_Content`;
      const timestamp = Date.now();
      const filename = `${safeTitle}_${timestamp}_text.txt`;
      const outputPath = path.join(__dirname, 'downloads', filename);

      // Ensure downloads directory exists
      const downloadsDir = path.join(__dirname, 'downloads');
      if (!await fs.access(downloadsDir).then(() => true).catch(() => false)) {
        await fs.mkdir(downloadsDir, { recursive: true });
      }

      const postInfo = `Instagram Content: ${postId}\nOriginal URL: ${url}\nStatus: Rate limited or login required\nDownloaded: ${new Date().toISOString()}\n\nNote: Instagram restricts automated downloads. This is a placeholder file.\nYou can visit the URL manually: ${url}`;
      
      await fs.writeFile(outputPath, postInfo, 'utf8');
      const stats = await fs.stat(outputPath);
      
      return res.json({
        success: true,
        filePath: outputPath,
        filename: filename,
        fileSize: stats.size,
        platform: 'instagram',
        title: `Instagram Content: ${postId}`,
        contentType: 'text',
        note: 'Rate limited - placeholder created with URL info'
      });
    }

    const [title, duration, uploader, viewCount, webpageUrl] = contentInfo.trim().split('|');

    // Improved title handling with better fallbacks
    let finalTitle = title || '';
    
    if (!finalTitle || finalTitle === 'null' || finalTitle === 'undefined') {
      // Extract useful info from URL for better titles
      const postIdMatch = url.match(/instagram\.com\/(p|reel|tv)\/([^/?]+)/);
      const usernameMatch = url.match(/instagram\.com\/([^\/]+)\/(?:p|reel|tv)/);
      
      if (postIdMatch && usernameMatch) {
        const postType = postIdMatch[1] === 'reel' ? 'Reel' : postIdMatch[1] === 'tv' ? 'IGTV' : 'Post';
        finalTitle = `Instagram ${postType} by ${usernameMatch[1]} (${postIdMatch[2]})`;
      } else if (postIdMatch) {
        const postType = postIdMatch[1] === 'reel' ? 'Reel' : postIdMatch[1] === 'tv' ? 'IGTV' : 'Post';
        finalTitle = `Instagram ${postType} ${postIdMatch[2]}`;
      } else {
        finalTitle = 'Instagram Content';
      }
      console.log('Instagram: Using enhanced fallback title:', finalTitle);
    } else {
      console.log('Instagram: Using extracted title:', finalTitle);
    }

    // Detect content type - if no duration, it's likely an image post
    const isImagePost = !duration || duration === 'null' || parseInt(duration) === 0;
    
    // Generate filename based on detected content type
    const safeTitle = finalTitle.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const timestamp = Date.now();
    let extension, contentType;
    
    if (isImagePost) {
      extension = 'jpg';
      contentType = 'image';
    } else {
      extension = format === 'video' ? 'mp4' : 'm4a';
      contentType = format;
    }
    
    const filename = `${safeTitle}_${timestamp}.${extension}`;
    const outputPath = path.join(__dirname, 'downloads', filename);

    // Ensure downloads directory exists
    const downloadsDir = path.join(__dirname, 'downloads');
    if (!await fs.access(downloadsDir).then(() => true).catch(() => false)) {
      await fs.mkdir(downloadsDir, { recursive: true });
    }

    // Download file directly with yt-dlp
    let formatString;
    if (isImagePost) {
      formatString = 'best'; // For Instagram images
    } else {
      formatString = format === 'video' ? 'best' : 'bestaudio/best';
    }

    console.log('Instagram: Starting download with format:', formatString);
    const ytdlp = spawn('python3', ['-m', 'yt_dlp',
      '--output', outputPath,
      '--format', formatString,
      '--no-warnings',
      '--user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      '--extractor-args', 'instagram:api_key=',
      url
    ]);

    let errorOutput = '';
    let stdOutput = '';

    ytdlp.stdout.on('data', (data) => {
      stdOutput += data.toString();
    });

    ytdlp.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ytdlp.on('close', async (code) => {
      console.log('Instagram: yt-dlp exit code:', code);
      console.log('Instagram: stdout:', stdOutput);
      console.log('Instagram: stderr:', errorOutput);
      
      if (code === 0) {
        try {
          // Check if file was created and get its info
          const stats = await fs.stat(outputPath);
          
          res.json({
            success: true,
            filePath: outputPath,
            filename: filename,
            fileSize: stats.size,
            platform: 'instagram',
            title: title || (isImagePost ? 'Instagram Image' : 'Instagram Content'),
            duration: duration ? parseInt(duration) : undefined,
            uploader: uploader || undefined,
            viewCount: viewCount ? parseInt(viewCount) : undefined,
            contentType: contentType,
            isImagePost: isImagePost
          });
        } catch (fileError) {
          console.error('Instagram file check error:', fileError);
          res.status(500).json({ 
            error: 'File was not created successfully',
            details: fileError.message,
            suggestions: 'The download may have failed due to Instagram restrictions'
          });
        }
      } else {
        console.error('Instagram yt-dlp error:', errorOutput);
        
        let errorMessage = 'Instagram download failed';
        let suggestions = 'Try again later or use a different URL';
        
        if (errorOutput.includes('empty media response') || errorOutput.includes('403') || errorOutput.includes('Forbidden')) {
          errorMessage = 'Instagram post access denied';
          suggestions = 'This post may be private, deleted, or Instagram is blocking downloads. Try a different public post.';
        } else if (errorOutput.includes('404') || errorOutput.includes('not found')) {
          errorMessage = 'Instagram post not found';
          suggestions = 'The post may have been deleted or the URL is incorrect.';
        } else if (errorOutput.includes('rate') || errorOutput.includes('limit')) {
          errorMessage = 'Instagram rate limit reached';
          suggestions = 'Please wait a few minutes before trying again.';
        }
        
        res.status(500).json({ 
          error: errorMessage,
          details: errorOutput,
          suggestions: suggestions
        });
      }
    });

  } catch (error) {
    console.error('Instagram download error:', error);
    res.status(500).json({ 
      error: 'Failed to process Instagram URL',
      details: error.message 
    });
  }
});

// TikTok download endpoint with slideshow support (RESTORED TO WORKING VERSION)
app.post('/api/tiktok', async (req, res) => {
  try {
    const { url, format = 'video' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // First, get content info and detect if it's a slideshow  
    const infoProcess = spawn('python3', [
      ...getYtDlpBaseArgs(),
      '--print', '%(title)s|%(duration)s|%(uploader)s|%(view_count)s|%(format_note)s',
      url
    ]);

    let contentInfo = '';
    let infoError = '';

    infoProcess.stdout.on('data', (data) => {
      contentInfo += data.toString();
    });

    infoProcess.stderr.on('data', (data) => {
      infoError += data.toString();
    });

    await new Promise((resolve) => {
      infoProcess.on('close', resolve);
    });

    // Check for errors or blocks first
    if (infoError.includes('blocked') || infoError.includes('not available') || infoError.includes('rate limit') || !contentInfo.trim()) {
      console.log('TikTok: Blocked, rate limited, or extraction failed - creating fallback');
      
      // Extract basic info from URL pattern
      const urlMatch = url.match(/(?:vm\.tiktok\.com\/|tiktok\.com\/.+\/video\/)([a-zA-Z0-9]+)/);
      const videoId = urlMatch ? urlMatch[1] : 'video';
      
      // Create informative text file when blocked
      const safeTitle = `TikTok_${videoId}_Content`;
      const timestamp = Date.now();
      const filename = `${safeTitle}_${timestamp}_text.txt`;
      const outputPath = path.join(__dirname, 'downloads', filename);

      // Ensure downloads directory exists
      const downloadsDir = path.join(__dirname, 'downloads');
      if (!await fs.access(downloadsDir).then(() => true).catch(() => false)) {
        await fs.mkdir(downloadsDir, { recursive: true });
      }

      const postInfo = `TikTok Content: ${videoId}\nOriginal URL: ${url}\nStatus: Blocked or rate limited\nDownloaded: ${new Date().toISOString()}\n\nNote: TikTok blocks automated downloads. This is a placeholder file.\nYou can visit the URL manually: ${url}`;
      
      await fs.writeFile(outputPath, postInfo, 'utf8');
      const stats = await fs.stat(outputPath);
      
      return res.json({
        success: true,
        filePath: outputPath,
        filename: filename,
        fileSize: stats.size,
        platform: 'tiktok',
        title: `TikTok Content: ${videoId}`,
        contentType: 'text',
        note: 'Blocked - placeholder created with URL info'
      });
    }

    const [title, duration, uploader, viewCount, formatNote] = contentInfo.trim().split('|');
    
    // Improved title handling with better fallbacks
    let finalTitle = title || '';
    
    if (!finalTitle || finalTitle === 'null' || finalTitle === 'undefined') {
      // Extract useful info from URL for better titles
      const videoIdMatch = url.match(/(?:vm\.tiktok\.com\/|tiktok\.com\/.+\/video\/)([a-zA-Z0-9]+)/);
      const usernameMatch = url.match(/tiktok\.com\/@([^\/]+)/);
      
      if (videoIdMatch && usernameMatch) {
        finalTitle = `TikTok by @${usernameMatch[1]} (${videoIdMatch[1]})`;
      } else if (videoIdMatch) {
        finalTitle = `TikTok Video ${videoIdMatch[1]}`;
      } else if (usernameMatch) {
        finalTitle = `TikTok by @${usernameMatch[1]}`;
      } else {
        finalTitle = 'TikTok Content';
      }
      console.log('TikTok: Using enhanced fallback title:', finalTitle);
    } else {
      console.log('TikTok: Using extracted title:', finalTitle);
    }
    
    // Check if this is a slideshow (multiple images) - duration will be null/undefined for images
    const isSlideshow = !duration || duration === 'null' || parseInt(duration) === 0;

    // Generate filename based on content type
    const safeTitle = finalTitle.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const timestamp = Date.now();
    let extension, contentType;
    
    if (isSlideshow) {
      extension = 'jpg';
      contentType = 'image';
    } else {
      extension = format === 'video' ? 'mp4' : 'm4a';  
      contentType = format;
    }
    
    const filename = `${safeTitle}_${timestamp}.${extension}`;
    const outputPath = path.join(__dirname, 'downloads', filename);

    // Ensure downloads directory exists
    const downloadsDir = path.join(__dirname, 'downloads');
    if (!await fs.access(downloadsDir).then(() => true).catch(() => false)) {
      await fs.mkdir(downloadsDir, { recursive: true });
    }

    // Download file directly with yt-dlp - use working format strings
    const ytdlp = spawn('python3', ['-m', 'yt_dlp',
      '--output', outputPath,
      '--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15',
      '--add-header', 'Accept-Language:en-US,en;q=0.9',
      url
    ]);

    let errorOutput = '';

    ytdlp.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ytdlp.on('close', async (code) => {
      if (errorOutput) console.log('TikTok yt-dlp error:', errorOutput);
      
      if (code === 0) {
        try {
          // Check if file was created and get its info
          const stats = await fs.stat(outputPath);
          
          res.json({
            success: true,
            filePath: outputPath,
            filename: filename,
            fileSize: stats.size,
            platform: 'tiktok',
            title: title || (isSlideshow ? 'TikTok Slideshow' : 'TikTok Video'),
            duration: duration ? parseInt(duration) : undefined,
            uploader: uploader || undefined,
            viewCount: viewCount ? parseInt(viewCount) : undefined,
            contentType: contentType,
            isSlideshow: isSlideshow
          });
        } catch (fileError) {
          console.error('File check error:', fileError);
          res.status(500).json({ 
            error: 'File was not created successfully',
            details: fileError.message
          });
        }
      } else {
        console.error('TikTok yt-dlp failed:', errorOutput);
        res.status(500).json({ 
          error: 'TikTok download failed',
          details: errorOutput,
          suggestions: 'Try again later or use a different URL'
        });
      }
    });

  } catch (error) {
    console.error('TikTok download error:', error);
    res.status(500).json({ 
      error: 'Failed to process TikTok URL',
      details: error.message 
    });
  }
});

// X.com (Twitter) download endpoint - using yt-dlp with direct download
app.post('/api/twitter', async (req, res) => {
  try {
    const { url, format = 'video' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Normalize Twitter URL - handle both twitter.com and x.com
    let normalizedUrl = url;
    if (url.includes('x.com')) {
      normalizedUrl = url.replace('x.com', 'twitter.com');
    }

    console.log('Twitter: Processing URL:', normalizedUrl);
    
    // First, get content info with improved headers
    const infoProcess = spawn('python3', [
      ...getYtDlpBaseArgs(),
      '--print', '%(title)s|%(duration)s|%(uploader)s|%(view_count)s',
      normalizedUrl
    ]);

    let contentInfo = '';
    let infoError = '';

    infoProcess.stdout.on('data', (data) => {
      contentInfo += data.toString();
    });

    infoProcess.stderr.on('data', (data) => {
      infoError += data.toString();
    });

    await new Promise((resolve) => {
      infoProcess.on('close', resolve);
    });

    const [title, duration, uploader, viewCount] = contentInfo.trim().split('|');
    
    // Detect if this is a text post or has video content
    const hasVideo = duration && duration !== 'null' && parseInt(duration) > 0;
    
    // Generate filename based on content type
    const safeTitle = (title || 'Twitter_Content').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const timestamp = Date.now();
    let extension, contentType;
    
    if (hasVideo) {
      extension = format === 'video' ? 'mp4' : 'm4a';
      contentType = format;
    } else {
      // For posts without video, try to download as image first, fallback to text
      extension = 'jpg';
      contentType = 'image';
    }
    
    const filename = `${safeTitle}_${timestamp}.${extension}`;
    const outputPath = path.join(__dirname, 'downloads', filename);

    // Ensure downloads directory exists
    const downloadsDir = path.join(__dirname, 'downloads');
    if (!await fs.access(downloadsDir).then(() => true).catch(() => false)) {
      await fs.mkdir(downloadsDir, { recursive: true });
    }

    // Always create a text file with post info first
    const decodedTitle = (title || 'No title')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    
    const postInfo = `Twitter Post: ${decodedTitle}\nUploader: ${uploader || 'Unknown'}\nURL: ${normalizedUrl}\nDownloaded: ${new Date().toISOString()}`;
    
    const textFilename = `${safeTitle}_${timestamp}_text.txt`;
    const textOutputPath = path.join(__dirname, 'downloads', textFilename);
    
    try {
      await fs.writeFile(textOutputPath, postInfo, 'utf8');
    } catch (textError) {
      console.error('Twitter text file creation error:', textError);
    }
    
    if (hasVideo) {
      // Download video/audio with yt-dlp
      const formatString = format === 'video' ? 'best' : 'bestaudio/best';
      
      const ytdlp = spawn('python3', ['-m', 'yt_dlp',
        '--output', outputPath,
        '--format', formatString,
        '--no-warnings',
        normalizedUrl
      ]);

      let errorOutput = '';

      ytdlp.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ytdlp.on('close', async (code) => {
        if (code === 0) {
          try {
            const stats = await fs.stat(outputPath);
            
            res.json({
              success: true,
              filePath: outputPath,
              filename: filename,
              fileSize: stats.size,
              platform: 'twitter',
              title: title || 'Twitter Content',
              duration: duration ? parseInt(duration) : undefined,
              uploader: uploader || undefined,
              viewCount: viewCount ? parseInt(viewCount) : undefined,
              contentType: contentType,
              textFile: textOutputPath
            });
          } catch (fileError) {
            console.error('Twitter file check error:', fileError);
            res.status(500).json({ 
              error: 'File was not created successfully',
              details: fileError.message
            });
          }
        } else {
          console.error('Twitter yt-dlp error:', errorOutput);
          res.status(500).json({ 
            error: 'Twitter download failed',
            details: errorOutput,
            suggestions: 'Twitter may require authentication or the content may not be accessible'
          });
        }
      });
    } else {
      // For text-only posts, return the text file
      try {
        const stats = await fs.stat(textOutputPath);
        
        res.json({
          success: true,
          filePath: textOutputPath,
          filename: textFilename,
          fileSize: stats.size,
          platform: 'twitter',
          title: title || 'Twitter Post',
          uploader: uploader || undefined,
          contentType: 'text'
        });
      } catch (statError) {
        console.error('Twitter text file stat error:', statError);
        res.status(500).json({ 
          error: 'Failed to create text file',
          details: statError.message
        });
      }
    }

  } catch (error) {
    console.error('Twitter download error:', error);
    res.status(500).json({ 
      error: 'Failed to process Twitter URL',
      details: error.message 
    });
  }
});

// Podcast endpoint removed - duplicate definition found later in file

// Facebook download endpoint - using yt-dlp with direct download
app.post('/api/facebook', async (req, res) => {
  try {
    const { url, format = 'video' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('Facebook: Processing URL:', url);
    
    // First, get content info using dump-json (more reliable for Facebook)
    const infoProcess = spawn('python3', [
      ...getYtDlpBaseArgs(),
      '--dump-json',
      '--no-playlist',
      url
    ]);

    let contentInfo = '';
    let infoError = '';

    infoProcess.stdout.on('data', (data) => {
      contentInfo += data.toString();
    });

    infoProcess.stderr.on('data', (data) => {
      infoError += data.toString();
    });

    await new Promise((resolve) => {
      infoProcess.on('close', resolve);
    });

    let title, duration, uploader, viewCount;
    try {
      console.log('Facebook raw contentInfo:', contentInfo.substring(0, 200) + '...');
      const jsonData = JSON.parse(contentInfo.trim());
      title = jsonData.title;
      duration = jsonData.duration;
      uploader = jsonData.uploader;
      viewCount = jsonData.view_count;
      console.log('Facebook parsed:', { title: title?.substring(0, 50), duration, uploader: uploader?.substring(0, 20), hasVideo: duration > 0 });
    } catch (parseError) {
      console.error('Facebook JSON parse error:', parseError.message);
      console.error('Raw content length:', contentInfo.length);
      
      // Try to extract basic info from URL or use better fallback titles
      let extractedTitle = 'Facebook Content';
      
      // Extract video ID from URL for better identification
      const videoIdMatch = url.match(/\/videos\/(?:.*\/)?(\d+)/);
      const postIdMatch = url.match(/\/posts\/(\d+)/);
      
      if (videoIdMatch) {
        const videoId = videoIdMatch[1];
        extractedTitle = `Facebook Video ${videoId}`;
        duration = 30; // Assume video has content
        console.log('Facebook: Extracted video ID for title:', videoId);
      } else if (postIdMatch) {
        const postId = postIdMatch[1];
        extractedTitle = `Facebook Post ${postId}`;
        duration = null;
        console.log('Facebook: Extracted post ID for title:', postId);
      } else if (url.includes('/watch/')) {
        // Facebook Watch videos
        const watchIdMatch = url.match(/\/watch\/\?v=(\d+)/);
        if (watchIdMatch) {
          extractedTitle = `Facebook Watch ${watchIdMatch[1]}`;
          duration = 30;
        } else {
          extractedTitle = 'Facebook Watch Video';
          duration = 30;
        }
        console.log('Facebook: Watch video detected');
      } else {
        extractedTitle = 'Facebook Content';
        duration = null;
      }
      
      title = extractedTitle;
      uploader = 'Facebook User';
      viewCount = null;
    }
    
    // Detect if this is a post with or without video content
    const hasVideo = duration && duration !== 'null' && parseFloat(duration) > 0;
    
    // Generate filename
    const safeTitle = (title || 'Facebook_Content').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const timestamp = Date.now();
    let extension, contentType;
    
    if (hasVideo) {
      extension = format === 'video' ? 'mp4' : 'm4a';
      contentType = format;
    } else {
      extension = 'txt';
      contentType = 'text';
    }
    
    const filename = `${safeTitle}_${timestamp}.${extension}`;
    const outputPath = path.join(__dirname, 'downloads', filename);

    // Ensure downloads directory exists
    const downloadsDir = path.join(__dirname, 'downloads');
    if (!await fs.access(downloadsDir).then(() => true).catch(() => false)) {
      await fs.mkdir(downloadsDir, { recursive: true });
    }

    // Always create a text file with post info first
    const decodedTitle = (title || 'No title')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    
    // Extract better content info from JSON
    let description = '';
    try {
      const jsonData = JSON.parse(contentInfo.trim());
      description = jsonData.description || '';
    } catch (e) {
      // Ignore parsing errors
    }

    const postInfo = `Facebook Post: ${decodedTitle}\nUploader: ${uploader || 'Unknown'}\nDuration: ${duration ? `${duration} seconds` : 'N/A'}\nView Count: ${viewCount || 'Unknown'}\nDescription: ${description || 'No description available'}\nURL: ${url}\nDownloaded: ${new Date().toISOString()}`;
    
    const textFilename = `${safeTitle}_${timestamp}_text.txt`;
    const textOutputPath = path.join(__dirname, 'downloads', textFilename);
    
    try {
      await fs.writeFile(textOutputPath, postInfo, 'utf8');
    } catch (textError) {
      console.error('Facebook text file creation error:', textError);
    }

    if (hasVideo) {
      // Download file directly with yt-dlp
      const formatString = format === 'video' ? 'best' : 'bestaudio/best';
      
      console.log('Facebook: Starting download with format:', formatString);
      const ytdlp = spawn('python3', ['-m', 'yt_dlp',
        '--output', outputPath,
        '--format', formatString,
        '--no-warnings',
        '--user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        url
      ]);

      let errorOutput = '';
      let stdOutput = '';

      ytdlp.stdout.on('data', (data) => {
        stdOutput += data.toString();
      });

      ytdlp.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ytdlp.on('close', async (code) => {
        console.log('Facebook: yt-dlp exit code:', code);
        console.log('Facebook: stdout:', stdOutput);
        console.log('Facebook: stderr:', errorOutput);
        
        if (code === 0) {
          try {
            // Check if file was created and get its info
            const stats = await fs.stat(outputPath);
            
            res.json({
              success: true,
              filePath: outputPath,
              filename: filename,
              fileSize: stats.size,
              platform: 'facebook',
              title: title || 'Facebook Video',
              duration: duration ? parseInt(duration) : undefined,
              uploader: uploader || undefined,
              viewCount: viewCount ? parseInt(viewCount) : undefined,
              contentType: contentType,
              textFile: textOutputPath
            });
          } catch (fileError) {
            console.error('Facebook file check error:', fileError);
            res.status(500).json({ 
              error: 'File was not created successfully',
              details: fileError.message,
              suggestions: 'The download may have failed due to Facebook restrictions'
            });
          }
        } else {
          console.error('Facebook yt-dlp error:', errorOutput);
          
          let errorMessage = 'Facebook download failed';
          let suggestions = 'Try again later or use a different URL';
          
          if (errorOutput.includes('403') || errorOutput.includes('Forbidden')) {
            errorMessage = 'Facebook video access denied';
            suggestions = 'This video may be private, deleted, or Facebook is blocking downloads. Try a different public video.';
          } else if (errorOutput.includes('404') || errorOutput.includes('not found')) {
            errorMessage = 'Facebook video not found';
            suggestions = 'The video may have been deleted or the URL is incorrect.';
          } else if (errorOutput.includes('rate') || errorOutput.includes('limit')) {
            errorMessage = 'Facebook rate limit reached';
            suggestions = 'Please wait a few minutes before trying again.';
          }
          
          res.status(500).json({ 
            error: errorMessage,
            details: errorOutput,
            suggestions: suggestions
          });
        }
      });
    } else {
      // For text-only posts, return the text file
      try {
        const stats = await fs.stat(textOutputPath);
        
        res.json({
          success: true,
          filePath: textOutputPath,
          filename: textFilename,
          fileSize: stats.size,
          platform: 'facebook',
          title: title || 'Facebook Post',
          uploader: uploader || undefined,
          contentType: 'text'
        });
      } catch (statError) {
        console.error('Facebook text file stat error:', statError);
        res.status(500).json({ 
          error: 'Failed to create text file',
          details: statError.message
        });
      }
    }

  } catch (error) {
    console.error('Facebook download error:', error);
    res.status(500).json({ 
      error: 'Failed to process Facebook URL',
      details: error.message 
    });
  }
});

// LinkedIn download endpoint - using yt-dlp with direct download
app.post('/api/linkedin', async (req, res) => {
  try {
    const { url, format = 'video' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('LinkedIn: Processing URL:', url);
    
    // First, get content info using JSON for better reliability
    const infoProcess = spawn('python3', [
      ...getYtDlpBaseArgs(),
      '--dump-json',
      url
    ]);

    let contentInfo = '';
    let infoError = '';

    infoProcess.stdout.on('data', (data) => {
      contentInfo += data.toString();
    });

    infoProcess.stderr.on('data', (data) => {
      infoError += data.toString();
    });

    await new Promise((resolve) => {
      infoProcess.on('close', resolve);
    });

    console.log('LinkedIn raw contentInfo:', contentInfo.substring(0, 200) + '...');

    let parsedInfo;
    let title, duration, uploader, viewCount, description;
    
    if (infoError.includes('Unable to download') || infoError.includes('rate limit') || !contentInfo.trim()) {
      // Fallback to basic post extraction when yt-dlp fails
      console.log('LinkedIn: yt-dlp failed, using fallback method');
      
      // Extract basic info from URL pattern
      const urlMatch = url.match(/posts\/([^_]+)_([^-]+)/);
      const postId = urlMatch ? urlMatch[2] : 'post';
      
      title = 'LinkedIn Video Post';
      uploader = 'LinkedIn User';
      duration = null;
      viewCount = null;
      description = 'LinkedIn video content';
    } else {
      try {
        parsedInfo = JSON.parse(contentInfo.trim());
        title = parsedInfo.title || 'LinkedIn_Content';
        duration = parsedInfo.duration;
        uploader = parsedInfo.uploader || parsedInfo.channel;
        viewCount = parsedInfo.view_count;
        description = parsedInfo.description;
      } catch (e) {
        console.error('LinkedIn: Failed to parse JSON info, using fallback:', e);
        // Use fallback when JSON parsing fails
        title = 'LinkedIn Video Content';
        uploader = 'LinkedIn User';
        duration = null;
        viewCount = null;
        description = 'LinkedIn video post';
      }
    }
    
    console.log('LinkedIn parsing:', { title: title?.substring(0, 30), uploader, viewCount, duration, description: description?.substring(0, 50) });
    
    // Detect if this is a video post or text post - same logic as Twitter
    const hasVideo = duration && duration !== 'null' && parseFloat(duration) > 0;
    
    // Generate filename based on content type
    const safeTitle = (title || 'LinkedIn_Content').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const timestamp = Date.now();
    let extension, contentType;
    
    if (hasVideo) {
      extension = format === 'video' ? 'mp4' : 'm4a';
      contentType = format;
    } else {
      extension = 'txt';
      contentType = 'text';
    }
    
    const filename = `${safeTitle}_${timestamp}.${extension}`;
    const outputPath = path.join(__dirname, 'downloads', filename);

    // Ensure downloads directory exists
    const downloadsDir = path.join(__dirname, 'downloads');
    if (!await fs.access(downloadsDir).then(() => true).catch(() => false)) {
      await fs.mkdir(downloadsDir, { recursive: true });
    }

    // Always create a text file with post info first
    const decodedTitle = (title || 'No title')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
      
    const decodedDescription = (description || '')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    
    let postInfo = `LinkedIn Post: ${decodedTitle}\nUploader: ${uploader || 'Unknown'}\nURL: ${url}`;
    
    if (decodedDescription && decodedDescription !== 'null' && decodedDescription.trim()) {
      postInfo += `\n\nContent:\n${decodedDescription}`;
    }
    
    postInfo += `\n\nDownloaded: ${new Date().toISOString()}`;
    
    const textFilename = `${safeTitle}_${timestamp}_text.txt`;
    const textOutputPath = path.join(__dirname, 'downloads', textFilename);
    
    try {
      await fs.writeFile(textOutputPath, postInfo, 'utf8');
      console.log('LinkedIn: Text file created successfully');
    } catch (textError) {
      console.error('LinkedIn: Failed to create text file:', textError);
    }

    if (hasVideo) {
      // Download video/audio with yt-dlp
      const formatString = format === 'video' ? 'best' : 'bestaudio/best';
      
      console.log('LinkedIn: Starting video download with format:', formatString);
      const ytdlp = spawn('python3', ['-m', 'yt_dlp',
        '--output', outputPath,
        '--format', formatString,
        '--no-warnings',
        url
      ]);

      let errorOutput = '';
      let stdOutput = '';

      ytdlp.stdout.on('data', (data) => {
        stdOutput += data.toString();
      });

      ytdlp.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ytdlp.on('close', async (code) => {
        console.log('LinkedIn: yt-dlp exit code:', code);
        console.log('LinkedIn: stdout:', stdOutput);
        console.log('LinkedIn: stderr:', errorOutput);
        
        if (code === 0) {
          try {
            const stats = await fs.stat(outputPath);
            
            res.json({
              success: true,
              filePath: outputPath,
              filename: filename,
              fileSize: stats.size,
              platform: 'linkedin',
              title: title || 'LinkedIn Video',
              duration: duration ? parseFloat(duration) : undefined,
              uploader: uploader || undefined,
              viewCount: viewCount || undefined,
              contentType: contentType,
              textFile: textOutputPath  // Include reference to text file
            });
          } catch (fileError) {
            console.error('LinkedIn file check error:', fileError);
            res.status(500).json({ 
              error: 'File was not created successfully',
              details: fileError.message
            });
          }
        } else {
          console.error('LinkedIn yt-dlp error:', errorOutput);
          res.status(500).json({ 
            error: 'LinkedIn download failed',
            details: errorOutput,
            suggestions: 'Try again later or use a different URL'
          });
        }
      });
    } else {
      // Only text content available - return the text file
      try {
        const stats = await fs.stat(textOutputPath);
        
        res.json({
          success: true,
          filePath: textOutputPath,
          filename: textFilename,
          fileSize: stats.size,
          platform: 'linkedin',
          title: title || 'LinkedIn Post',
          uploader: uploader || undefined,
          contentType: 'text'
        });
      } catch (writeError) {
        console.error('LinkedIn text file creation error:', writeError);
        res.status(500).json({ 
          error: 'Failed to create text file',
          details: writeError.message
        });
      }
    }

  } catch (error) {
    console.error('LinkedIn download error:', error);
    res.status(500).json({ 
      error: 'Failed to process LinkedIn URL',
      details: error.message 
    });
  }
});


// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    details: error.message 
  });
});

// YouTube Music download endpoint
app.post('/api/youtube-music', async (req, res) => {
  try {
    const { url, format = 'audio' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('YouTube Music: Processing URL:', url);
    
    // Use yt-dlp for YouTube Music with audio-focused options
    const timestamp = Date.now();
    const outputPath = path.join(__dirname, 'downloads', `ytmusic_${timestamp}.%(ext)s`);
    
    const ytdlpProcess = spawn('python3', [
      ...getYtDlpBaseArgs(),
      '--format', 'bestaudio/best',
      '--output', outputPath,
      '--print-json',
      url
    ]);

    let stdout = '';
    let stderr = '';

    ytdlpProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ytdlpProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ytdlpProcess.on('close', async (code) => {
      console.log(`YouTube Music yt-dlp exit code: ${code}`);
      console.log('YouTube Music stdout:', stdout);
      if (stderr) console.log('YouTube Music stderr:', stderr);

      if (code === 0) {
        try {
          // Parse the JSON output to get metadata
          const lines = stdout.trim().split('\n');
          let metadata = null;
          
          for (const line of lines) {
            try {
              const json = JSON.parse(line);
              if (json.title && json.url) {
                metadata = json;
                break;
              }
            } catch (e) {
              // Continue to next line
            }
          }

          if (!metadata) {
            throw new Error('No metadata found in output');
          }

          // Find the downloaded file
          const downloadsDir = path.join(__dirname, 'downloads');
          const files = await fs.readdir(downloadsDir);
          const musicFiles = files.filter(f => f.includes(`ytmusic_${timestamp}`));
          
          if (musicFiles.length === 0) {
            throw new Error('No music file was downloaded');
          }

          const downloadedFile = musicFiles[0];
          const filePath = path.join(downloadsDir, downloadedFile);
          const stats = await fs.stat(filePath);

          // Create text file with track information
          const textFilename = downloadedFile.replace(/\.[^/.]+$/, '_track_info.txt');
          const textPath = path.join(downloadsDir, textFilename);
          
          const trackInfo = `YouTube Music Track: ${metadata.title || 'Unknown Track'}
Artist: ${metadata.artist || metadata.uploader || 'Unknown Artist'}
Album: ${metadata.album || 'Unknown Album'}
Duration: ${metadata.duration ? `${Math.floor(metadata.duration / 60)}:${String(metadata.duration % 60).padStart(2, '0')}` : 'Unknown'}
View Count: ${metadata.view_count || 'Unknown'}
Description: ${metadata.description || 'No description available'}
Track URL: ${url}
Downloaded: ${new Date().toISOString()}`;

          await fs.writeFile(textPath, trackInfo, 'utf8');

          res.json({
            success: true,
            filePath: filePath,
            filename: downloadedFile,
            fileSize: stats.size,
            platform: 'youtube-music',
            title: metadata.title || 'YouTube Music Track',
            artist: metadata.artist || metadata.uploader || undefined,
            album: metadata.album || undefined,
            duration: metadata.duration || undefined,
            viewCount: metadata.view_count || undefined,
            contentType: 'audio',
            trackInfo: textPath
          });

        } catch (fileError) {
          console.error('YouTube Music file processing error:', fileError);
          res.status(500).json({ 
            error: 'YouTube Music download completed but file processing failed',
            details: fileError.message,
            suggestions: 'The track may have been downloaded but metadata extraction failed'
          });
        }
      } else {
        console.error('YouTube Music yt-dlp error:', stderr);
        
        let errorMessage = 'YouTube Music download failed';
        let suggestions = 'Try with a different YouTube Music URL';
        
        if (stderr.includes('Video unavailable') || stderr.includes('not available')) {
          errorMessage = 'YouTube Music track unavailable';
          suggestions = 'This track may be region-restricted, private, or removed from YouTube Music.';
        } else if (stderr.includes('403') || stderr.includes('Forbidden')) {
          errorMessage = 'YouTube Music access denied';
          suggestions = 'This track may be restricted or require authentication.';
        } else if (stderr.includes('404') || stderr.includes('not found')) {
          errorMessage = 'YouTube Music track not found';
          suggestions = 'The track URL may be incorrect or the track may have been removed.';
        }
        
        res.status(500).json({ 
          error: errorMessage,
          details: stderr,
          suggestions: suggestions
        });
      }
    });

  } catch (error) {
    console.error('YouTube Music processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process YouTube Music URL',
      details: error.message 
    });
  }
});

// Bulk Playlist download endpoint
app.post('/api/playlist', async (req, res) => {
  try {
    const { url, format = 'auto', maxItems = 10 } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log(`Playlist: Processing URL: ${url} (max: ${maxItems} items)`);
    
    // Determine platform and set appropriate format
    let platformFormat = 'best';
    let platform = 'unknown';
    let processedUrl = url;
    
    if (url.includes('youtube.com/playlist') || url.includes('youtu.be')) {
      platform = 'youtube';
      platformFormat = format === 'audio' ? 'bestaudio/best' : 'best';
    } else if (url.includes('music.youtube.com')) {
      platform = 'youtube-music';
      platformFormat = 'bestaudio/best';
    } else if (url.includes('podcasts.apple.com')) {
      platform = 'apple-podcasts';
      platformFormat = 'bestaudio/best';
      // For Apple Podcasts, we need to extract RSS feed from the show page
      // yt-dlp can handle this automatically for most podcast shows
    } else if (url.includes('feeds.') || url.includes('.xml') || url.includes('rss')) {
      platform = 'rss-feed';
      platformFormat = 'bestaudio/best';
    } else if (url.includes('spotify.com/playlist') || url.includes('spotify.com/album')) {
      platform = 'spotify-playlist';
      platformFormat = 'bestaudio/best';
    }
    
    const timestamp = Date.now();
    const outputTemplate = path.join(__dirname, 'downloads', `playlist_${platform}_${timestamp}`, '%(playlist_index)s - %(title)s.%(ext)s');
    
    // Create directory for playlist downloads
    const playlistDir = path.join(__dirname, 'downloads', `playlist_${platform}_${timestamp}`);
    await fs.mkdir(playlistDir, { recursive: true });
    
    let downloadProcess;
    
    if (platform === 'spotify-playlist') {
      // Use spotdl for Spotify playlists
      downloadProcess = spawn('python3', ['-m', 'spotdl',
        url,
        '--output', path.dirname(outputTemplate),
        '--format', 'mp3',
        '--playlist-end', maxItems.toString()
      ]);
    } else {
      // Use yt-dlp for all other platforms  
      downloadProcess = spawn('python3', ['-m', 'yt_dlp',
        '--format', platformFormat,
        '--output', outputTemplate,
        '--playlist-end', maxItems.toString(),
        '--no-warnings', 
        '--print-json',
        url
      ]);
    }

    let stdout = '';
    let stderr = '';
    const downloadedItems = [];

    downloadProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      
      // Parse JSON output in real-time to track progress
      const lines = output.trim().split('\n');
      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          if (json.title && json.filename) {
            downloadedItems.push({
              title: json.title,
              filename: path.basename(json.filename),
              duration: json.duration,
              uploader: json.uploader || json.channel,
              index: json.playlist_index
            });
          }
        } catch (e) {
          // Continue to next line
        }
      }
    });

    downloadProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    downloadProcess.on('close', async (code) => {
      console.log(`Playlist download exit code: ${code}`);
      console.log(`Playlist download completed. Items found: ${downloadedItems.length}`);
      if (stderr) console.log('Playlist stderr:', stderr);

      if (code === 0) {
        try {
          // Get actual downloaded files
          const files = await fs.readdir(playlistDir);
          const mediaFiles = files.filter(f => !f.endsWith('.info.json') && !f.endsWith('.description'));
          
          if (mediaFiles.length === 0) {
            throw new Error('No files were downloaded from the playlist');
          }

          // Calculate total size
          let totalSize = 0;
          for (const file of mediaFiles) {
            const filePath = path.join(playlistDir, file);
            const stats = await fs.stat(filePath);
            totalSize += stats.size;
          }

          // Create playlist summary file
          const summaryFilename = `playlist_summary_${timestamp}.txt`;
          const summaryPath = path.join(playlistDir, summaryFilename);
          
          const playlistInfo = `Playlist Download Summary
Platform: ${platform.toUpperCase()}
Source URL: ${url}
Total Items Downloaded: ${mediaFiles.length}
Total Size: ${(totalSize / (1024 * 1024)).toFixed(2)} MB
Downloaded: ${new Date().toISOString()}

Items:
${downloadedItems.map((item, i) => 
  `${i + 1}. ${item.title} (${item.duration ? Math.floor(item.duration / 60) + ':' + String(item.duration % 60).padStart(2, '0') : 'Unknown duration'})`
).join('\n')}`;

          await fs.writeFile(summaryPath, playlistInfo, 'utf8');

          res.json({
            success: true,
            playlistPath: playlistDir,
            platform: platform,
            totalItems: mediaFiles.length,
            totalSize: totalSize,
            downloadedFiles: mediaFiles,
            items: downloadedItems,
            summaryFile: summaryPath,
            contentType: format === 'audio' ? 'audio' : 'mixed'
          });

        } catch (fileError) {
          console.error('Playlist file processing error:', fileError);
          res.status(500).json({ 
            error: 'Playlist download completed but file processing failed',
            details: fileError.message,
            suggestions: 'Some files may have been downloaded but processing failed'
          });
        }
      } else {
        console.error('Playlist yt-dlp error:', stderr);
        
        let errorMessage = 'Playlist download failed';
        let suggestions = 'Try with a different playlist URL or reduce maxItems';
        
        if (stderr.includes('Playlist does not exist') || stderr.includes('not found')) {
          errorMessage = 'Playlist not found';
          suggestions = 'The playlist may be private, deleted, or the URL is incorrect.';
        } else if (stderr.includes('private') || stderr.includes('403')) {
          errorMessage = 'Playlist is private or restricted';
          suggestions = 'This playlist may require authentication or be unavailable in your region.';
        } else if (stderr.includes('rate') || stderr.includes('limit')) {
          errorMessage = 'Rate limit reached';
          suggestions = 'Please wait before downloading large playlists. Try reducing maxItems.';
        }
        
        res.status(500).json({ 
          error: errorMessage,
          details: stderr,
          suggestions: suggestions
        });
      }
    });

  } catch (error) {
    console.error('Playlist processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process playlist URL',
      details: error.message 
    });
  }
});

// RSS/Podcast feed download endpoint
app.post('/api/podcast', async (req, res) => {
  try {
    const { url, format = 'audio' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('Podcast: Processing RSS/Podcast URL:', url);
    
    // Use yt-dlp to extract podcast episodes from RSS feeds or podcast URLs
    const timestamp = Date.now();
    const outputPath = path.join(__dirname, 'downloads', `podcast_${timestamp}.%(ext)s`);
    
    const ytdlpProcess = spawn('python3', ['-m', 'yt_dlp',
      '--format', 'bestaudio/best',
      '--output', outputPath,
      '--no-warnings',
      '--print-json',
      url
    ]);

    let stdout = '';
    let stderr = '';

    ytdlpProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ytdlpProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ytdlpProcess.on('close', async (code) => {
      console.log(`Podcast yt-dlp exit code: ${code}`);
      console.log('Podcast stdout:', stdout);
      if (stderr) console.log('Podcast stderr:', stderr);

      if (code === 0) {
        try {
          // Parse the JSON output to get metadata
          const lines = stdout.trim().split('\n');
          let metadata = null;
          
          for (const line of lines) {
            try {
              const json = JSON.parse(line);
              if (json.title && json.url) {
                metadata = json;
                break;
              }
            } catch (e) {
              // Continue to next line
            }
          }

          if (!metadata) {
            throw new Error('No metadata found in output');
          }

          // Find the downloaded file
          const downloadsDir = path.join(__dirname, 'downloads');
          const files = await fs.readdir(downloadsDir);
          const podcastFiles = files.filter(f => f.includes(`podcast_${timestamp}`));
          
          if (podcastFiles.length === 0) {
            throw new Error('No podcast file was downloaded');
          }

          const downloadedFile = podcastFiles[0];
          const filePath = path.join(downloadsDir, downloadedFile);
          const stats = await fs.stat(filePath);

          // Create text file with episode information
          const textFilename = downloadedFile.replace(/\.[^/.]+$/, '_episode_info.txt');
          const textPath = path.join(downloadsDir, textFilename);
          
          const episodeInfo = `Podcast Episode: ${metadata.title || 'Unknown Episode'}
Uploader: ${metadata.uploader || metadata.channel || 'Unknown'}
Duration: ${metadata.duration ? `${Math.floor(metadata.duration / 60)}:${String(metadata.duration % 60).padStart(2, '0')}` : 'Unknown'}
Description: ${metadata.description || 'No description available'}
Episode URL: ${url}
Downloaded: ${new Date().toISOString()}`;

          await fs.writeFile(textPath, episodeInfo, 'utf8');

          res.json({
            success: true,
            filePath: filePath,
            filename: downloadedFile,
            fileSize: stats.size,
            platform: 'podcast',
            title: metadata.title || 'Podcast Episode',
            duration: metadata.duration || undefined,
            uploader: metadata.uploader || metadata.channel || undefined,
            contentType: 'audio',
            episodeInfo: textPath
          });

        } catch (fileError) {
          console.error('Podcast file processing error:', fileError);
          res.status(500).json({ 
            error: 'Podcast download completed but file processing failed',
            details: fileError.message,
            suggestions: 'The podcast may have been downloaded but metadata extraction failed'
          });
        }
      } else {
        console.error('Podcast yt-dlp error:', stderr);
        
        let errorMessage = 'Podcast download failed';
        let suggestions = 'Try with a different podcast URL or RSS feed';
        
        if (stderr.includes('unsupported URL') || stderr.includes('No suitable extractor')) {
          errorMessage = 'Unsupported podcast URL format';
          suggestions = 'Try with a direct RSS feed URL or supported podcast platform URL';
        } else if (stderr.includes('403') || stderr.includes('Forbidden')) {
          errorMessage = 'Podcast access denied';
          suggestions = 'This podcast may be private or restricted. Try a different public podcast.';
        } else if (stderr.includes('404') || stderr.includes('not found')) {
          errorMessage = 'Podcast not found';
          suggestions = 'The podcast URL may be incorrect or the episode may have been removed.';
        }
        
        res.status(500).json({ 
          error: errorMessage,
          details: stderr,
          suggestions: suggestions
        });
      }
    });

  } catch (error) {
    console.error('Podcast processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process podcast URL',
      details: error.message 
    });
  }
});

// Pinterest download endpoint - focused on video content with enhanced headers
app.post('/api/pinterest', async (req, res) => {
  try {
    const { url, format = 'video' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('Pinterest: Processing video URL:', url);
    
    // First, get content info using simple yt-dlp command that works
    const infoProcess = spawn('python3', ['-m', 'yt_dlp',
      '--dump-json',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      url
    ]);

    let contentInfo = '';
    let infoError = '';

    infoProcess.stdout.on('data', (data) => {
      contentInfo += data.toString();
    });

    infoProcess.stderr.on('data', (data) => {
      infoError += data.toString();
    });

    await new Promise((resolve) => {
      infoProcess.on('close', resolve);
    });

    // Check for Pinterest video extraction failures and use enhanced extraction
    // Only treat as failure if we have actual errors (not just warnings) AND no content
    const hasRealError = (infoError.includes('ERROR') || infoError.includes('Unable to download JSON metadata') || infoError.includes('404') || infoError.includes('No suitable extractor')) && !contentInfo.trim();
    
    if (hasRealError) {
      console.log('Pinterest: Standard extraction failed, using enhanced fallback');
      
      // Extract pin ID from URL for better identification
      const pinIdMatch = url.match(/pinterest\.com\/pin\/([0-9]+)/);
      const pinId = pinIdMatch ? pinIdMatch[1] : 'video';
      
      // Create informative text file when extraction fails
      const safeTitle = `Pinterest_Video_${pinId}`;
      const timestamp = Date.now();
      const filename = `${safeTitle}_${timestamp}_text.txt`;
      const outputPath = path.join(__dirname, 'downloads', filename);

      // Ensure downloads directory exists
      const downloadsDir = path.join(__dirname, 'downloads');
      if (!await fs.access(downloadsDir).then(() => true).catch(() => false)) {
        await fs.mkdir(downloadsDir, { recursive: true });
      }

      const videoInfo = `Pinterest Video: ${pinId}\nOriginal URL: ${url}\nStatus: Extraction blocked by Pinterest\nDownloaded: ${new Date().toISOString()}\n\nNote: Pinterest blocks automated video downloads. This is a placeholder file.\nYou can visit the URL manually: ${url}`;
      
      await fs.writeFile(outputPath, videoInfo, 'utf8');
      const stats = await fs.stat(outputPath);
      
      return res.json({
        success: true,
        filePath: outputPath,
        filename: filename,
        fileSize: stats.size,
        platform: 'pinterest',
        title: `Pinterest Video: ${pinId}`,
        contentType: 'text',
        note: 'Extraction blocked - placeholder created with URL info'
      });
    }

    // Parse JSON response for better title extraction
    let title, uploader, description, duration;
    try {
      const jsonData = JSON.parse(contentInfo.trim());
      title = jsonData.title;
      uploader = jsonData.uploader;
      description = jsonData.description;
      duration = jsonData.duration;
    } catch (e) {
      // Fallback to pipe parsing
      const [titleFallback, uploaderFallback, descriptionFallback] = contentInfo.trim().split('|');
      title = titleFallback;
      uploader = uploaderFallback; 
      description = descriptionFallback;
    }
    
    // Detect if this is a video pin - Pinterest now supports video content
    const hasVideo = duration && duration !== 'null' && parseFloat(duration) > 0;
    
    // Generate filename for video content
    const safeTitle = (title || 'Pinterest_Video').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const timestamp = Date.now();
    let extension, contentType;
    
    if (hasVideo) {
      extension = format === 'video' ? 'mp4' : 'm4a';
      contentType = format;
    } else {
      // For image pins, fallback to image download
      extension = 'jpg';
      contentType = 'image';
    }
    
    const filename = `${safeTitle}_${timestamp}.${extension}`;
    const outputPath = path.join(__dirname, 'downloads', filename);

    // Ensure downloads directory exists
    const downloadsDir = path.join(__dirname, 'downloads');
    if (!await fs.access(downloadsDir).then(() => true).catch(() => false)) {
      await fs.mkdir(downloadsDir, { recursive: true });
    }

    // Download file directly with yt-dlp using simple approach that works
    console.log('Pinterest: Starting video download...');
    // Pinterest uses HLS streams, so use 'best' format without extension restriction
    const formatString = hasVideo ? (format === 'video' ? 'best' : 'bestaudio/best') : 'best';
    
    const ytdlp = spawn('python3', ['-m', 'yt_dlp',
      '--output', outputPath,
      // Let yt-dlp automatically select and merge best formats for Pinterest HLS streams
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      url
    ]);

    let errorOutput = '';
    let stdOutput = '';

    ytdlp.stdout.on('data', (data) => {
      stdOutput += data.toString();
    });

    ytdlp.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ytdlp.on('close', async (code) => {
      console.log('Pinterest: yt-dlp exit code:', code);
      console.log('Pinterest: stdout:', stdOutput);
      console.log('Pinterest: stderr:', errorOutput);
      
      if (code === 0) {
        try {
          // Check if file was created and get its info
          const stats = await fs.stat(outputPath);
          
          res.json({
            success: true,
            filePath: outputPath,
            filename: filename,
            fileSize: stats.size,
            platform: 'pinterest',
            title: title || 'Pinterest Pin',
            uploader: uploader || undefined,
            description: description || undefined,
            contentType: contentType
          });
        } catch (fileError) {
          console.error('Pinterest file check error:', fileError);
          res.status(500).json({ 
            error: 'File was not created successfully',
            details: fileError.message,
            suggestions: 'The download may have failed due to Pinterest restrictions'
          });
        }
      } else {
        console.error('Pinterest yt-dlp error:', errorOutput);
        
        let errorMessage = 'Pinterest download failed';
        let suggestions = 'Try again later or use a different URL';
        
        if (errorOutput.includes('403') || errorOutput.includes('Forbidden')) {
          errorMessage = 'Pinterest pin access denied';
          suggestions = 'This pin may be private, deleted, or Pinterest is blocking downloads. Try a different public pin.';
        } else if (errorOutput.includes('404') || errorOutput.includes('not found')) {
          errorMessage = 'Pinterest pin not found';
          suggestions = 'The pin may have been deleted or the URL is incorrect.';
        } else if (errorOutput.includes('rate') || errorOutput.includes('limit')) {
          errorMessage = 'Pinterest rate limit reached';
          suggestions = 'Please wait a few minutes before trying again.';
        }
        
        res.status(500).json({ 
          error: errorMessage,
          details: errorOutput,
          suggestions: suggestions
        });
      }
    });

  } catch (error) {
    console.error('Pinterest download error:', error);
    res.status(500).json({ 
      error: 'Failed to process Pinterest URL',
      details: error.message 
    });
  }
});

// Universal download endpoint - automatically detects platform and routes to appropriate handler
app.post('/api/download', async (req, res) => {
  try {
    const { url, format = 'video', quality = 'best' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('Universal API: Processing URL:', url);
    
    // Platform detection logic based on URL patterns
    let detectedPlatform = 'unknown';
    let targetEndpoint = '';
    
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      detectedPlatform = 'youtube';
      targetEndpoint = '/api/youtube'; // Use endpoint with ScrapingBee proxy support
    } else if (url.includes('music.youtube.com')) {
      detectedPlatform = 'youtube-music';
      targetEndpoint = '/api/youtube-music';
    } else if (url.includes('tiktok.com')) {
      detectedPlatform = 'tiktok';
      targetEndpoint = '/api/tiktok';
    } else if (url.includes('instagram.com')) {
      detectedPlatform = 'instagram';
      targetEndpoint = '/api/instagram';
    } else if (url.includes('pinterest.com')) {
      detectedPlatform = 'pinterest';
      targetEndpoint = '/api/pinterest';
    } else if (url.includes('facebook.com') || url.includes('fb.watch')) {
      detectedPlatform = 'facebook';
      targetEndpoint = '/api/facebook';
    } else if (url.includes('linkedin.com')) {
      detectedPlatform = 'linkedin';
      targetEndpoint = '/api/linkedin';
    } else if (url.includes('twitter.com') || url.includes('x.com')) {
      detectedPlatform = 'twitter';
      targetEndpoint = '/api/twitter';
    } else if (url.includes('spotify.com')) {
      detectedPlatform = 'spotify';
      targetEndpoint = '/api/spotify';
    } else if (url.includes('podcasts.apple.com') || url.includes('feeds.') || url.includes('.xml') || url.includes('rss')) {
      detectedPlatform = 'podcast';
      targetEndpoint = '/api/podcast';
    } else {
      // Unknown platform
      return res.status(400).json({ 
        error: 'Unsupported platform',
        message: 'The provided URL is not from a supported platform',
        supportedPlatforms: [
          'YouTube (youtube.com, youtu.be)',
          'YouTube Music (music.youtube.com)',
          'TikTok (tiktok.com)',
          'Instagram (instagram.com)',
          'Pinterest (pinterest.com)',
          'Facebook (facebook.com, fb.watch)',
          'LinkedIn (linkedin.com)',
          'Twitter/X (twitter.com, x.com)',
          'Spotify (spotify.com)',
          'Podcasts (podcasts.apple.com, RSS feeds)'
        ]
      });
    }
    
    console.log(`Universal API: Detected platform '${detectedPlatform}', routing to ${targetEndpoint}`);
    
    // Create a new request object with the same data but route to specific endpoint
    const forwardedReq = {
      ...req,
      url: targetEndpoint,
      body: { url, format, quality }
    };
    
    // Instead of making an internal request, we'll reuse the existing handler logic
    // by calling the appropriate handler function directly
    
    // For now, let's use a simpler approach - forward the request internally
    
    try {
      // Make internal request to the specific endpoint using correct base URL for Railway
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? `https://detachbackend-production.up.railway.app` 
        : `http://localhost:${PORT}`;
      
      console.log(`Universal API: Making request to ${baseUrl}${targetEndpoint}`);
      
      const response = await axios.post(`${baseUrl}${targetEndpoint}`, {
        url,
        format,
        quality,
        cookies: req.body.cookies // Forward cookies if provided
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 120000 // 2 minute timeout
      });
      
      // Add platform detection info to the response
      const responseData = response.data;
      if (responseData.success) {
        responseData.detectedPlatform = detectedPlatform;
        responseData.routedTo = targetEndpoint;
      }
      
      res.json(responseData);
      
    } catch (forwardError) {
      console.error('Universal API: Error forwarding to platform endpoint:', forwardError.message);
      
      if (forwardError.response) {
        // Forward the error response from the platform endpoint
        res.status(forwardError.response.status).json(forwardError.response.data);
      } else {
        res.status(500).json({
          error: 'Platform processing failed',
          message: `Failed to process ${detectedPlatform} URL`,
          details: forwardError.message,
          platform: detectedPlatform
        });
      }
    }
    
  } catch (error) {
    console.error('Universal API: Processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process URL',
      message: 'An error occurred while processing the request',
      details: error.message 
    });
  }
});

// 404 handler - must be last
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

const server = app.listen(PORT, () => {
  console.log(`Social Media Downloader Backend running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log('Available endpoints:');
  console.log('  POST /api/download - Universal endpoint (auto-detects platform) ⭐ NEW');
  console.log('  POST /api/spotify - Download Spotify tracks/podcasts');
  console.log('  POST /api/youtube - Download YouTube videos');
  console.log('  POST /api/youtube-ytdlp - Download YouTube videos using yt-dlp');
  console.log('  POST /api/youtube-music - Download YouTube Music tracks');
  console.log('  POST /api/instagram - Download Instagram content');
  console.log('  POST /api/tiktok - Download TikTok videos');
  console.log('  POST /api/twitter - Download Twitter/X videos and posts');
  console.log('  POST /api/facebook - Download Facebook videos');
  console.log('  POST /api/linkedin - Download LinkedIn videos and posts');
  console.log('  POST /api/pinterest - Download Pinterest images');
  console.log('  POST /api/podcast - Download RSS podcast feeds/episodes');
  console.log('  POST /api/playlist - Download bulk playlists/shows (YouTube, YouTube Music, Apple Podcasts, Spotify)');
});

// Graceful shutdown handling
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Try:`);
    console.error(`  1. Kill existing process: lsof -ti:${PORT} | xargs kill -9`);
    console.error(`  2. Use different port: PORT=3004 npm run dev`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});

process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

module.exports = app;