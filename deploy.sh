#!/bin/bash

echo "🚀 Universal Social Media Downloader - Deployment Script"
echo "======================================================="

# Set deployment type
DEPLOYMENT_TYPE=${1:-docker}

case $DEPLOYMENT_TYPE in
  "docker")
    echo "📦 Deploying with Docker..."
    
    # Build and run with docker-compose
    echo "🔨 Building Docker image..."
    docker-compose build
    
    echo "🏃 Starting services..."
    docker-compose up -d
    
    echo "⏳ Waiting for services to be healthy..."
    sleep 30
    
    echo "🧪 Testing deployment..."
    curl -f http://localhost:3000/health || {
      echo "❌ Health check failed"
      docker-compose logs universal-downloader
      exit 1
    }
    
    echo "✅ Docker deployment successful!"
    echo "🔗 Server: http://localhost:3000"
    echo "📊 Health: http://localhost:3000/health"
    echo "📱 Platforms: http://localhost:3000/platforms"
    ;;
    
  "browserless")
    echo "🌐 Deploying with Browserless..."
    
    # Start with browserless profile
    docker-compose --profile browserless up -d
    
    # Set browserless URL
    export BROWSERLESS_URL="ws://localhost:3001"
    
    echo "⏳ Waiting for services..."
    sleep 45
    
    echo "🧪 Testing browserless deployment..."
    curl -f http://localhost:3000/health || {
      echo "❌ Health check failed"
      docker-compose logs
      exit 1
    }
    
    echo "✅ Browserless deployment successful!"
    echo "🔗 Main Server: http://localhost:3000"
    echo "🌐 Browserless: http://localhost:3001"
    ;;
    
  "railway")
    echo "🚂 Deploying to Railway..."
    
    # Check if railway CLI is installed
    if ! command -v railway &> /dev/null; then
      echo "❌ Railway CLI not found. Install it first:"
      echo "npm install -g @railway/cli"
      exit 1
    fi
    
    # Deploy to Railway
    echo "🚀 Deploying to Railway..."
    railway up
    
    echo "✅ Railway deployment initiated!"
    echo "Check your Railway dashboard for deployment status."
    ;;
    
  "vercel")
    echo "▲ Deploying to Vercel..."
    
    # Check if vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
      echo "❌ Vercel CLI not found. Install it first:"
      echo "npm install -g vercel"
      exit 1
    fi
    
    # Deploy to Vercel
    echo "🚀 Deploying to Vercel..."
    vercel --prod
    
    echo "✅ Vercel deployment initiated!"
    ;;
    
  *)
    echo "❌ Unknown deployment type: $DEPLOYMENT_TYPE"
    echo "Available options:"
    echo "  docker      - Local Docker deployment"
    echo "  browserless - Docker with Browserless service"
    echo "  railway     - Deploy to Railway"
    echo "  vercel      - Deploy to Vercel"
    echo ""
    echo "Usage: ./deploy.sh [deployment_type]"
    exit 1
    ;;
esac

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Test the /download endpoint with your URLs"
echo "   2. Set up monitoring and logging"
echo "   3. Configure proxy rotation if needed"
echo "   4. Scale horizontally as needed"