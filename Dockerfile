# Use lightweight Node.js image since we're using browserless.io
FROM node:18-alpine

# Set environment variables
ENV NODE_ENV=production

# Install dependencies for Alpine
RUN apk add --no-cache \
    python3 \
    py3-pip \
    curl

# Install yt-dlp
RUN pip3 install yt-dlp

# Set the working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the application code
COPY . .

# Create directories
RUN mkdir -p /app/downloads

# Create startup script (no Xvfb needed with browserless.io)
RUN echo '#!/bin/sh\necho "🚀 Starting Universal Backend with browserless.io"\nexec npm start' > /app/start.sh

RUN chmod +x /app/start.sh

# Expose the port (Railway uses PORT env var)
EXPOSE $PORT

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

# Start the application with virtual display
CMD ["/app/start.sh"]