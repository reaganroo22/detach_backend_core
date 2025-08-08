// API Configuration
const isDevelopment = __DEV__;

export const API_CONFIG = {
  // Use production backend URL from Railway
  BASE_URL: 'https://detachbackend-production.up.railway.app',
  
  // API endpoints
  ENDPOINTS: {
    HEALTH: '/api/health',
    YOUTUBE: '/api/youtube-ytdlp',
    INSTAGRAM: '/api/instagram',
    TIKTOK: '/api/tiktok',
    TWITTER: '/api/twitter',
    PODCAST: '/api/podcast',
    FACEBOOK: '/api/facebook',
    LINKEDIN: '/api/linkedin',
    PINTEREST: '/api/pinterest',
    FILE: '/api/file'
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