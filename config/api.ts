import Constants from 'expo-constants';

// API Configuration
const isDevelopment = __DEV__;

// Backend URL configuration with environment support
const getBackendUrl = () => {
  const extra = (Constants.expoConfig?.extra || (Constants.manifest as any)?.extra || {}) as any;
  const envUrl = extra.apiBaseUrl || process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim();
  }

  // Use production backend for all environments
  return 'https://detach-backend-core.fly.dev';
};

export const API_CONFIG = {
  // Dynamic backend URL based on environment
  BASE_URL: getBackendUrl(),
  
  // API endpoints for universal backend
  ENDPOINTS: {
    HEALTH: '/health', // Health endpoint
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