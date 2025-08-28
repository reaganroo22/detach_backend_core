/**
 * YOUTUBE DOWNLOADER with Sieve API
 * Working solution for YouTube downloads
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const SIEVE_API_KEY = '9fl080LLznbw-uENx23VQXLYlalBMxFye4RlhAMNgB8';

function detectPlatform(url) {
  const cleanUrl = url.toLowerCase();
  if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) return 'youtube';
  if (cleanUrl.includes('instagram.com')) return 'instagram';
  if (cleanUrl.includes('tiktok.com')) return 'tiktok';
  if (cleanUrl.includes('twitter.com') || cleanUrl.includes('x.com')) return 'twitter';
  if (cleanUrl.includes('facebook.com')) return 'facebook';
  return 'unknown';
}

// Sieve API YouTube Downloader
async function downloadWithSieveAPI(url, userPrefs) {
  console.log(`🎯 Sieve API: Starting YouTube download for ${url}`);
  
  try {
    // Step 1: Push job to Sieve API
    const jobResponse = await axios.post('https://mango.sievedata.com/v2/push', {
      function: 'sieve/youtube-downloader',
      inputs: {
        url: url,
        download_type: userPrefs.format === 'audio' ? 'audio' : 'video',
        resolution: 'highest-available',
        include_audio: true,
        start_time: 0,
        end_time: -1,
        include_metadata: false,
        metadata_fields: [],
        include_subtitles: false,
        subtitle_languages: [],
        video_format: 'mp4',
        audio_format: userPrefs.format === 'audio' ? 'mp3' : 'mp4',
        subtitle_format: 'vtt'
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': SIEVE_API_KEY
      },
      timeout: 30000
    });

    const jobId = jobResponse.data.id;
    console.log(`📋 Sieve API: Job created with ID ${jobId}`);

    // Step 2: Poll for job completion
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max
    
    while (attempts < maxAttempts) {
      console.log(`🔄 Sieve API: Checking job status (attempt ${attempts + 1}/${maxAttempts})`);
      
      const statusResponse = await axios.get(`https://mango.sievedata.com/v2/jobs/${jobId}`, {
        headers: {
          'X-API-Key': SIEVE_API_KEY
        },
        timeout: 10000
      });

      const status = statusResponse.data.status;
      console.log(`📊 Sieve API: Job status is ${status}`);

      if (status === 'finished') {
        const outputs = statusResponse.data.outputs;
        if (outputs && outputs.length > 0) {
          const downloadUrl = outputs[0].data.url;
          console.log(`✅ Sieve API: Download completed successfully`);
          console.log(`🔗 Download URL: ${downloadUrl.substring(0, 100)}...`);
          
          return {
            success: true,
            data: {
              downloadUrl: downloadUrl,
              method: 'sieve_api',
              service: 'sieve',
              quality: 'HD',
              tier: 1,
              tierName: 'Sieve API'
            }
          };
        }
      } else if (status === 'failed' || status === 'error') {
        throw new Error(`Sieve job failed with status: ${status}`);
      }

      // Wait 5 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }

    throw new Error('Sieve job timed out after 5 minutes');
  } catch (error) {
    console.error(`❌ Sieve API error: ${error.message}`);
    throw error;
  }
}

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'sieve-youtube-downloader',
    timestamp: new Date().toISOString()
  });
});

// Main download endpoint
app.post('/download', async (req, res) => {
  const { url, format, audioQuality, videoQuality } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  console.log(`🚀 Download request: ${url}`);
  
  const platform = detectPlatform(url);
  const userPrefs = {
    format: format || 'audio',
    audioQuality: audioQuality || 'high',
    videoQuality: videoQuality || 'medium'
  };
  
  try {
    if (platform === 'youtube') {
      const sieveResult = await downloadWithSieveAPI(url, userPrefs);
      if (sieveResult.success) {
        return res.json({
          success: true,
          url: url,
          platform: platform,
          data: sieveResult.data,
          userPreferences: userPrefs,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Fallback for non-YouTube platforms
    return res.status(501).json({
      success: false,
      error: `Platform ${platform} not supported yet`,
      url: url,
      platform: platform,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`❌ Download error: ${error.message}`);
    
    res.status(500).json({
      success: false,
      error: `Download failed: ${error.message}`,
      url: url,
      platform: platform,
      timestamp: new Date().toISOString()
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Sieve YouTube Downloader listening on port ${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 Download endpoint: http://localhost:${PORT}/download`);
});

module.exports = app;