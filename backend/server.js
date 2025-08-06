const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

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

// Instagram download endpoint using yt-dlp with better error handling
app.post('/api/instagram', async (req, res) => {
  try {
    const { url, format = 'video' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('Instagram: Processing URL:', url);
    
    // First, get content info (title, duration, etc.)
    const infoProcess = spawn('/Users/username/Library/Python/3.9/bin/yt-dlp', [
      '--print', '%(title)s|%(duration)s|%(uploader)s|%(view_count)s|%(webpage_url)s',
      '--no-warnings',
      '--extractor-args', 'instagram:api_key=',
      '--user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
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

    const [title, duration, uploader, viewCount, webpageUrl] = contentInfo.trim().split('|');

    // Detect content type - if no duration, it's likely an image post
    const isImagePost = !duration || duration === 'null' || parseInt(duration) === 0;
    
    // Generate filename based on detected content type
    const safeTitle = (title || 'Instagram_Content').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
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
      formatString = format === 'video' ? 'best[ext=mp4]/best' : 'bestaudio/best';
    }

    console.log('Instagram: Starting download with format:', formatString);
    const ytdlp = spawn('/Users/username/Library/Python/3.9/bin/yt-dlp', [
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
    const infoProcess = spawn('/Users/username/Library/Python/3.9/bin/yt-dlp', [
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

    const [title, duration, uploader, viewCount, formatNote] = contentInfo.trim().split('|');
    
    // Check if this is a slideshow (multiple images) - duration will be null/undefined for images
    const isSlideshow = !duration || duration === 'null' || parseInt(duration) === 0;

    // Generate filename based on content type
    const safeTitle = (title || 'TikTok_Content').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
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
    const ytdlp = spawn('/Users/username/Library/Python/3.9/bin/yt-dlp', [
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
    
    // First, get content info
    const infoProcess = spawn('/Users/username/Library/Python/3.9/bin/yt-dlp', [
      '--print', '%(title)s|%(duration)s|%(uploader)s|%(view_count)s',
      '--no-warnings',
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

    if (hasVideo) {
      // Download video/audio with yt-dlp
      const formatString = format === 'video' ? 'best[ext=mp4]/best' : 'bestaudio/best';
      
      const ytdlp = spawn('/Users/username/Library/Python/3.9/bin/yt-dlp', [
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
              contentType: contentType
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
      // Create a text file with tweet info
      const tweetInfo = `Twitter Post: ${title || 'No title'}\nUploader: ${uploader || 'Unknown'}\nURL: ${normalizedUrl}\nDownloaded: ${new Date().toISOString()}`;
      
      try {
        await fs.writeFile(outputPath, tweetInfo, 'utf8');
        const stats = await fs.stat(outputPath);
        
        res.json({
          success: true,
          filePath: outputPath,
          filename: filename,
          fileSize: stats.size,
          platform: 'twitter',
          title: title || 'Twitter Post',
          uploader: uploader || undefined,
          contentType: 'text'
        });
      } catch (writeError) {
        console.error('Twitter text file creation error:', writeError);
        res.status(500).json({ 
          error: 'Failed to create text file',
          details: writeError.message
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
          
          console.log('Podcast: yt-dlp failed, would need RSS parsing fallback');
          res.status(500).json({ 
            error: 'Podcast download failed',
            details: downloadError,
            suggestions: 'Try a direct RSS feed URL or different podcast URL'
          });
        });
        return;
      }
    }
    
    res.status(500).json({ 
      error: 'Podcast download not fully implemented',
      details: 'RSS parsing requires additional dependencies',
      suggestions: 'Use Apple Podcasts URLs for now'
    });

  } catch (error) {
    console.error('Podcast download error:', error);
    res.status(500).json({ 
      error: 'Failed to process podcast URL',
      details: error.message 
    });
  }
});

// Facebook download endpoint - basic implementation
app.post('/api/facebook', async (req, res) => {
  try {
    const { url, format = 'video' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('Facebook: Processing URL:', url);
    
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
          platform: 'facebook',
          title: 'Facebook Video',
          contentType: format
        });
      } else {
        console.error('Facebook yt-dlp failed:', errorOutput);
        res.status(500).json({ 
          error: 'Facebook download failed',
          details: errorOutput,
          suggestions: 'Facebook may require authentication or the video may not be accessible'
        });
      }
    });

  } catch (error) {
    console.error('Facebook download error:', error);
    res.status(500).json({ 
      error: 'Failed to process Facebook URL',
      details: error.message 
    });
  }
});

// LinkedIn download endpoint - basic implementation
app.post('/api/linkedin', async (req, res) => {
  try {
    const { url, format = 'video' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('LinkedIn: Processing URL:', url);
    
    res.status(500).json({ 
      error: 'LinkedIn download not fully implemented',
      details: 'LinkedIn requires specialized handling',
      suggestions: 'Use LinkedIn\'s built-in save features'
    });

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
  console.log('  POST /api/instagram - Download Instagram content');
  console.log('  POST /api/tiktok - Download TikTok videos');
  console.log('  POST /api/twitter - Download Twitter/X videos and posts');
  console.log('  POST /api/podcast - Download podcast episodes from RSS feeds');
  console.log('  POST /api/facebook - Download Facebook videos');
  console.log('  POST /api/linkedin - Download LinkedIn videos and posts');
  console.log('  POST /api/download - Generic download endpoint');
});

module.exports = app;