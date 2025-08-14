// API Configuration
const isDevelopment = __DEV__;

export const API_CONFIG = {
  // Use Universal Backend with 6-tier fallback system
  BASE_URL: isDevelopment ? 'http://192.168.1.239:3000' : 'https://detachbackendcore-production.up.railway.app',
  
  // API endpoints for universal backend
  ENDPOINTS: {
    HEALTH: '/health',
    DOWNLOAD: '/download', // Universal endpoint for all platforms
    PLATFORMS: '/platforms', // Get supported platforms
    FILE: '/file' // File serving endpoint
  },
  
  // Legacy endpoints (kept for backward compatibility)
  LEGACY_ENDPOINTS: {
    YOUTUBE: '/api/youtube',
    YOUTUBE_MUSIC: '/api/youtube-music',
    SPOTIFY: '/api/spotify',
    INSTAGRAM: '/api/instagram',
    TIKTOK: '/api/tiktok',
    TWITTER: '/api/twitter',
    PODCAST: '/api/podcast',
    FACEBOOK: '/api/facebook',
    LINKEDIN: '/api/linkedin',
    PINTEREST: '/api/pinterest'
  }
};

// Helper function to get full API URL
export const getApiUrl = (endpoint: string) => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Helper function to get file URL
export const getFileUrl = (filename: string) => {
  return `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.FILE}/${filename}`;
};