const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

// Middleware to log requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve downloaded files
app.get('/api/file/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'downloads', filename);
  
  // Check if file exists and serve it
  fs.access(filePath)
    .then(() => {
      res.sendFile(filePath);
    })
    .catch(() => {
      res.status(404).json({ error: 'File not found' });
    });
});

// YouTube download endpoint using ytdl-core
app.post('/api/youtube', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    if (!ytdl.validateURL(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    // Get video info
    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title;
    const duration = info.videoDetails.lengthSeconds;

    // Get download URL for best quality video with audio
    const format = ytdl.chooseFormat(info.formats, { 
      quality: 'highestvideo',
      filter: 'audioandvideo'
    });

    if (!format) {
      return res.status(400).json({ error: 'No suitable format found' });
    }

    res.json({
      success: true,
      downloadUrl: format.url,
      title,
      duration,
      platform: 'youtube'
    });

  } catch (error) {
    console.error('YouTube download error:', error);
    res.status(500).json({ 
      error: 'Failed to process YouTube URL',
      details: error.message 
    });
  }
});

// YouTube download endpoint using yt-dlp (alternative method)
app.post('/api/youtube-ytdlp', async (req, res) => {
  try {
    const { url, format = 'audio' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // First, get video info (title, duration, etc.)
    const infoProcess = spawn('/Users/username/Library/Python/3.9/bin/yt-dlp', [
      '--print', '%(title)s|%(duration)s|%(uploader)s|%(view_count)s',
      url
    ]);

    let videoInfo = '';
    let infoError = '';

    infoProcess.stdout.on('data', (data) => {
      videoInfo += data.toString();
    });

    infoProcess.stderr.on('data', (data) => {
      infoError += data.toString();
    });

    await new Promise((resolve) => {
      infoProcess.on('close', resolve);
    });

    const [title, duration, uploader, viewCount] = videoInfo.trim().split('|');

    // Then get download URL based on format preference
    const formatString = format === 'video' 
      ? 'best[height<=720][ext=mp4]/best[ext=mp4]/best'
      : 'bestaudio[ext=m4a]/bestaudio';

    const ytdlp = spawn('/Users/username/Library/Python/3.9/bin/yt-dlp', [
      '--get-url',
      '--format', formatString,
      url
    ]);

    let downloadUrl = '';
    let errorOutput = '';

    ytdlp.stdout.on('data', (data) => {
      downloadUrl += data.toString();
    });

    ytdlp.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ytdlp.on('close', (code) => {
      if (code === 0 && downloadUrl.trim()) {
        res.json({
          success: true,
          downloadUrl: downloadUrl.trim(),
          platform: 'youtube',
          title: title || 'YouTube Video',
          duration: duration ? parseInt(duration) : undefined,
          uploader: uploader || undefined,
          viewCount: viewCount ? parseInt(viewCount) : undefined,
          contentType: format
        });
      } else {
        console.error('yt-dlp error:', errorOutput);
        res.status(500).json({ 
          error: 'Failed to get download URL',
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

// Instagram download endpoint using InDown.io API to bypass authentication issues
app.post('/api/instagram', async (req, res) => {
  try {
    const { url, format = 'video' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('Instagram: Processing URL via InDown.io API:', url);
    
    const timestamp = Date.now();
    
    try {
      // Try InDown.io API first
      const indownData = new URLSearchParams({
        'url': url
      });
      
      const indownResponse = await axios.post('https://indown.io/download', indownData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Origin': 'https://indown.io',
          'Referer': 'https://indown.io/'
        },
        timeout: 20000
      });
      
      // Parse HTML response to extract download links
      const $ = cheerio.load(indownResponse.data);
      let downloadUrl = null;
      let title = 'Instagram Content';
      let isImagePost = false;
      
      // Look for download links - check for both video and image
      $('a[href*=".mp4"], a[href*=".jpg"], a[href*=".jpeg"], a[href*=".png"]').each((i, element) => {
        const href = $(element).attr('href');
        if (href) {
          downloadUrl = href;
          isImagePost = href.includes('.jpg') || href.includes('.jpeg') || href.includes('.png');
          return false; // Break loop
        }
      });
      
      // Try different selectors
      if (!downloadUrl) {
        $('a[download], .download-link, .media-link').each((i, element) => {
          const href = $(element).attr('href');
          if (href && (href.includes('.mp4') || href.includes('.jpg') || href.includes('instagram'))) {
            downloadUrl = href;
            isImagePost = href.includes('.jpg') || href.includes('.jpeg') || href.includes('.png');
            return false;
          }
        });
      }
      
      // Extract title if available
      const titleElement = $('.media-title, .post-title, h1, h2, .title').first();
      if (titleElement.length) {
        title = titleElement.text().trim() || 'Instagram Content';
      }
      
      if (downloadUrl) {
        // Download the media file
        const mediaResponse = await axios.get(downloadUrl, {
          responseType: 'stream',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Referer': 'https://indown.io/'
          },
          timeout: 30000
        });
        
        const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
        const extension = isImagePost ? 'jpg' : (format === 'video' ? 'mp4' : 'm4a');
        const filename = `${safeTitle}_${timestamp}.${extension}`;
        const outputPath = path.join(__dirname, 'downloads', filename);
        
        // Ensure downloads directory exists
        const downloadsDir = path.join(__dirname, 'downloads');
        await fs.mkdir(downloadsDir, { recursive: true }).catch(() => {});
        
        // Save the media file
        const writer = require('fs').createWriteStream(outputPath);
        mediaResponse.data.pipe(writer);
        
        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
        
        const stats = await fs.stat(outputPath);
        
        res.json({
          success: true,
          filePath: outputPath,
          filename: filename,
          fileSize: stats.size,
          platform: 'instagram',
          title: title,
          contentType: isImagePost ? 'image' : format,
          isImagePost: isImagePost,
          note: 'Downloaded via InDown.io API'
        });
        return;
      }
    } catch (indownError) {
      console.log('Instagram: InDown.io API failed, trying FastDl...', indownError.message);
      
      // Fallback to FastDl API
      try {
        const fastdlData = new URLSearchParams({
          'url': url
        });
        
        const fastdlResponse = await axios.post('https://fastdl.app/c/instagram', fastdlData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'application/json, text/html',
            'Origin': 'https://fastdl.app',
            'Referer': 'https://fastdl.app/'
          },
          timeout: 20000
        });
        
        const $ = cheerio.load(fastdlResponse.data);
        let downloadUrl = null;
        let title = 'Instagram Content';
        let isImagePost = false;
        
        // Look for download links
        $('a[href*=".mp4"], a[href*=".jpg"], a[download]').each((i, element) => {
          const href = $(element).attr('href');
          if (href) {
            downloadUrl = href;
            isImagePost = href.includes('.jpg') || href.includes('.jpeg') || href.includes('.png');
            return false;
          }
        });
        
        if (downloadUrl) {
          const mediaResponse = await axios.get(downloadUrl, {
            responseType: 'stream',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
              'Referer': 'https://fastdl.app/'
            },
            timeout: 30000
          });
          
          const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
          const extension = isImagePost ? 'jpg' : (format === 'video' ? 'mp4' : 'm4a');
          const filename = `${safeTitle}_${timestamp}.${extension}`;
          const outputPath = path.join(__dirname, 'downloads', filename);
          
          const downloadsDir = path.join(__dirname, 'downloads');
          await fs.mkdir(downloadsDir, { recursive: true }).catch(() => {});
          
          const writer = require('fs').createWriteStream(outputPath);
          mediaResponse.data.pipe(writer);
          
          await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
          });
          
          const stats = await fs.stat(outputPath);
          
          res.json({
            success: true,
            filePath: outputPath,
            filename: filename,
            fileSize: stats.size,
            platform: 'instagram',
            title: title,
            contentType: isImagePost ? 'image' : format,
            isImagePost: isImagePost,
            note: 'Downloaded via FastDl API'
          });
          return;
        }
      } catch (fastdlError) {
        console.log('Instagram: Both APIs failed, creating info file...', fastdlError.message);
      }
    }
    
    // If all APIs fail, create an informative text file
    const infoContent = `Instagram Download Status\n\nURL: ${url}\n\nStatus: Instagram download services temporarily unavailable\n\nThis can happen when:\n1. Instagram updates their API or security measures\n2. Download services are under maintenance\n3. The post is private or requires login\n4. Network connectivity issues\n\nAlternatives:\n1. Try again in a few minutes\n2. Use Instagram app's built-in save feature\n3. Screenshot the content if legally permitted\n4. Contact the content creator for sharing\n\nDownloaded: ${new Date().toISOString()}`;
    
    const infoFilename = `Instagram_Info_${timestamp}.txt`;
    const infoPath = path.join(__dirname, 'downloads', infoFilename);
    
    await fs.writeFile(infoPath, infoContent, 'utf8');
    const stats = await fs.stat(infoPath);
    
    res.json({
      success: true,
      filePath: infoPath,
      filename: infoFilename,
      fileSize: stats.size,
      platform: 'instagram',
      title: 'Instagram Download Temporarily Unavailable',
      contentType: 'text',
      note: 'Download services temporarily unavailable - try again later'
    });

  } catch (error) {
    console.error('Instagram download error:', error);
    res.status(500).json({ 
      error: 'Failed to process Instagram URL',
      details: error.message 
    });
  }
});

// TikTok download endpoint using Snaptik API to bypass IP blocking
app.post('/api/tiktok', async (req, res) => {
  try {
    const { url, format = 'video' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('TikTok: Processing URL via Snaptik API:', url);
    
    // Extract TikTok video ID
    const tiktokMatch = url.match(/(?:vm\.tiktok\.com\/|tiktok\.com\/.+\/video\/)([a-zA-Z0-9]+)/);
    if (!tiktokMatch) {
      return res.status(400).json({ error: 'Invalid TikTok URL format' });
    }
    
    const timestamp = Date.now();
    
    try {
      // Try Snaptik API first
      const snaptikData = new URLSearchParams({
        'url': url,
        'lang': 'en'
      });
      
      const snaptikResponse = await axios.post('https://snaptik.app/abc2.php', snaptikData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
          'Accept': '*/*',
          'Origin': 'https://snaptik.app',
          'Referer': 'https://snaptik.app/'
        },
        timeout: 15000
      });
      
      // Parse HTML response to extract download links
      const $ = cheerio.load(snaptikResponse.data);
      let downloadUrl = null;
      let title = 'TikTok Video';
      
      // Look for download links
      $('a[href*=".mp4"]').each((i, element) => {
        const href = $(element).attr('href');
        if (href && (href.includes('.mp4') || href.includes('download'))) {
          downloadUrl = href;
          return false; // Break loop
        }
      });
      
      // Try different selectors for download links
      if (!downloadUrl) {
        $('a').each((i, element) => {
          const href = $(element).attr('href');
          if (href && (href.includes('tikcdn') || href.includes('muscdn') || href.includes('.mp4'))) {
            downloadUrl = href;
            return false;
          }
        });
      }
      
      // Extract title if available
      const titleElement = $('.video-title, .title, h1, h2').first();
      if (titleElement.length) {
        title = titleElement.text().trim() || 'TikTok Video';
      }
      
      if (downloadUrl) {
        // Download the video file
        const videoResponse = await axios.get(downloadUrl, {
          responseType: 'stream',
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
            'Referer': 'https://snaptik.app/'
          },
          timeout: 30000
        });
        
        const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
        const extension = format === 'video' ? 'mp4' : 'm4a';
        const filename = `${safeTitle}_${timestamp}.${extension}`;
        const outputPath = path.join(__dirname, 'downloads', filename);
        
        // Ensure downloads directory exists
        const downloadsDir = path.join(__dirname, 'downloads');
        await fs.mkdir(downloadsDir, { recursive: true }).catch(() => {});
        
        // Save the video file
        const writer = require('fs').createWriteStream(outputPath);
        videoResponse.data.pipe(writer);
        
        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
        
        const stats = await fs.stat(outputPath);
        
        res.json({
          success: true,
          filePath: outputPath,
          filename: filename,
          fileSize: stats.size,
          platform: 'tiktok',
          title: title,
          contentType: format,
          note: 'Downloaded via Snaptik API'
        });
        return;
      }
    } catch (snaptikError) {
      console.log('TikTok: Snaptik API failed, trying SSSTik...', snaptikError.message);
      
      // Fallback to SSSTik API
      try {
        const sssTikData = {
          'id': url,
          'locale': 'en',
          'tt': 'Q2lrcVUx'
        };
        
        const sssTikResponse = await axios.post('https://ssstik.io/abc?url=dl', sssTikData, {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
            'Accept': 'application/json, text/plain, */*',
            'Origin': 'https://ssstik.io',
            'Referer': 'https://ssstik.io/'
          },
          timeout: 15000
        });
        
        if (sssTikResponse.data && sssTikResponse.data.url) {
          const downloadUrl = sssTikResponse.data.url;
          const title = sssTikResponse.data.title || 'TikTok Video';
          
          // Download the video
          const videoResponse = await axios.get(downloadUrl, {
            responseType: 'stream',
            headers: {
              'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
              'Referer': 'https://ssstik.io/'
            },
            timeout: 30000
          });
          
          const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
          const extension = format === 'video' ? 'mp4' : 'm4a';
          const filename = `${safeTitle}_${timestamp}.${extension}`;
          const outputPath = path.join(__dirname, 'downloads', filename);
          
          const downloadsDir = path.join(__dirname, 'downloads');
          await fs.mkdir(downloadsDir, { recursive: true }).catch(() => {});
          
          const writer = require('fs').createWriteStream(outputPath);
          videoResponse.data.pipe(writer);
          
          await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
          });
          
          const stats = await fs.stat(outputPath);
          
          res.json({
            success: true,
            filePath: outputPath,
            filename: filename,
            fileSize: stats.size,
            platform: 'tiktok',
            title: title,
            contentType: format,
            note: 'Downloaded via SSSTik API'
          });
          return;
        }
      } catch (sssTikError) {
        console.log('TikTok: Both APIs failed, creating info file...', sssTikError.message);
      }
    }
    
    // If all APIs fail, create an informative text file
    const infoContent = `TikTok Download Status\n\nURL: ${url}\n\nStatus: TikTok download services temporarily unavailable\n\nThis can happen when:\n1. TikTok updates their API\n2. Download services are under maintenance\n3. Network connectivity issues\n\nAlternatives:\n1. Try again in a few minutes\n2. Use TikTok app's built-in save feature\n3. Use browser extensions\n4. Screen record if legally permitted\n\nDownloaded: ${new Date().toISOString()}`;
    
    const infoFilename = `TikTok_Info_${timestamp}.txt`;
    const infoPath = path.join(__dirname, 'downloads', infoFilename);
    
    await fs.writeFile(infoPath, infoContent, 'utf8');
    const stats = await fs.stat(infoPath);
    
    res.json({
      success: true,
      filePath: infoPath,
      filename: infoFilename,
      fileSize: stats.size,
      platform: 'tiktok',
      title: 'TikTok Download Temporarily Unavailable',
      contentType: 'text',
      note: 'Download services temporarily unavailable - try again later'
    });

  } catch (error) {
    console.error('TikTok download error:', error);
    res.status(500).json({ 
      error: 'Failed to process TikTok URL',
      details: error.message 
    });
  }
});

