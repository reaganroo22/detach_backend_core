# Use Node.js image with support for local Chrome
FROM node:18-alpine

# Set environment variables
ENV NODE_ENV=production
ENV DISPLAY=:99

# Install dependencies for Alpine including virtual display support
RUN apk add --no-cache \
    python3 \
    py3-pip \
    curl \
    xvfb \
    chromium \
    && python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip

# Add virtual environment to PATH
ENV PATH="/opt/venv/bin:$PATH"

# Install yt-dlp in virtual environment
RUN pip install yt-dlp

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

# Create startup script with virtual display
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'echo "🚀 Starting Universal Backend with local Chrome"' >> /app/start.sh && \
    echo 'echo "📺 Starting virtual display..."' >> /app/start.sh && \
    echo 'Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &' >> /app/start.sh && \
    echo 'sleep 2' >> /app/start.sh && \
    echo 'echo "🌟 Starting backend..."' >> /app/start.sh && \
    echo 'exec npm start' >> /app/start.sh && \
    chmod +x /app/start.sh && \
    ls -la /app/start.sh && \
    cat /app/start.sh

# Expose the port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application with virtual display
CMD ["/app/start.sh"]