# 🚂 Railway Deployment Guide

## Universal Social Media Downloader Backend

This guide covers deploying the Universal Backend (Tiers 1-6) to Railway with full browser automation support.

## 🏗️ Architecture

- **Universal Backend** (Railway) - Browser automation + orchestration
- **Existing Backend** (Railway) - yt-dlp API (Tier 4)
- **Existing Backend** (Vercel) - yt-dlp API (Tier 5)

## 🚀 Deployment Steps

### 1. Railway Project Setup

```bash
# Install Railway CLI (if not already installed)
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize new Railway project
railway init
```

### 2. Environment Configuration

Set these environment variables in Railway dashboard:

```bash
NODE_ENV=production
DISPLAY=:99
RAILWAY_UNIVERSAL_BACKEND=true
RAILWAY_API_URL=https://detachbackend-production.up.railway.app
VERCEL_API_URL=https://detach-backend-454ebn3bh-detach1.vercel.app
```

### 3. Resource Requirements

**Recommended Railway Plan:**
- **Memory**: 2GB minimum (for browser automation)
- **CPU**: 2 vCPU minimum
- **Disk**: 1GB (for browser cache and downloads)

### 4. Deploy

```bash
# Deploy to Railway
railway up
```

## 🔧 Configuration Details

### Docker Setup
- **Base Image**: Ubuntu 22.04 with Node.js 18
- **Browser**: Chromium via Playwright
- **Display**: Xvfb virtual display (:99)
- **yt-dlp**: Pre-installed for Tier 6 fallback

### Browser Configuration
- Non-headless mode with virtual display
- Anti-detection measures enabled
- Optimized for social media platforms
- Stealth mode configurations

### Health Checks
- Endpoint: `/health`
- Timeout: 300s (for browser startup)
- Retries: 3 attempts

## 📊 Monitoring

### Endpoints
- **Health**: `https://your-app.railway.app/health`
- **Platforms**: `https://your-app.railway.app/platforms`
- **Download**: `POST https://your-app.railway.app/download`

### Logs
Monitor Railway logs for:
- Browser startup messages
- Tier execution flow
- Download success/failure rates
- Performance metrics

## 🚨 Troubleshooting

### Common Issues

**Browser Launch Failed:**
```
✅ Check DISPLAY environment variable
✅ Verify Xvfb is running
✅ Increase memory allocation
```

**Timeout Errors:**
```
✅ Increase healthcheck timeout
✅ Check tier-specific timeouts
✅ Monitor network connectivity
```

**Memory Issues:**
```
✅ Upgrade Railway plan
✅ Monitor browser memory usage
✅ Implement browser restart logic
```

## 🔄 Updates

### Deployment Updates
```bash
# Update deployment
git add .
git commit -m "Update: [description]"
git push
railway deploy
```

### Configuration Updates
- Update environment variables in Railway dashboard
- Restart service after config changes
- Monitor logs for successful startup

## 📈 Scaling

### Horizontal Scaling
- Deploy multiple instances
- Use load balancer
- Implement sticky sessions for downloads

### Performance Optimization
- Browser pool management
- Memory cleanup routines
- Request queue management

---

**Ready for Production!** 🎉

This configuration provides a robust, scalable universal social media downloader with full browser automation support on Railway.