// Twitter/X download endpoint using ssstwitter.com API to bypass authentication
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

    console.log('Twitter: Processing URL via ssstwitter API:', normalizedUrl);
    
    const timestamp = Date.now();
    
    try {
      // Try ssstwitter.com API first
      const sssTwitData = new URLSearchParams({
        'id': normalizedUrl,
        'locale': 'en',
        'tt': 'Q2lrcVUx'
      });
      
      const sssTwitResponse = await axios.post('https://ssstwitter.com/result', sssTwitData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Origin': 'https://ssstwitter.com',
          'Referer': 'https://ssstwitter.com/'
        },
        timeout: 20000
      });
      
      // Parse HTML response to extract download links and content
      const $ = cheerio.load(sssTwitResponse.data);
      let downloadUrl = null;
      let title = 'Twitter Post';
      let tweetText = '';
      let hasVideo = false;
      
      // Extract tweet text content
      const textElement = $('.tweet-text, .text-content, .content');
      if (textElement.length) {
        tweetText = textElement.text().trim();
      }
      
      // Look for video download links
      $('a[href*=".mp4"], a[download*=".mp4"], .download-link').each((i, element) => {
        const href = $(element).attr('href');
        if (href && href.includes('.mp4')) {
          downloadUrl = href;
          hasVideo = true;
          title = tweetText || 'Twitter Video';
          return false; // Break loop
        }
      });
      
      // Try alternative selectors
      if (!downloadUrl) {
        $('a').each((i, element) => {
          const href = $(element).attr('href');
          if (href && (href.includes('video') || href.includes('.mp4'))) {
            downloadUrl = href;
            hasVideo = true;
            title = tweetText || 'Twitter Video';
            return false;
          }
        });
      }
      
      if (downloadUrl && hasVideo) {
        // Download the video file
        const videoResponse = await axios.get(downloadUrl, {
          responseType: 'stream',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Referer': 'https://ssstwitter.com/'
          },
          timeout: 30000
        });
        
        const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
        const extension = format === 'video' ? 'mp4' : 'm4a';
        const filename = `${safeTitle}_${timestamp}.${extension}`;
        const outputPath = path.join(__dirname, 'downloads', filename);
        
        // Ensure downloads directory exists
        const downloadsDir = path.join(__dirname, 'downloads');
        await fs.mkdir(downloadsDir, { recursive: true }).catch(() => {});
        
        // Save the video file
        const writer = require('fs').createWriteStream(outputPath);
        videoResponse.data.pipe(writer);
        
        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
        
        const stats = await fs.stat(outputPath);
        
        res.json({
          success: true,
          filePath: outputPath,
          filename: filename,
          fileSize: stats.size,
          platform: 'twitter',
          title: title,
          contentType: format,
          note: 'Downloaded via ssstwitter.com API'
        });
        return;
      } else if (tweetText) {
        // If no video but we have tweet text, save as text file
        const tweetContent = `Twitter/X Post Content\n\nURL: ${url}\n\nTweet Text: ${tweetText}\n\nNote: This tweet contains text content only (no video).\n\nDownloaded: ${new Date().toISOString()}`;
        
        const safeTitle = (tweetText.substring(0, 50) || 'Twitter_Post').replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `${safeTitle}_${timestamp}.txt`;
        const outputPath = path.join(__dirname, 'downloads', filename);
        
        await fs.writeFile(outputPath, tweetContent, 'utf8');
        const stats = await fs.stat(outputPath);
        
        res.json({
          success: true,
          filePath: outputPath,
          filename: filename,
          fileSize: stats.size,
          platform: 'twitter',
          title: 'Twitter Text Post',
          contentType: 'text',
          note: 'Text-only tweet content extracted'
        });
        return;
      }
    } catch (sssError) {
      console.log('Twitter: ssstwitter API failed, trying x-downloader...', sssError.message);
      
      // Fallback to x-downloader.org
      try {
        const xDownloaderData = new URLSearchParams({
          'url': url // Use original URL for X downloader
        });
        
        const xDownloaderResponse = await axios.post('https://x-downloader.org/download', xDownloaderData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'application/json, text/html',
            'Origin': 'https://x-downloader.org',
            'Referer': 'https://x-downloader.org/'
          },
          timeout: 20000
        });
        
        const $ = cheerio.load(xDownloaderResponse.data);
        let downloadUrl = null;
        let title = 'X Post';
        
        // Look for download links
        $('a[href*=".mp4"], a[download]').each((i, element) => {
          const href = $(element).attr('href');
          if (href && href.includes('.mp4')) {
            downloadUrl = href;
            return false;
          }
        });
        
        if (downloadUrl) {
          const videoResponse = await axios.get(downloadUrl, {
            responseType: 'stream',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
              'Referer': 'https://x-downloader.org/'
            },
            timeout: 30000
          });
          
          const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
          const extension = format === 'video' ? 'mp4' : 'm4a';
          const filename = `${safeTitle}_${timestamp}.${extension}`;
          const outputPath = path.join(__dirname, 'downloads', filename);
          
          const downloadsDir = path.join(__dirname, 'downloads');
          await fs.mkdir(downloadsDir, { recursive: true }).catch(() => {});
          
          const writer = require('fs').createWriteStream(outputPath);
          videoResponse.data.pipe(writer);
          
          await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
          });
          
          const stats = await fs.stat(outputPath);
          
          res.json({
            success: true,
            filePath: outputPath,
            filename: filename,
            fileSize: stats.size,
            platform: 'twitter',
            title: title,
            contentType: format,
            note: 'Downloaded via x-downloader.org API'
          });
          return;
        }
      } catch (xDownloaderError) {
        console.log('Twitter: Both APIs failed, creating info file...', xDownloaderError.message);
      }
    }
    
    // If all APIs fail, create an informative text file
    const infoContent = `Twitter/X Download Status\n\nURL: ${url}\n\nStatus: Twitter/X download services temporarily unavailable\n\nThis can happen when:\n1. Twitter/X updates their API or security measures\n2. Download services are under maintenance\n3. The tweet is private or deleted\n4. Network connectivity issues\n5. Tweet contains only text (no video)\n\nAlternatives:\n1. Try again in a few minutes\n2. Use Twitter/X app's built-in bookmark feature\n3. Screenshot the content if legally permitted\n4. Use browser extensions designed for Twitter/X\n\nDownloaded: ${new Date().toISOString()}`;
    
    const infoFilename = `Twitter_Info_${timestamp}.txt`;
    const infoPath = path.join(__dirname, 'downloads', infoFilename);
    
    await fs.writeFile(infoPath, infoContent, 'utf8');
    const stats = await fs.stat(infoPath);
    
    res.json({
      success: true,
      filePath: infoPath,
      filename: infoFilename,
      fileSize: stats.size,
      platform: 'twitter',
      title: 'Twitter/X Download Temporarily Unavailable',
      contentType: 'text',
      note: 'Download services temporarily unavailable - try again later'
    });

  } catch (error) {
    console.error('Twitter download error:', error);
    res.status(500).json({ 
      error: 'Failed to process Twitter URL',
      details: error.message 
    });
  }
});

