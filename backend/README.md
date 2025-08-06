# Social Media Downloader Backend

This is the backend service for the social media downloader app. It provides APIs to get download URLs for content from various platforms.

## Prerequisites

1. **Node.js**: Install Node.js (v16 or higher)
2. **yt-dlp**: Install yt-dlp for downloading from most platforms

### Installing yt-dlp

#### macOS (using Homebrew)
```bash
brew install yt-dlp
```

#### macOS/Linux (using pip)
```bash
pip install yt-dlp
```

#### Windows
```bash
# Using pip
pip install yt-dlp

# Or download the executable from GitHub releases
# https://github.com/yt-dlp/yt-dlp/releases
```

## Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

Or for production:
```bash
npm start
```

The server will run on `http://localhost:3001`

## API Endpoints

### Health Check
- **GET** `/api/health` - Check if the server is running

### Download Endpoints
- **POST** `/api/youtube` - Download YouTube videos (using ytdl-core)
- **POST** `/api/youtube-ytdlp` - Download YouTube videos (using yt-dlp)
- **POST** `/api/instagram` - Download Instagram content
- **POST** `/api/tiktok` - Download TikTok videos
- **POST** `/api/download` - Generic download endpoint for other platforms

### Request Format
All POST endpoints expect JSON with the following structure:
```json
{
  "url": "https://example.com/video"
}
```

### Response Format
Successful responses:
```json
{
  "success": true,
  "downloadUrl": "https://direct-download-url.com/video.mp4",
  "platform": "youtube",
  "title": "Video Title (if available)",
  "duration": "Duration in seconds (if available)"
}
```

Error responses:
```json
{
  "error": "Error message",
  "details": "Detailed error information"
}
```

## Supported Platforms

- YouTube (videos, playlists)
- Instagram (posts, stories, reels)
- TikTok (videos)
- Facebook (videos)
- Twitter/X (videos)
- And many more supported by yt-dlp

## Important Notes

1. **Legal Compliance**: Only download content you have permission to download
2. **Rate Limiting**: Be respectful of platform rate limits
3. **Terms of Service**: Respect the terms of service of each platform
4. **Content Creator Rights**: Always respect content creators' rights

## Troubleshooting

### yt-dlp not found
If you get errors about yt-dlp not being found:
1. Make sure yt-dlp is installed and in your PATH
2. Try running `yt-dlp --version` in your terminal
3. On some systems, you might need to use `python -m yt_dlp` instead

### YouTube downloads failing
- Update yt-dlp: `pip install --upgrade yt-dlp`
- YouTube frequently changes their API, so keep yt-dlp updated

### Instagram/TikTok downloads failing
- These platforms frequently change their APIs
- Update yt-dlp regularly
- Some content may not be downloadable due to privacy settings

## Development

### Adding New Platforms
To add support for a new platform, create a new endpoint following the existing pattern:

```javascript
app.post('/api/newplatform', async (req, res) => {
  // Implementation similar to existing endpoints
});
```

### Logging
All requests are logged with timestamps. Check the console output for debugging information.

### Error Handling
The server includes comprehensive error handling and will return appropriate HTTP status codes and error messages.