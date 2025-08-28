# 🚀 VPS Setup Guide for Detach App

## 📋 Prerequisites

1. **AWS EC2 Instance** (Recommended: t3.small, Ubuntu 22.04 LTS, 30GB storage)
2. **Domain name** pointing to your EC2 IP address
3. **SSH access** to your server

## 🛠️ Step 1: Launch EC2 Instance

```bash
# Instance specs:
- AMI: Ubuntu 22.04 LTS
- Type: t3.small (2 vCPU, 2GB RAM)
- Storage: 30GB gp3
- Security Group: Allow ports 22 (SSH), 80 (HTTP), 443 (HTTPS)
```

## 🔧 Step 2: Deploy Backend

1. **SSH to your server:**
```bash
ssh -i your-key.pem ubuntu@your-server-ip
```

2. **Make deployment script executable:**
```bash
chmod +x detach_backend_core/vps-deploy.sh
```

3. **Run deployment:**
```bash
cd detach_backend_core
./vps-deploy.sh
```

## 🌐 Step 3: Configure Domain

1. **Point your domain to EC2 IP** in your DNS provider
2. **Update domain in files:**

```bash
# Edit nginx config
sudo nano /etc/nginx/sites-available/detach-backend
# Replace "your-domain.com" with actual domain

# Edit environment config
nano /opt/detach-backend/production.env
# Update DOMAIN and BASE_URL
```

3. **Restart services:**
```bash
sudo systemctl restart nginx
pm2 restart detach-backend
```

## 📱 Step 4: Update Expo App

**In your Expo project, update the API URL:**

File: `config/api.ts`
```typescript
// Replace with your actual domain
return 'https://your-actual-domain.com';
```

## 🧪 Step 5: Test the Setup

1. **Test backend health:**
```bash
curl https://your-domain.com/health
```

2. **Test download endpoint:**
```bash
curl -X POST https://your-domain.com/download \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

3. **Test from Expo app:**
   - Open your app
   - Try downloading a video
   - Check if files download correctly

## 🔐 Step 6: SSL Setup (Optional but Recommended)

Install Let's Encrypt SSL certificate:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
sudo systemctl restart nginx
```

## 📊 Monitoring Commands

```bash
# Check app status
pm2 status

# View logs
pm2 logs detach-backend

# Monitor system resources
htop

# Check nginx status
sudo systemctl status nginx

# Check disk usage
df -h
```

## 🛠️ Troubleshooting

### Backend not starting:
```bash
pm2 logs detach-backend --lines 50
```

### Browser automation failing:
```bash
# Check Chrome installation
google-chrome --version

# Check display
echo $DISPLAY
```

### File serving issues:
```bash
# Check downloads directory
ls -la /opt/detach-backend/downloads/

# Check nginx file serving
curl https://your-domain.com/files/
```

## 🚀 Expected Results

After successful setup:

✅ **Health check**: `https://your-domain.com/health` returns status  
✅ **File serving**: Downloaded files accessible at `https://your-domain.com/files/filename.mp4`  
✅ **Expo app**: Downloads working .mp4/.mp3 files instead of 237-byte errors  
✅ **Browser automation**: GetLoady, SSVid, Squidlr working with proper Chrome  

## 💰 Estimated Costs

- **t3.small EC2**: ~$18/month
- **30GB EBS storage**: ~$3/month
- **Data transfer**: ~$1-5/month depending on usage
- **Total**: ~$22-26/month

---

**Your app should now be fully functional with real video downloads! 🎉**