// Apple Podcasts download endpoint using RSS feeds and yt-dlp fallback
app.post('/api/podcast', async (req, res) => {
  try {
    const { url, episodeIndex = 0 } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL or RSS feed is required' });
    }

    console.log('Podcast: Processing URL:', url);
    
    // First try yt-dlp for Apple Podcasts URLs
    if (url.includes('podcasts.apple.com')) {
      console.log('Podcast: Apple Podcasts URL detected, trying yt-dlp...');
      
      const ytdlp = spawn('/Users/username/Library/Python/3.9/bin/yt-dlp', [
        '--print', '%(title)s|%(uploader)s|%(description)s|%(duration)s',
        '--no-warnings',
        url
      ]);

      let ytdlpInfo = '';
      let ytdlpError = '';

      ytdlp.stdout.on('data', (data) => {
        ytdlpInfo += data.toString();
      });

      ytdlp.stderr.on('data', (data) => {
        ytdlpError += data.toString();
      });

      await new Promise((resolve) => {
        ytdlp.on('close', resolve);
      });

      if (ytdlpInfo.trim()) {
        const [title, uploader, description, duration] = ytdlpInfo.trim().split('|');
        
        const safeTitle = (title || 'Podcast_Episode').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
        const timestamp = Date.now();
        const filename = `${safeTitle}_${timestamp}.m4a`;
        const outputPath = path.join(__dirname, 'downloads', filename);

        // Download with yt-dlp
        const downloadProcess = spawn('/Users/username/Library/Python/3.9/bin/yt-dlp', [
          '--output', outputPath,
          '--format', 'bestaudio/best',
          '--no-warnings',
          url
        ]);

        let downloadError = '';

        downloadProcess.stderr.on('data', (data) => {
          downloadError += data.toString();
        });

        downloadProcess.on('close', async (code) => {
          if (code === 0) {
            try {
              const stats = await fs.stat(outputPath);
              
              res.json({
                success: true,
                filePath: outputPath,
                filename: filename,
                fileSize: stats.size,
                platform: 'podcast',
                title: title || 'Podcast Episode',
                uploader: uploader || 'Unknown Podcast',
                description: description || '',
                duration: duration || '',
                contentType: 'audio'
              });
              return;
            } catch (fileError) {
              console.error('Podcast: File check error:', fileError);
            }
          }
          
          // If yt-dlp failed, fall back to RSS parsing
          console.log('Podcast: yt-dlp failed, falling back to RSS parsing...');
          await handleRSSPodcast();
        });
        return;
      }
    }
    
    // Handle RSS feeds or fallback
    await handleRSSPodcast();
    
    async function handleRSSPodcast() {
      const pythonScript = `
import feedparser
import requests
import sys
import json
import os
from urllib.parse import urlparse
import re

try:
    url = '${url}'
    
    # If it's an Apple Podcasts URL, try to extract RSS feed
    if 'podcasts.apple.com' in url:
        try:
            import urllib.request
            headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}
            req = urllib.request.Request(url, headers=headers)
            response = urllib.request.urlopen(req)
            html = response.read().decode('utf-8')
            
            # Look for RSS feed link in the HTML
            rss_patterns = [
                r'"feedUrl":\s*"([^"]+)"',
                r'"rssFeedUrl":\s*"([^"]+)"',
                r'<link[^>]*type=["\']application/rss\+xml["\'][^>]*href=["\']([^"\'>]+)["\']',
                r'href=["\']([^"\'>]*\\.rss[^"\'>]*)["\']'
            ]
            
            rss_url = None
            for pattern in rss_patterns:
                match = re.search(pattern, html, re.IGNORECASE)
                if match:
                    rss_url = match.group(1)
                    break
            
            if rss_url:
                url = rss_url.replace('\\u002F', '/')
            else:
                print(json.dumps({'error': 'Could not find RSS feed URL in Apple Podcasts page'}))
                sys.exit(1)
        except Exception as e:
            print(json.dumps({'error': f'Failed to extract RSS from Apple Podcasts: {str(e)}'}))
            sys.exit(1)
    
    # Parse the RSS feed
    headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}
    feed = feedparser.parse(url, request_headers=headers)
    
    if not feed.entries:
        print(json.dumps({'error': f'No episodes found in RSS feed. Feed status: {getattr(feed, "status", "unknown")}'}))
        sys.exit(1)
    
    # Get the episode
    episode_index = ${episodeIndex}
    if episode_index >= len(feed.entries):
        episode_index = 0
        
    episode = feed.entries[episode_index]
    
    # Find the audio URL
    audio_url = None
    
    # Check enclosures first
    if hasattr(episode, 'enclosures'):
        for enclosure in episode.enclosures:
            if hasattr(enclosure, 'type') and 'audio' in enclosure.type.lower():
                audio_url = enclosure.href
                break
    
    # Check links if no enclosure found
    if not audio_url and hasattr(episode, 'links'):
        for link in episode.links:
            if hasattr(link, 'type') and 'audio' in link.type.lower():
                audio_url = link.href
                break
            elif hasattr(link, 'href') and any(ext in link.href.lower() for ext in ['.mp3', '.m4a', '.wav', '.aac']):
                audio_url = link.href
                break
    
    if not audio_url:
        print(json.dumps({'error': 'No audio URL found for this episode'}))
        sys.exit(1)
    
    # Generate filename
    title = episode.get('title', 'Podcast Episode')
    safe_title = re.sub(r'[^a-zA-Z0-9]', '_', title)[:50]
    timestamp = str(int(__import__('time').time() * 1000))
    
    # Determine file extension
    extension = 'mp3'
    parsed_url = urlparse(audio_url)
    if parsed_url.path:
        path_ext = os.path.splitext(parsed_url.path)[1].lower()
        if path_ext in ['.mp3', '.m4a', '.wav', '.aac']:
            extension = path_ext[1:]
    
    filename = f"{safe_title}_{timestamp}.{extension}"
    output_path = os.path.join('${path.join(__dirname, 'downloads')}', filename)
    
    # Download the episode with proper headers
    session = requests.Session()
    session.headers.update(headers)
    
    response = session.get(audio_url, stream=True, timeout=30)
    response.raise_for_status()
    
    with open(output_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)
    
    # Get file stats
    file_stats = os.stat(output_path)
    
    result = {
        'success': True,
        'filePath': output_path,
        'filename': filename,
        'fileSize': file_stats.st_size,
        'platform': 'podcast',
        'title': title,
        'uploader': feed.feed.get('title', 'Unknown Podcast'),
        'description': episode.get('description', ''),
        'publishDate': episode.get('published', ''),
        'duration': episode.get('itunes_duration', ''),
        'contentType': 'audio'
    }
    
    print(json.dumps(result))
    
except Exception as e:
    print(json.dumps({'error': str(e)}))
`;

      const pythonProcess = spawn('python3', ['-c', pythonScript]);
      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      pythonProcess.on('close', (code) => {
        console.log('Podcast: RSS Python script exit code:', code);
        console.log('Podcast: stdout:', output);
        if (errorOutput) console.log('Podcast: stderr:', errorOutput);
        
        if (code === 0 && output.trim()) {
          try {
            const lines = output.trim().split('\n');
            const jsonLine = lines[lines.length - 1];
            const result = JSON.parse(jsonLine);
            
            if (result.success) {
              res.json(result);
            } else {
              res.status(500).json({ 
                error: result.error || 'Podcast download failed',
                details: errorOutput,
                suggestions: 'Try a different podcast URL or check if the RSS feed is valid'
              });
            }
          } catch (parseError) {
            console.error('Podcast: Failed to parse output:', parseError);
            res.status(500).json({ 
              error: 'Failed to parse download result',
              details: output + '\n' + errorOutput
            });
          }
        } else {
          let errorMessage = 'Podcast download failed';
          let suggestions = 'Check if the URL is a valid podcast RSS feed or Apple Podcasts URL';
          
          if (errorOutput.includes('403') || errorOutput.includes('Forbidden')) {
            errorMessage = 'Access denied to podcast feed';
            suggestions = 'The podcast feed may require authentication or be geo-blocked.';
          } else if (errorOutput.includes('404') || errorOutput.includes('Not Found')) {
            errorMessage = 'Podcast not found';
            suggestions = 'Check if the URL is correct and the podcast still exists.';
          } else if (errorOutput.includes('timeout')) {
            errorMessage = 'Podcast download timeout';
            suggestions = 'The podcast file may be too large or the server is slow.';
          }
          
          res.status(500).json({ 
            error: errorMessage,
            details: errorOutput,
            suggestions: suggestions
          });
        }
      });
    }

  } catch (error) {
    console.error('Podcast download error:', error);
    res.status(500).json({ 
      error: 'Failed to process podcast URL',
      details: error.message 
    });
  }
});

