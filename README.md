# Social Media Downloader - Expo App

A React Native Expo application for downloading social media content locally for intentional, offline consumption. This app helps you save content from various platforms and manage it mindfully.

## Features

- **Multi-Platform Support**: Download from YouTube, Instagram, TikTok, Facebook, Twitter/X, LinkedIn, and Pinterest
- **Local Storage**: All content is saved locally on your device for offline access
- **Progress Tracking**: Real-time download progress and status updates
- **Library Management**: Organize and manage your downloaded content
- **Intentional Design**: Built to promote mindful content consumption
- **Clean UI**: Simple, distraction-free interface

## Architecture

### Frontend (React Native Expo)
- **Main App**: `/app/(tabs)/` - Tab-based navigation
- **Download Service**: `/services/downloadService.ts` - Handles downloads and local storage
- **UI Components**: Clean, minimal design focused on functionality

### Backend (Node.js + Express)
- **API Server**: `/backend/server.js` - Provides download URLs
- **yt-dlp Integration**: Uses yt-dlp for reliable content extraction
- **Multiple Endpoints**: Separate endpoints for each platform

## Installation & Setup

### Prerequisites
1. **Node.js** (v16 or higher)
2. **Expo CLI**: `npm install -g @expo/cli`
3. **yt-dlp**: Required for the backend service

#### Installing yt-dlp
```bash
# macOS with Homebrew
brew install yt-dlp

# Or using pip
pip install yt-dlp
```

### Frontend Setup
1. Navigate to the project root:
```bash
cd "project 2"
```

2. Install dependencies:
```bash
npm install
```

3. Start the Expo development server:
```bash
npm run dev
```

### Backend Setup
1. Navigate to the backend directory:
```bash
cd backend
```

2. Install backend dependencies:
```bash
npm install
```

3. Start the backend server:
```bash
npm run dev
```

The backend will run on `http://localhost:3001`

## Usage

### Downloading Content
1. Open the app and go to the **Download** tab
2. Paste a URL from any supported platform
3. Tap **Download** to start the process
4. Monitor progress in real-time

### Managing Downloads
1. Go to the **Library** tab to see all downloads
2. Filter by status (All, Completed, Downloading, etc.)
3. View file locations, delete downloads, or access original URLs
4. Use "Clear All" to remove all downloads at once

### Supported URL Formats
- **YouTube**: `https://youtube.com/watch?v=...` or `https://youtu.be/...`
- **Instagram**: `https://instagram.com/p/...` or `https://instagram.com/reel/...`
- **TikTok**: `https://tiktok.com/@user/video/...`
- **Facebook**: `https://facebook.com/watch?v=...`
- **Twitter/X**: `https://twitter.com/.../status/...` or `https://x.com/.../status/...`

## Project Structure

```
project 2/
├── app/                          # Expo app source
│   ├── (tabs)/                   # Tab navigation
│   │   ├── index.tsx             # Download tab
│   │   ├── library.tsx           # Library/Downloads tab
│   │   └── settings.tsx          # Settings tab
│   └── _layout.tsx               # Root layout
├── services/                     # Business logic
│   └── downloadService.ts        # Download management
├── backend/                      # Backend API server
│   ├── server.js                 # Express server
│   ├── package.json              # Backend dependencies
│   └── README.md                 # Backend documentation
├── assets/                       # App assets
├── package.json                  # Frontend dependencies
└── README.md                     # This file
```

## Technical Details

### Download Process
1. **URL Validation**: Check if URL is valid and from supported platform
2. **Backend Request**: Send URL to appropriate backend endpoint
3. **URL Extraction**: Backend uses yt-dlp to get direct download URL
4. **File Download**: Frontend downloads file to local storage using Expo FileSystem
5. **Progress Tracking**: Real-time progress updates during download
6. **Storage Management**: File paths and metadata stored in AsyncStorage

### Platform Detection
The app automatically detects the platform based on the URL:
```typescript
if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
if (url.includes('instagram.com')) return 'instagram';
if (url.includes('tiktok.com')) return 'tiktok';
// ... etc
```

### Local Storage
- **Files**: Stored in `${FileSystem.documentDirectory}downloads/`
- **Metadata**: Stored in AsyncStorage under `@downloads` key
- **File Naming**: `{id}_{platform}_video.{ext}`

## API Endpoints

### Backend Endpoints
- `GET /api/health` - Health check
- `POST /api/youtube` - YouTube downloads (ytdl-core)
- `POST /api/youtube-ytdlp` - YouTube downloads (yt-dlp)
- `POST /api/instagram` - Instagram content
- `POST /api/tiktok` - TikTok videos
- `POST /api/download` - Generic platform support

### Request Format
```json
{
  "url": "https://platform.com/content"
}
```

### Response Format
```json
{
  "success": true,
  "downloadUrl": "https://direct-download-url.com/file.mp4",
  "platform": "youtube",
  "title": "Content Title",
  "duration": 300
}
```

## Development

### Adding New Platforms
1. Update platform detection in `downloadService.ts`
2. Add new backend endpoint in `server.js`
3. Test with platform-specific URLs

### Debugging
- Frontend: Use Expo developer tools and React Native Debugger
- Backend: Check console logs for yt-dlp output and errors
- Network: Monitor API requests in the app

## Legal & Ethical Considerations

⚠️ **Important**: This app is designed for educational and personal use only.

- **Respect Copyright**: Only download content you have permission to download
- **Terms of Service**: Comply with each platform's terms of service
- **Creator Rights**: Respect content creators' intellectual property
- **Fair Use**: Understand fair use laws in your jurisdiction
- **Personal Use**: Keep downloads for personal, non-commercial use

## Troubleshooting

### Common Issues

**Backend not responding**
- Check if backend is running on port 3001
- Verify yt-dlp is installed: `yt-dlp --version`

**Downloads failing**
- Update yt-dlp: `pip install --upgrade yt-dlp`
- Check if URL is publicly accessible
- Some platforms may block automated downloads

**App crashes**
- Clear Expo cache: `expo r -c`
- Restart Metro bundler
- Check for console errors

**Storage issues**
- Check device storage space
- Verify file permissions
- Clear app data if needed

## Contributing

This project is designed for personal use and spiritual growth. If you'd like to contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Purpose & Philosophy

This app was created to support intentional, mindful consumption of digital content. Instead of endless scrolling and reactive consumption, it encourages:

- **Intentional Selection**: Consciously choose what content to save
- **Offline Consumption**: Reduce screen time and distractions
- **Mindful Engagement**: Focus on meaningful content without algorithmic interference
- **Digital Minimalism**: Curate a personal library of valuable content

## License

This project is provided as-is for educational and personal use. Please ensure compliance with all applicable laws and platform terms of service.

---

*"Be still and know that I am God." - Psalm 46:10*

Built with intention for mindful digital living.