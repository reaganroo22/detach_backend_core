#!/bin/bash

# VPS Deployment Script for Detach Backend
# AWS EC2 Ubuntu 22.04 LTS Setup

set -e

echo "🚀 Starting VPS deployment for Detach Backend..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
echo "📦 Installing Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Chrome dependencies
echo "📦 Installing Chrome dependencies..."
sudo apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    libxss1 \
    libgconf-2-4

# Install Google Chrome
echo "📦 Installing Google Chrome..."
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt-get update
sudo apt-get install -y google-chrome-stable

# Install PM2 for process management
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Create app directory
echo "📁 Setting up application directory..."
sudo mkdir -p /opt/detach-backend
sudo chown $USER:$USER /opt/detach-backend
cd /opt/detach-backend

# Clone backend code (assuming git repo)
echo "📥 Cloning backend code..."
# Replace with your actual repo URL
git clone https://github.com/yourusername/detach-backend.git .

# Install dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Install Playwright browsers
echo "📦 Installing Playwright browsers..."
npx playwright install chromium
npx playwright install-deps

# Create downloads directory
echo "📁 Creating downloads directory..."
mkdir -p downloads
chmod 755 downloads

# Create environment file
echo "📝 Creating environment configuration..."
cat > .env << EOF
NODE_ENV=production
PORT=3000
DOWNLOADS_DIR=/opt/detach-backend/downloads
CHROME_EXECUTABLE_PATH=/usr/bin/google-chrome
HEADLESS=true
EOF

# Create PM2 ecosystem file
echo "📝 Creating PM2 configuration..."
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'detach-backend',
    script: 'bulletproof-backend.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# Create logs directory
mkdir -p logs

# Setup nginx (optional but recommended)
echo "📦 Installing and configuring Nginx..."
sudo apt-get install -y nginx

# Create nginx configuration
sudo tee /etc/nginx/sites-available/detach-backend << EOF
server {
    listen 80;
    server_name your-domain.com;  # Replace with your actual domain

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Serve static files directly
    location /files/ {
        alias /opt/detach-backend/downloads/;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}
EOF

# Enable nginx site
sudo ln -sf /etc/nginx/sites-available/detach-backend /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

# Setup firewall
echo "🔥 Configuring firewall..."
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# Start the application
echo "🚀 Starting application with PM2..."
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

echo "✅ VPS deployment completed!"
echo ""
echo "🔗 Your backend should be accessible at: http://your-domain.com"
echo "📊 Health check: http://your-domain.com/health"
echo "📁 Files served at: http://your-domain.com/files/"
echo ""
echo "📋 Next steps:"
echo "1. Point your domain to this server's IP"
echo "2. Update your Expo app's API_CONFIG.BASE_URL"
echo "3. Test with: curl http://your-domain.com/health"
echo ""
echo "🛠️  Management commands:"
echo "  pm2 status          - Check app status"
echo "  pm2 logs detach-backend - View logs"
echo "  pm2 restart detach-backend - Restart app"
echo "  pm2 stop detach-backend - Stop app"