// Facebook download endpoint using FDown.net API to bypass authentication
app.post('/api/facebook', async (req, res) => {
  try {
    const { url, format = 'video' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('Facebook: Processing URL via FDown.net API:', url);
    
    const timestamp = Date.now();
    
    try {
      // Try FDown.net API first
      const fdownData = new URLSearchParams({
        'URLz': url
      });
      
      const fdownResponse = await axios.post('https://www.fdown.net/download.php', fdownData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Origin': 'https://www.fdown.net',
          'Referer': 'https://www.fdown.net/'
        },
        timeout: 25000
      });
      
      // Parse HTML response to extract download links
      const $ = cheerio.load(fdownResponse.data);
      let downloadUrl = null;
      let title = 'Facebook Video';
      
      // Extract title if available
      const titleElement = $('.video-title, .title, h1, h2, .media-title').first();
      if (titleElement.length) {
        title = titleElement.text().trim() || 'Facebook Video';
      }
      
      // Look for HD video download link first
      $('a[href*=".mp4"]').each((i, element) => {
        const href = $(element).attr('href');
        const linkText = $(element).text().toLowerCase();
        if (href && href.includes('.mp4')) {
          // Prefer HD quality if available
          if (linkText.includes('hd') || linkText.includes('high') || !downloadUrl) {
            downloadUrl = href;
            if (linkText.includes('hd')) return false; // Break if found HD
          }
        }
      });
      
      // Try alternative selectors
      if (!downloadUrl) {
        $('a[download], .download-btn, .btn-download').each((i, element) => {
          const href = $(element).attr('href');
          if (href && (href.includes('.mp4') || href.includes('facebook'))) {
            downloadUrl = href;
            return false;
          }
        });
      }
      
      if (downloadUrl) {
        // Download the video file
        const videoResponse = await axios.get(downloadUrl, {
          responseType: 'stream',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Referer': 'https://www.fdown.net/'
          },
          timeout: 45000
        });
        
        const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
        const extension = format === 'video' ? 'mp4' : 'm4a';
        const filename = `${safeTitle}_${timestamp}.${extension}`;
        const outputPath = path.join(__dirname, 'downloads', filename);
        
        // Ensure downloads directory exists
        const downloadsDir = path.join(__dirname, 'downloads');
        await fs.mkdir(downloadsDir, { recursive: true }).catch(() => {});
        
        // Save the video file
        const writer = require('fs').createWriteStream(outputPath);
        videoResponse.data.pipe(writer);
        
        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
        
        const stats = await fs.stat(outputPath);
        
        res.json({
          success: true,
          filePath: outputPath,
          filename: filename,
          fileSize: stats.size,
          platform: 'facebook',
          title: title,
          contentType: format,
          note: 'Downloaded via FDown.net API'
        });
        return;
      }
    } catch (fdownError) {
      console.log('Facebook: FDown.net API failed, trying SnapSave...', fdownError.message);
      
      // Fallback to SnapSave.App
      try {
        const snapSaveData = new URLSearchParams({
          'url': url,
          'token': ''
        });
        
        const snapSaveResponse = await axios.post('https://snapsave.app/action.php?lang=en', snapSaveData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'application/json, text/html',
            'Origin': 'https://snapsave.app',
            'Referer': 'https://snapsave.app/'
          },
          timeout: 25000
        });
        
        const $ = cheerio.load(snapSaveResponse.data);
        let downloadUrl = null;
        let title = 'Facebook Video';
        
        // Look for download links
        $('a[href*=".mp4"], a[download]').each((i, element) => {
          const href = $(element).attr('href');
          if (href && href.includes('.mp4')) {
            downloadUrl = href;
            return false;
          }
        });
        
        const titleElement = $('.title, h2, .video-title').first();
        if (titleElement.length) {
          title = titleElement.text().trim() || 'Facebook Video';
        }
        
        if (downloadUrl) {
          const videoResponse = await axios.get(downloadUrl, {
            responseType: 'stream',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
              'Referer': 'https://snapsave.app/'
            },
            timeout: 45000
          });
          
          const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
          const extension = format === 'video' ? 'mp4' : 'm4a';
          const filename = `${safeTitle}_${timestamp}.${extension}`;
          const outputPath = path.join(__dirname, 'downloads', filename);
          
          const downloadsDir = path.join(__dirname, 'downloads');
          await fs.mkdir(downloadsDir, { recursive: true }).catch(() => {});
          
          const writer = require('fs').createWriteStream(outputPath);
          videoResponse.data.pipe(writer);
          
          await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
          });
          
          const stats = await fs.stat(outputPath);
          
          res.json({
            success: true,
            filePath: outputPath,
            filename: filename,
            fileSize: stats.size,
            platform: 'facebook',
            title: title,
            contentType: format,
            note: 'Downloaded via SnapSave.App API'
          });
          return;
        }
      } catch (snapSaveError) {
        console.log('Facebook: Both APIs failed, creating info file...', snapSaveError.message);
      }
    }
    
    // If all APIs fail, create an informative text file
    const infoContent = `Facebook Download Status\\n\\nURL: ${url}\\n\\nStatus: Facebook download services temporarily unavailable\\n\\nThis can happen when:\\n1. Facebook updates their security measures\\n2. Download services are under maintenance\\n3. The video is private or requires login\\n4. Network connectivity issues\\n5. Geographic restrictions\\n\\nAlternatives:\\n1. Try again in a few minutes\\n2. Use Facebook app's built-in save feature\\n3. Contact the content creator for sharing\\n4. Screen record if legally permitted\\n\\nDownloaded: ${new Date().toISOString()}`;
    
    const infoFilename = `Facebook_Info_${timestamp}.txt`;
    const infoPath = path.join(__dirname, 'downloads', infoFilename);
    
    await fs.writeFile(infoPath, infoContent, 'utf8');
    const stats = await fs.stat(infoPath);
    
    res.json({
      success: true,
      filePath: infoPath,
      filename: infoFilename,
      fileSize: stats.size,
      platform: 'facebook',
      title: 'Facebook Download Temporarily Unavailable',
      contentType: 'text',
      note: 'Download services temporarily unavailable - try again later'
    });

  } catch (error) {
    console.error('Facebook download error:', error);
    res.status(500).json({ 
      error: 'Failed to process Facebook URL',
      details: error.message 
    });
  }
});

