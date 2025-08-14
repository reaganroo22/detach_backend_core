# 🚀 Universal Social Media Downloader - Deployment Guide

## 📋 Overview

This is a production-ready 5-tier fallback system for downloading social media content:

1. **GetLoady.com** - Google Video URLs via new tab detection
2. **SSVid.net** - Download files via 2.5min conversion wait  
3. **Squidlr.com** - Direct CDN URLs via cloud download icons
4. **Railway Backend** - Custom fallback (configurable)
5. **Vercel Backend** - Final fallback (configurable)

## 🔧 Browser Configuration

The system automatically detects and configures browsers for different environments:

- **Local Development**: Uses Chrome with GUI (headless=false)
- **Docker Production**: Uses virtual display with browsers
- **Browserless**: Connects to managed browser service
- **Cloud**: Environment-specific configurations

## 🚀 Deployment Options

### Option 1: Docker (Recommended)
```bash
# Basic Docker deployment
./deploy.sh docker

# With Browserless service
./deploy.sh browserless
```

### Option 2: Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy
./deploy.sh railway
```

### Option 3: Vercel
```bash
# Install Vercel CLI  
npm install -g vercel

# Deploy
./deploy.sh vercel
```

## 🌐 Environment Variables

```bash
# Browser service (optional)
BROWSERLESS_URL=wss://your-browserless-instance.com

# Proxy rotation (for future implementation)
PROXY_LIST=proxy1:port,proxy2:port,proxy3:port

# Production settings
NODE_ENV=production
PORT=3000
```

## 📡 API Endpoints

### Download Content
```http
POST /download
Content-Type: application/json

{
  "url": "https://www.youtube.com/shorts/0Pwt8wcSjmY"
}
```

### Health Check
```http
GET /health
```

### Supported Platforms
```http
GET /platforms
```

## 🔄 Platform Support Matrix

| Platform | GetLoady | SSVid.net | Squidlr |
|----------|----------|-----------|---------|
| YouTube | ✅ | ✅ | ❌ |
| Instagram | ✅ | ✅ | ✅ |
| TikTok | ✅ | ✅ | ✅ |
| Facebook | ✅ | ✅ | ✅ |
| Twitter | ✅ | ✅ | ✅ |
| LinkedIn | ✅ | ✅ | ✅ |
| Pinterest | ✅ | ✅ | ✅ |
| SoundCloud | ✅ | ✅ | ✅ |
| Vimeo | ✅ | ✅ | ✅ |
| Reddit | ✅ | ✅ | ✅ |

## 📊 Response Format

```json
{
  "url": "https://www.youtube.com/shorts/0Pwt8wcSjmY",
  "platform": "youtube",
  "success": true,
  "tiers": [
    {
      "tier": 1,
      "source": "getloady", 
      "success": false
    },
    {
      "tier": 2,
      "source": "ssvid",
      "success": true
    }
  ],
  "data": [
    {
      "tier": 2,
      "source": "ssvid",
      "type": "download_file",
      "url": "https://dl182.dmate20.online/?file=...",
      "filename": "video.mp4",
      "timestamp": "2025-08-13T22:27:52.901Z"
    }
  ],
  "timestamp": "2025-08-13T22:27:52.901Z"
}
```

## 🔍 Monitoring

- **Health Check**: `/health` endpoint with tier status
- **Logs**: JSON structured logging for production
- **Metrics**: Request/response times per tier
- **Alerts**: Failed tier notifications

## 🛡️ Security Features

- **User Agent Rotation**: Mimics real browsers
- **Anti-Detection**: Stealth browser configurations  
- **Rate Limiting**: Built-in request throttling
- **Proxy Support**: Ready for proxy rotation

## 📈 Scaling

- **Horizontal**: Multiple backend instances
- **Vertical**: Increase memory/CPU for browsers
- **Browser Pool**: Browserless service for high concurrency
- **CDN**: Cache successful downloads

## 🚨 Troubleshooting

### Common Issues

1. **Browser Launch Failed**
   - Ensure Docker has display support
   - Check BROWSERLESS_URL configuration
   - Verify system resources

2. **Timeout Errors**
   - Increase tier timeouts (default 2.5min)
   - Check network connectivity
   - Monitor target site changes

3. **Rate Limiting**
   - Implement proxy rotation
   - Add random delays
   - Distribute load across instances

## 🔄 Updates & Maintenance

- **Dependency Updates**: Regular Playwright updates
- **Site Changes**: Monitor target site changes
- **Performance**: Optimize tier timeouts
- **Features**: Add new platforms as needed

---

**Ready for Production!** 🎉

The system has been tested and verified with real URLs across all platforms.