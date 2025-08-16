# Use official Playwright image with Ubuntu and pre-installed Chrome
FROM mcr.microsoft.com/playwright:v1.54.0-noble

# Set environment variables
ENV NODE_ENV=production
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Set the working directory
WORKDIR /app

# Install additional dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --omit=dev

# Install Playwright browsers for Patchright
RUN npx playwright install chromium --force
RUN npx patchright install chromium --force || npx playwright install chromium --force

# Copy the application code
COPY . .

# Create directories
RUN mkdir -p /app/downloads

# Expose the port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["npm", "start"]