// LinkedIn download endpoint using ContentStudio API for enhanced access
app.post('/api/linkedin', async (req, res) => {
  try {
    const { url, format = 'video' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('LinkedIn: Processing URL via enhanced content extraction:', url);
    
    const timestamp = Date.now();
    
    try {
      // Try to extract LinkedIn content using web scraping techniques
      const linkedinResponse = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 15000
      });
      
      const $ = cheerio.load(linkedinResponse.data);
      let title = 'LinkedIn Post';
      let content = '';
      let author = 'LinkedIn User';
      let hasVideo = false;
      let videoUrl = null;
      
      // Extract post title/content
      const titleElement = $('.feed-shared-text, .attributed-text-segment-list__content, .feed-shared-inline-show-more-text').first();
      if (titleElement.length) {
        content = titleElement.text().trim();
        title = content.substring(0, 100) || 'LinkedIn Post';
      }
      
      // Extract author name
      const authorElement = $('.feed-shared-actor__name, .feed-shared-actor__title, .update-components-actor__name').first();
      if (authorElement.length) {
        author = authorElement.text().trim() || 'LinkedIn User';
      }
      
      // Look for video content
      $('video source, video').each((i, element) => {
        const src = $(element).attr('src');
        if (src) {
          videoUrl = src;
          hasVideo = true;
          return false;
        }
      });
      
      // If video found, try to download it
      if (hasVideo && videoUrl) {
        try {
          const videoResponse = await axios.get(videoUrl, {
            responseType: 'stream',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
              'Referer': 'https://www.linkedin.com/'
            },
            timeout: 30000
          });
          
          const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
          const extension = format === 'video' ? 'mp4' : 'm4a';
          const filename = `${safeTitle}_${timestamp}.${extension}`;
          const outputPath = path.join(__dirname, 'downloads', filename);
          
          const downloadsDir = path.join(__dirname, 'downloads');
          await fs.mkdir(downloadsDir, { recursive: true }).catch(() => {});
          
          const writer = require('fs').createWriteStream(outputPath);
          videoResponse.data.pipe(writer);
          
          await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
          });
          
          const stats = await fs.stat(outputPath);
          
          res.json({
            success: true,
            filePath: outputPath,
            filename: filename,
            fileSize: stats.size,
            platform: 'linkedin',
            title: title,
            uploader: author,
            contentType: format,
            note: 'LinkedIn video extracted'
          });
          return;
        } catch (videoError) {
          console.log('LinkedIn: Video download failed, saving as text...', videoError.message);
        }
      }
      
      // If no video or video download failed, save as text post
      const postContent = `LinkedIn Post\n\nTitle: ${title}\n\nAuthor: ${author}\n\nContent: ${content || 'Content extraction limited - LinkedIn requires login for full access'}\n\nOriginal URL: ${url}\n\nNote: LinkedIn restricts content access to maintain professional privacy and security.\n\nDownloaded: ${new Date().toISOString()}`;
      
      const safeTitle = (title || 'LinkedIn_Post').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
      const filename = `${safeTitle}_${timestamp}.txt`;
      const outputPath = path.join(__dirname, 'downloads', filename);
      
      const downloadsDir = path.join(__dirname, 'downloads');
      await fs.mkdir(downloadsDir, { recursive: true }).catch(() => {});
      
      await fs.writeFile(outputPath, postContent, 'utf8');
      const stats = await fs.stat(outputPath);
      
      res.json({
        success: true,
        filePath: outputPath,
        filename: filename,
        fileSize: stats.size,
        platform: 'linkedin',
        title: title,
        uploader: author,
        contentType: 'text',
        note: 'LinkedIn content extracted (limited access)',
        description: content
      });
      
    } catch (linkedinError) {
      console.log('LinkedIn: Content extraction failed, creating info file...', linkedinError.message);
      
      // If extraction fails, create an informative text file
      const infoContent = `LinkedIn Download Status\n\nURL: ${url}\n\nStatus: LinkedIn content access restricted\n\nLinkedIn enforces strict privacy and authentication requirements:\n1. Professional content protection\n2. User privacy safeguards\n3. Corporate security measures\n4. Network access restrictions\n\nAlternatives:\n1. Use LinkedIn's built-in save features\n2. Screenshot important content\n3. Share or bookmark posts\n4. Contact the author directly via LinkedIn\n5. Export your own content via LinkedIn's data export\n\nLinkedIn's restrictions help maintain:\n- Professional network integrity\n- User privacy protection\n- Content creator rights\n- Platform security\n\nDownloaded: ${new Date().toISOString()}`;
      
      const infoFilename = `LinkedIn_Info_${timestamp}.txt`;
      const infoPath = path.join(__dirname, 'downloads', infoFilename);
      
      await fs.writeFile(infoPath, infoContent, 'utf8');
      const stats = await fs.stat(infoPath);
      
      res.json({
        success: true,
        filePath: infoPath,
        filename: infoFilename,
        fileSize: stats.size,
        platform: 'linkedin',
        title: 'LinkedIn Access Information',
        contentType: 'text',
        note: 'LinkedIn content access restricted - info provided'
      });
    }

  } catch (error) {
    console.error('LinkedIn download error:', error);
    res.status(500).json({ 
      error: 'Failed to process LinkedIn URL',
      details: error.message 
    });
  }
});

