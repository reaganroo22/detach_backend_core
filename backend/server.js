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

// Spotify download endpoint - using yt-dlp
app.post('/api/spotify', async (req, res) => {
  try {
    const { url, format = 'audio' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('Spotify: Processing URL:', url);
    
    // First, get content info
    const infoProcess = spawn('python3', ['-m', 'yt_dlp',
      '--print', '%(title)s|%(duration)s|%(uploader)s|%(album)s|%(artist)s',
      '--no-warnings',
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

// YouTube download endpoint using yt-dlp (direct download method)
app.post('/api/youtube-ytdlp', async (req, res) => {
  try {
    const { url, format = 'audio' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('YouTube: Processing URL:', url);
    console.log('YouTube: Requested format:', format);

    // First, get detailed video info using JSON output
    const infoProcess = spawn('python3', ['-m', 'yt_dlp',
      '--dump-json',
      '--no-warnings',
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

    console.log('YouTube raw contentInfo:', contentInfo.substring(0, 200) + '...');

    let parsedInfo;
    try {
      parsedInfo = JSON.parse(contentInfo.trim());
    } catch (e) {
      console.error('YouTube: Failed to parse JSON info:', e);
      throw new Error('Could not get video information');
    }

    const title = parsedInfo.title || 'YouTube Content';
    const duration = parsedInfo.duration;
    const uploader = parsedInfo.uploader || parsedInfo.channel;
    const viewCount = parsedInfo.view_count;

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

    const ytdlpProcess = spawn('python3', ['-m', 'yt_dlp',
      '--format', formatString,
      '--output', outputPath,
      '--no-warnings',
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
    
    // First, get content info (title, duration, etc.)
    const infoProcess = spawn('python3', ['-m', 'yt_dlp',
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
    const infoProcess = spawn('python3', ['-m', 'yt_dlp',
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
    
    // First, get content info
    const infoProcess = spawn('python3', ['-m', 'yt_dlp',
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
      const formatString = format === 'video' ? 'best[ext=mp4]/best' : 'bestaudio/best';
      
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

// Apple Podcasts download endpoint - using yt-dlp with direct download
app.post('/api/podcast', async (req, res) => {
  try {
    const { url, episodeIndex = 0 } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL or RSS feed is required' });
    }

    console.log('Podcast: Processing URL:', url);
    
    // First, get content info
    const infoProcess = spawn('python3', ['-m', 'yt_dlp',
      '--print', '%(title)s|%(uploader)s|%(description)s|%(duration)s',
      '--no-warnings',
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

    const [title, uploader, description, duration] = contentInfo.trim().split('|');
    
    // Generate filename - use M4A for Apple Podcasts for better React Native compatibility
    const safeTitle = (title || 'Podcast_Episode').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const timestamp = Date.now();
    const extension = url.includes('podcasts.apple.com') ? 'm4a' : 'mp3';
    const filename = `${safeTitle}_${timestamp}.${extension}`;
    const outputPath = path.join(__dirname, 'downloads', filename);

    // Ensure downloads directory exists
    const downloadsDir = path.join(__dirname, 'downloads');
    if (!await fs.access(downloadsDir).then(() => true).catch(() => false)) {
      await fs.mkdir(downloadsDir, { recursive: true });
    }

    // Download file directly with yt-dlp - for Apple Podcasts, request M4A format for React Native compatibility
    console.log('Podcast: Starting download...');
    let formatString = 'bestaudio/best';
    if (url.includes('podcasts.apple.com')) {
      formatString = 'bestaudio[ext=m4a]/bestaudio/best';
      console.log('Apple Podcasts detected, requesting M4A format for better React Native compatibility');
    }
    
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
      console.log('Podcast: yt-dlp exit code:', code);
      console.log('Podcast: stdout:', stdOutput);
      console.log('Podcast: stderr:', errorOutput);
      
      if (code === 0) {
        try {
          // Check if file was created and get its info
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
        } catch (fileError) {
          console.error('Podcast file check error:', fileError);
          res.status(500).json({ 
            error: 'File was not created successfully',
            details: fileError.message,
            suggestions: 'The download may have failed'
          });
        }
      } else {
        console.error('Podcast yt-dlp error:', errorOutput);
        res.status(500).json({ 
          error: 'Podcast download failed',
          details: errorOutput,
          suggestions: 'This podcast URL may not be supported. Try a different podcast URL.'
        });
      }
    });

  } catch (error) {
    console.error('Podcast download error:', error);
    res.status(500).json({ 
      error: 'Failed to process podcast URL',
      details: error.message 
    });
  }
});

// Facebook download endpoint - using yt-dlp with direct download
app.post('/api/facebook', async (req, res) => {
  try {
    const { url, format = 'video' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('Facebook: Processing URL:', url);
    
    // First, get content info using dump-json (more reliable for Facebook)
    const infoProcess = spawn('python3', ['-m', 'yt_dlp',
      '--dump-json',
      '--no-warnings',
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
      
      // For Facebook video URLs, assume it's a video even if parsing fails
      if (url.includes('/videos/')) {
        title = 'Facebook Video';
        duration = 30; // Assume video has content
        uploader = 'Facebook User';
        viewCount = null;
        console.log('Facebook: Assuming video content for /videos/ URL');
      } else {
        // Fallback to basic info
        title = 'Facebook Content';
        duration = null;
        uploader = 'Unknown';
        viewCount = null;
      }
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
      const formatString = format === 'video' ? 'best[ext=mp4]/best' : 'bestaudio/best';
      
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
    
    // First, get content info - try to get description/content as well
    const infoProcess = spawn('python3', ['-m', 'yt_dlp',
      '--print', '%(title)s|%(duration)s|%(uploader)s|%(view_count)s|%(description)s',
      '--no-warnings',
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

    const [title, duration, uploader, viewCount, description] = contentInfo.trim().split('|');
    
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
      const formatString = format === 'video' ? 'best[ext=mp4]/best' : 'bestaudio/best';
      
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

// Generic download endpoint for other platforms
app.post('/api/download', async (req, res) => {
  try {
    const { url, platform } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Use yt-dlp for generic downloads
    const ytdlp = spawn('python3', ['-m', 'yt_dlp',
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
    
    const ytdlpProcess = spawn('python3', ['-m', 'yt_dlp',
      '--extract-flat', 'false',
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
      platformFormat = format === 'audio' ? 'bestaudio/best' : 'best[height<=720]/best';
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
      '--extract-flat', 'false',
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

// Pinterest download endpoint - using yt-dlp with direct download
app.post('/api/pinterest', async (req, res) => {
  try {
    const { url, format = 'image' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('Pinterest: Processing URL:', url);
    
    // First, get content info
    const infoProcess = spawn('python3', ['-m', 'yt_dlp',
      '--print', '%(title)s|%(uploader)s|%(description)s',
      '--no-warnings',
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

    const [title, uploader, description] = contentInfo.trim().split('|');
    
    // Generate filename - Pinterest is primarily images
    const safeTitle = (title || 'Pinterest_Pin').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const timestamp = Date.now();
    const extension = 'jpg'; // Pinterest content is typically images
    const filename = `${safeTitle}_${timestamp}.${extension}`;
    const outputPath = path.join(__dirname, 'downloads', filename);

    // Ensure downloads directory exists
    const downloadsDir = path.join(__dirname, 'downloads');
    if (!await fs.access(downloadsDir).then(() => true).catch(() => false)) {
      await fs.mkdir(downloadsDir, { recursive: true });
    }

    // Download file directly with yt-dlp
    console.log('Pinterest: Starting download...');
    const ytdlp = spawn('python3', ['-m', 'yt_dlp',
      '--output', outputPath,
      '--format', 'best', // Pinterest images
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
            contentType: 'image'
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

// 404 handler - must be last
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

const server = app.listen(PORT, () => {
  console.log(`Social Media Downloader Backend running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log('Available endpoints:');
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