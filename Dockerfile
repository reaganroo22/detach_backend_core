# Use official Playwright image with Node.js and browsers pre-installed
FROM mcr.microsoft.com/playwright:v1.40.0-focal

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV DISPLAY=:99
ENV NODE_ENV=production

# Install additional dependencies for Railway
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    xvfb \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp
RUN pip3 install yt-dlp

# Set the working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Install Playwright browsers explicitly
RUN npx playwright install chromium
RUN npx playwright install-deps chromium

# Copy the application code
COPY . .

# Create directories
RUN mkdir -p /app/downloads

# Create startup script
RUN echo '#!/bin/bash\n\
# Start Xvfb for virtual display\n\
Xvfb :99 -screen 0 1920x1080x24 &\n\
export DISPLAY=:99\n\
\n\
# Wait for display to be ready\n\
sleep 2\n\
\n\
# Start the application\n\
exec npm start' > /app/start.sh

RUN chmod +x /app/start.sh

# Expose the port (Railway uses PORT env var)
EXPOSE $PORT

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

# Start the application with virtual display
CMD ["/app/start.sh"]