// Generic download endpoint for other platforms
app.post('/api/download', async (req, res) => {
  try {
    const { url, platform } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Use yt-dlp for generic downloads
    const ytdlp = spawn('/Users/username/Library/Python/3.9/bin/yt-dlp', [
      '--get-url',
      '--format', 'best',
      url
    ]);

    let downloadUrl = '';
    let errorOutput = '';

    ytdlp.stdout.on('data', (data) => {
      downloadUrl += data.toString();
    });

    ytdlp.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ytdlp.on('close', (code) => {
      if (code === 0 && downloadUrl.trim()) {
        res.json({
          success: true,
          downloadUrl: downloadUrl.trim(),
          platform: platform || 'unknown'
        });
      } else {
        console.error('Generic yt-dlp error:', errorOutput);
        res.status(500).json({ 
          error: 'Failed to get download URL',
          details: errorOutput
        });
      }
    });

  } catch (error) {
    console.error('Generic download error:', error);
    res.status(500).json({ 
      error: 'Failed to process URL',
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

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`Social Media Downloader Backend running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log('Available endpoints:');
  console.log('  POST /api/youtube - Download YouTube videos');
  console.log('  POST /api/youtube-ytdlp - Download YouTube videos using yt-dlp');
  console.log('  POST /api/instagram - Download Instagram content using Instaloader');
  console.log('  POST /api/tiktok - Download TikTok videos');
  console.log('  POST /api/twitter - Download Twitter/X videos and posts');
  console.log('  POST /api/podcast - Download podcast episodes from RSS feeds');
  console.log('  POST /api/facebook - Download Facebook videos');
  console.log('  POST /api/linkedin - Download LinkedIn videos and posts');
  console.log('  POST /api/download - Generic download endpoint');
});

module.exports = app;