import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { settingsService } from './settingsService';
import { getApiUrl, getFileUrl, API_CONFIG } from '../config/api';

export interface Folder {
  id: string;
  name: string;
  createdAt: string;
  itemCount: number;
}

export interface DownloadItem {
  id: string;
  url: string;
  title: string;
  platform: 'youtube' | 'youtube-music' | 'spotify' | 'instagram' | 'tiktok' | 'twitter' | 'podcast' | 'facebook' | 'linkedin' | 'pinterest' | 'vimeo' | 'reddit' | 'soundcloud' | 'dailymotion';
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  progress: number;
  filePath?: string;
  thumbnail?: string;
  duration?: number;
  downloadedAt?: string;
  contentType: 'audio' | 'image' | 'text' | 'video';
  fileExtension?: string;
  uploader?: string;
  viewCount?: number;
  actualFormat?: 'audio' | 'video'; // What was actually downloaded
  // 6-Tier System Information
  downloadTier?: number; // Which tier succeeded (1-6)
  downloadSource?: string; // Source name (getloady, ssvid, etc.)
  tierInfo?: string; // Human readable tier info
  allTierResults?: Array<{tier: number, source: string, success: boolean}>; // All attempted tiers
  // Playlist-specific fields
  isPlaylist?: boolean;
  playlistPath?: string;
  downloadedFiles?: string[];
  playlistItems?: Array<{
    title: string;
    filename: string;
    duration?: number;
    uploader?: string;
    index?: number;
  }>;
  // Folder organization
  folderId?: string; // ID of the folder this item belongs to (null = root/All Downloads)
}

class DownloadService {
  private downloads: Map<string, DownloadItem> = new Map();
  private folders: Map<string, Folder> = new Map();
  private downloadDirectory = `${FileSystem.documentDirectory}downloads/`;

  constructor() {
    this.initializeDownloadDirectory();
    this.loadDownloadsFromStorage();
    this.loadFoldersFromStorage();
  }

  private async initializeDownloadDirectory() {
    const dirInfo = await FileSystem.getInfoAsync(this.downloadDirectory);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(this.downloadDirectory, { intermediates: true });
    }
  }

  private async saveDownloadsToStorage() {
    const downloadsArray = Array.from(this.downloads.values());
    await AsyncStorage.setItem('@downloads', JSON.stringify(downloadsArray));
  }

  private async loadDownloadsFromStorage() {
    try {
      const storedDownloads = await AsyncStorage.getItem('@downloads');
      if (storedDownloads) {
        const downloadsArray: DownloadItem[] = JSON.parse(storedDownloads);
        downloadsArray.forEach(item => {
          this.downloads.set(item.id, item);
        });
      }
    } catch (error) {
      console.error('Error loading downloads from storage:', error);
    }
  }

  private async saveFoldersToStorage() {
    const foldersArray = Array.from(this.folders.values());
    await AsyncStorage.setItem('@folders', JSON.stringify(foldersArray));
  }

  private async loadFoldersFromStorage() {
    try {
      const storedFolders = await AsyncStorage.getItem('@folders');
      if (storedFolders) {
        const foldersArray: Folder[] = JSON.parse(storedFolders);
        foldersArray.forEach(folder => {
          this.folders.set(folder.id, folder);
        });
      }
    } catch (error) {
      console.error('Error loading folders from storage:', error);
    }
  }

  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  private detectPlatform(url: string): DownloadItem['platform'] | null {
    // Detect platforms - treat everything as individual content (no playlists)
    const cleanUrl = url.toLowerCase();
    
    if (cleanUrl.includes('music.youtube.com')) return 'youtube-music';
    if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) return 'youtube';
    if (cleanUrl.includes('open.spotify.com')) return 'spotify';
    if (cleanUrl.includes('instagram.com')) return 'instagram';
    if (cleanUrl.includes('tiktok.com')) return 'tiktok';
    if (cleanUrl.includes('twitter.com') || cleanUrl.includes('x.com')) return 'twitter';
    if (cleanUrl.includes('vimeo.com')) return 'vimeo';
    if (cleanUrl.includes('reddit.com') || cleanUrl.includes('redd.it')) return 'reddit';
    if (cleanUrl.includes('podcasts.apple.com') || cleanUrl.includes('.rss') || cleanUrl.includes('podcast') || cleanUrl.includes('/feed')) return 'podcast';
    if (cleanUrl.includes('facebook.com') || cleanUrl.includes('fb.watch')) return 'facebook';
    if (cleanUrl.includes('linkedin.com')) return 'linkedin';
    if (cleanUrl.includes('pinterest.com')) return 'pinterest';
    if (cleanUrl.includes('soundcloud.com')) return 'soundcloud';
    if (cleanUrl.includes('dailymotion.com')) return 'dailymotion';
    
    return null;
  }

  // Removed playlist detection - treating all URLs as individual content

  private detectContentType(platform: DownloadItem['platform'], url: string): DownloadItem['contentType'] {
    // Get user preference from settings for default download format
    const settings = settingsService.getSettings();
    const defaultFormat = settings.downloadFormat; // 'audio' or 'video'
    
    switch (platform) {
      case 'youtube':
        // YouTube has videos (regular, shorts, long-form) - respect user preference
        return defaultFormat === 'video' ? 'video' : 'audio';
        
      case 'tiktok':
        // TikTok is primarily videos, some slideshows - default to video but respect preference
        return defaultFormat === 'video' ? 'video' : 'audio';
        
      case 'instagram':
        // Instagram posts are usually images, reels/IGTV are videos
        if (url.includes('/reel/') || url.includes('/tv/')) {
          return defaultFormat === 'video' ? 'video' : 'audio';
        }
        return 'image'; // Regular posts as images
        
      case 'twitter':
        // Twitter can have videos or just text posts
        return 'text'; // We'll detect video vs text in backend
        
      case 'podcast':
        // Podcasts are always audio
        return 'audio';
        
      case 'facebook':
        // Facebook can have videos - respect user preference
        return defaultFormat === 'video' ? 'video' : 'audio';
        
      case 'linkedin':
        // LinkedIn can have videos or text posts
        return 'text'; // We'll detect video vs text in backend
        
      case 'pinterest':
        // Pinterest is primarily images
        return 'image';
        
      case 'vimeo':
        // Vimeo is primarily videos - respect user preference
        return defaultFormat === 'video' ? 'video' : 'audio';
        
      case 'reddit':
        // Reddit can have videos, images, or text - respect user preference for videos
        if (url.includes('v.redd.it') || url.includes('/video/') || url.includes('.mp4')) {
          return defaultFormat === 'video' ? 'video' : 'audio';
        }
        return 'text'; // Default for text posts
        
      case 'soundcloud':
        // SoundCloud is always audio
        return 'audio';
        
      case 'dailymotion':
        // Dailymotion is primarily videos - respect user preference
        return defaultFormat === 'video' ? 'video' : 'audio';
        
      default:
        return 'audio';
    }
  }

  private getFileExtension(contentType: DownloadItem['contentType'], platform: DownloadItem['platform']): string {
    switch (contentType) {
      case 'audio':
        return 'm4a'; // Audio format for YouTube/TikTok
      case 'image':
        return 'jpg'; // Image format for Instagram/Pinterest
      case 'video':
        return 'mp4'; // Video format (if needed)
      case 'text':
        return 'txt'; // Text format for Twitter/LinkedIn
      default:
        return 'bin'; // Binary fallback
    }
  }

  async addDownload(url: string, title?: string): Promise<string> {
    console.log('📥 addDownload called with URL:', url);
    const platform = this.detectPlatform(url);
    if (!platform) {
      console.error('❌ Unsupported platform for URL:', url);
      throw new Error('Unsupported platform');
    }

    console.log('✅ Platform detected:', platform);
    const id = this.generateId();
    const contentType = this.detectContentType(platform, url);
    const downloadItem: DownloadItem = {
      id,
      url,
      title: title || `${platform} ${contentType}`,
      platform,
      status: 'pending',
      progress: 0,
      contentType,
    };

    this.downloads.set(id, downloadItem);
    await this.saveDownloadsToStorage();
    console.log('💾 Download item saved with ID:', id);
    
    // Check if auto-download is enabled
    const settings = settingsService.getSettings();
    console.log('⚙️ Auto-download enabled:', settings.autoDownload);
    if (settings.autoDownload) {
      console.log('🚀 Starting auto-download for ID:', id);
      this.startDownload(id);
    } else {
      console.log('⏸️ Auto-download disabled, download stays pending');
    }
    
    return id;
  }

  private async testBackendConnectivity(): Promise<boolean> {
    try {
      const healthUrl = getApiUrl(API_CONFIG.ENDPOINTS.HEALTH);
      console.log('🔍 Testing backend connectivity to:', healthUrl);
      console.log('🔧 API_CONFIG.BASE_URL:', API_CONFIG.BASE_URL);
      
      const response = await axios.get(healthUrl, {
        timeout: 15000, // Increased timeout for cold starts
        headers: {
          'User-Agent': 'Detach-iOS-App/1.0.0',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      console.log('✅ Backend health check passed:', response.status);
      console.log('📊 Response data:', response.data);
      return response.status === 200;
    } catch (error: any) {
      console.error('❌ Backend connectivity test failed:', error.message);
      console.error('🔍 Error details:', {
        code: error.code,
        status: error.response?.status,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          timeout: error.config?.timeout
        }
      });
      
      // Try to provide more specific error information
      if (error.code === 'NETWORK_ERROR' || error.message === 'Network Error') {
        console.error('🚨 Network Error - This might be due to:');
        console.error('   1. iOS simulator network restrictions');
        console.error('   2. HTTP vs HTTPS configuration issues');
        console.error('   3. VPS firewall blocking requests');
        console.error('   4. DNS resolution problems');
      }
      
      return false;
    }
  }

  async startDownload(id: string) {
    console.log('🚀 startDownload called for ID:', id);
    const item = this.downloads.get(id);
    if (!item) {
      console.error('❌ Download item not found for ID:', id);
      return;
    }

    console.log('📱 Starting download for:', item.url, 'Platform:', item.platform);

    try {
      // Test backend connectivity first
      console.log('🔍 Testing backend connectivity...');
      const isBackendOnline = await this.testBackendConnectivity();
      if (!isBackendOnline) {
        console.error('❌ Backend connectivity test failed');
        console.log('⚠️ Attempting to proceed anyway for development testing...');
        // Don't throw error in development - try to proceed anyway
        // throw new Error('Backend server is currently unavailable. Please check your internet connection and try again later.');
      } else {
        console.log('✅ Backend connectivity confirmed');
      }

      item.status = 'downloading';
      this.downloads.set(id, item);
      await this.saveDownloadsToStorage();
      console.log('📊 Status updated to downloading');

      // Use universal backend with 6-tier fallback system
      console.log('🚀 Attempting direct download API call...');
      const downloadData = await this.getUniversalDownloadUrl(item.url);

      if (!downloadData) {
        throw new Error('Could not get download URL');
      }

      // Handle different response formats
      let downloadUrl: string;
      let metadata: any = {};
      
      if (typeof downloadData === 'string') {
        downloadUrl = downloadData;
      } else {
        downloadUrl = downloadData.url;
        metadata = downloadData.metadata || {};
      }

      // Update item with metadata if available
      if (metadata.title) {
        item.title = metadata.title;
      }
      if (metadata.duration) {
        item.duration = metadata.duration;
      }
      if (metadata.uploader) {
        item.uploader = metadata.uploader;
      }
      if (metadata.viewCount) {
        item.viewCount = metadata.viewCount;
      }
      if (metadata.actualFormat) {
        item.actualFormat = metadata.actualFormat;
        // Update contentType based on what was actually downloaded
        item.contentType = metadata.actualFormat;
      }
      
      // Store tier information for user visibility
      if (metadata.tier) {
        item.downloadTier = metadata.tier;
        item.downloadSource = metadata.source;
        item.tierInfo = metadata.tierInfo;
        console.log(`📊 Downloaded via ${metadata.tierInfo} using ${metadata.downloadMethod}`);
      }
      
      // Store all tier attempt results for debugging
      if (metadata.allTiers) {
        item.allTierResults = metadata.allTiers;
        console.log(`🎯 Tier Results: ${metadata.allTiers.map((t: any) => `${t.source}(${t.success ? '✅' : '❌'})`).join(', ')}`);
      }
      
      // Simplified - no playlist handling, all downloads are individual files

      // First, do a HEAD request to get the actual Content-Type
      let actualContentType = 'audio/mpeg'; // Default fallback
      let actualExtension = 'mp3'; // Default fallback
      
      try {
        const headResponse = await axios.head(downloadUrl, { timeout: 10000 });
        actualContentType = headResponse.headers['content-type'] || actualContentType;
        console.log('🔍 Actual Content-Type from server:', actualContentType);
        
        // Map Content-Type to proper file extension
        if (actualContentType.includes('audio/mpeg') || actualContentType.includes('audio/mp3')) {
          actualExtension = 'mp3';
        } else if (actualContentType.includes('audio/mp4') || actualContentType.includes('audio/aac')) {
          actualExtension = 'm4a';
        } else if (actualContentType.includes('video/mp4')) {
          actualExtension = 'mp4';
        } else if (actualContentType.includes('video/webm')) {
          actualExtension = 'webm';
        } else if (actualContentType.includes('audio/')) {
          actualExtension = 'mp3'; // Default for any audio
        } else if (actualContentType.includes('video/')) {
          actualExtension = 'mp4'; // Default for any video
        }
      } catch (headError) {
        console.log('⚠️ Could not get Content-Type via HEAD request, using default extension');
      }
      
      console.log('📁 Using file extension:', actualExtension, 'for Content-Type:', actualContentType);
      const fileName = `${id}_${item.platform}_${item.contentType}.${actualExtension}`;
      const filePath = `${this.downloadDirectory}${fileName}`;
      
      item.fileExtension = actualExtension;

      // Start with some progress
      item.progress = 10;
      this.downloads.set(id, item);
      await this.saveDownloadsToStorage();

      // Simulate progress during download
      const progressInterval = setInterval(() => {
        if (item.progress < 90) {
          item.progress += Math.random() * 20;
          if (item.progress > 90) item.progress = 90;
          this.downloads.set(id, item);
          this.saveDownloadsToStorage();
        }
      }, 500);

      console.log('Starting download from URL:', downloadUrl);
      
      // Download all files locally for better offline access and performance
      console.log('Downloading file locally to path:', filePath);
      
      const downloadResult = await FileSystem.downloadAsync(
        downloadUrl,
        filePath,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );
      
      console.log('Download result:', downloadResult);
      
      // Check the actual Content-Type from the download response
      let finalFilePath = filePath;
      if (downloadResult?.headers && downloadResult.headers['content-type']) {
        const downloadContentType = downloadResult.headers['content-type'];
        console.log('📋 Download response Content-Type:', downloadContentType);
        
        // Check if we need to rename the file based on actual Content-Type
        let correctExtension = actualExtension;
        if (downloadContentType.includes('audio/mpeg') && actualExtension !== 'mp3') {
          correctExtension = 'mp3';
        } else if (downloadContentType.includes('audio/mp4') && actualExtension !== 'm4a') {
          correctExtension = 'm4a';
        } else if (downloadContentType.includes('video/mp4') && actualExtension !== 'mp4') {
          correctExtension = 'mp4';
        }
        
        if (correctExtension !== actualExtension) {
          console.log(`🔄 Renaming file from .${actualExtension} to .${correctExtension} based on actual Content-Type`);
          const correctFileName = `${id}_${item.platform}_${item.contentType}.${correctExtension}`;
          const correctFilePath = `${this.downloadDirectory}${correctFileName}`;
          
          try {
            await FileSystem.moveAsync({ from: filePath, to: correctFilePath });
            finalFilePath = correctFilePath;
            item.fileExtension = correctExtension;
          } catch (renameError) {
            console.log('⚠️ Could not rename file, keeping original extension');
          }
        }
      }
      
      // Check if file was actually downloaded
      const fileInfo = await FileSystem.getInfoAsync(finalFilePath);
      console.log('Downloaded file info:', fileInfo);

      // Clear the progress interval
      clearInterval(progressInterval);

      item.status = 'completed';
      item.progress = 100;
      // Use downloadResult.uri if available, otherwise use the final file path
      item.filePath = downloadResult?.uri || finalFilePath;
      item.downloadedAt = new Date().toISOString();
      
      this.downloads.set(id, item);
      await this.saveDownloadsToStorage();

    } catch (error) {
      console.error('Download failed:', error);
      item.status = 'failed';
      this.downloads.set(id, item);
      await this.saveDownloadsToStorage();
    }
  }

  private async getUniversalDownloadUrl(url: string): Promise<{url: string, metadata: any} | null> {
    try {
      const apiUrl = getApiUrl(API_CONFIG.ENDPOINTS.DOWNLOAD);
      const settings = settingsService.getSettings();
      
      console.log('🚀 Using Universal Backend with 6-tier fallback system for:', url);
      console.log('📡 API URL:', apiUrl);
      console.log('🔗 Base URL:', API_CONFIG.BASE_URL);
      console.log('⚙️ User Settings:', {
        format: settings.downloadFormat,
        audioQuality: settings.audioQuality,
        videoQuality: settings.videoQuality,
        maxFileSize: settings.maxFileSize
      });
      
      const response = await axios.post(apiUrl, {
        url: url,
        format: settings.downloadFormat, // 'audio' or 'video'
        audioQuality: settings.audioQuality, // 'high' | 'medium' | 'low'
        videoQuality: settings.videoQuality, // 'high' | 'medium' | 'low' 
        maxFileSize: settings.maxFileSize // Size limit in MB
      }, {
        timeout: 180000, // 3 minutes timeout for tier processing
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Handle new backend response format
      if (response.data?.success && response.data?.data) {
        const downloadData = response.data.data; // Single object, not array
        console.log(`✅ Universal Backend Success: Tier ${downloadData.tier} (${downloadData.service})`);
        console.log('📱 Platform detected:', response.data.platform);
        console.log('🎯 Method used:', downloadData.method);
        console.log('🔗 Download URL:', downloadData.downloadUrl);
        
        // Log tier results for debugging
        if (response.data.tiers && response.data.tiers.length > 0) {
          response.data.tiers.forEach((tier: any) => {
            const status = tier.success ? '✅' : '❌';
            console.log(`   ${status} Tier ${tier.tier} (${tier.source}): ${tier.success ? 'SUCCESS' : 'FAILED'}`);
          });
        }

        return {
          url: downloadData.downloadUrl, // This is the key fix - use downloadUrl from backend
          metadata: {
            title: downloadData.title || response.data.platform + ' content',
            duration: downloadData.duration,
            uploader: downloadData.uploader,
            filename: downloadData.filename,
            platform: response.data.platform,
            tier: downloadData.tier,
            source: downloadData.service,
            tierInfo: `Tier ${downloadData.tier}: ${downloadData.service}`,
            tierName: downloadData.tierName,
            method: downloadData.method,
            quality: downloadData.quality,
            allTiers: response.data.tiers,
            successfulTier: downloadData.tier,
            downloadMethod: downloadData.method || 'browser_automation'
          }
        };
      } else {
        console.log('❌ Universal Backend: Download failed');
        console.log('Response data:', response.data);
        throw new Error(response.data?.error || 'Download failed');
      }
    } catch (error: any) {
      console.log('❌ Universal Backend Error:', error.message);
      throw error;
    }
  }

  private async getYouTubeDownloadUrl(url: string): Promise<{url: string, metadata: any} | null> {
    try {
      const settings = settingsService.getSettings();
      const format = settings.downloadFormat; // 'audio' or 'video'
      
      console.log('Attempting YouTube download:', { url, format, endpoint: getApiUrl(API_CONFIG.ENDPOINTS.YOUTUBE) });
      
      const response = await axios.post(getApiUrl(API_CONFIG.ENDPOINTS.YOUTUBE), { 
        url,
        format 
      }, {
        timeout: 60000, // 60 second timeout
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      console.log('YouTube API response:', response.status, response.data);
      
      // Check if backend downloaded the file directly
      if (response.data.filePath) {
        // For videos, download to local device storage for better compatibility
        if (response.data.contentType === 'video') {
          const fileUrl = getFileUrl(response.data.filename);
          const localPath = `${this.downloadDirectory}${response.data.filename}`;
          
          // Download file to local storage for better video playback
          try {
            console.log('Downloading YouTube video locally from:', fileUrl);
            console.log('Saving to local path:', localPath);
            const downloadResult = await FileSystem.downloadAsync(fileUrl, localPath);
            console.log('YouTube video downloaded locally to:', downloadResult.uri);
            return {
              url: downloadResult.uri,
              metadata: {
                title: response.data.title,
                duration: response.data.duration,
                uploader: response.data.uploader,
                viewCount: response.data.viewCount,
                actualFormat: response.data.contentType,
                fileSize: response.data.fileSize
              }
            };
          } catch (localDownloadError) {
            console.error('Failed to download YouTube video locally, using server URL:', localDownloadError);
            // Fallback to server URL
            const fileUrl = getFileUrl(response.data.filename);
            return {
              url: fileUrl,
              metadata: {
                title: response.data.title,
                duration: response.data.duration,
                uploader: response.data.uploader,
                viewCount: response.data.viewCount,
                actualFormat: response.data.contentType,
                fileSize: response.data.fileSize
              }
            };
          }
        } else {
          // For audio, also download locally for offline access
          const fileUrl = getFileUrl(response.data.filename);
          const localPath = `${this.downloadDirectory}${response.data.filename}`;
          
          // Download file to local storage for offline access
          try {
            console.log('Downloading YouTube audio locally from:', fileUrl);
            console.log('Saving to local path:', localPath);
            const downloadResult = await FileSystem.downloadAsync(fileUrl, localPath);
            console.log('YouTube audio downloaded locally to:', downloadResult.uri);
            return {
              url: downloadResult.uri,
              metadata: {
                title: response.data.title,
                duration: response.data.duration,
                uploader: response.data.uploader,
                viewCount: response.data.viewCount,
                actualFormat: response.data.contentType,
                fileSize: response.data.fileSize
              }
            };
          } catch (localDownloadError) {
            console.error('Failed to download YouTube audio locally, using server URL:', localDownloadError);
            // Fallback to server URL if local download fails
            return {
              url: fileUrl,
              metadata: {
                title: response.data.title,
                duration: response.data.duration,
                uploader: response.data.uploader,
                viewCount: response.data.viewCount,
                actualFormat: response.data.contentType,
                fileSize: response.data.fileSize
              }
            };
          }
        }
      } else {
        // Fallback to old URL method (shouldn't happen with new backend)
        return {
          url: response.data.downloadUrl,
          metadata: {
            title: response.data.title,
            duration: response.data.duration,
            uploader: response.data.uploader,
            viewCount: response.data.viewCount,
            actualFormat: response.data.contentType
          }
        };
      }
    } catch (error: any) {
      console.error('YouTube download failed:', error);
      
      // Log detailed error information
      if (error.response) {
        console.error('Response error:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        });
      } else if (error.request) {
        console.error('Request error:', error.request);
      } else {
        console.error('Error message:', error.message);
      }
      
      return null;
    }
  }

  private async getYouTubeMusicDownloadUrl(url: string): Promise<{url: string, metadata: any} | null> {
    try {
      const settings = settingsService.getSettings();
      const format = settings.downloadFormat; // 'audio' or 'video'
      
      console.log('Attempting YouTube Music download:', { url, format, endpoint: getApiUrl(API_CONFIG.ENDPOINTS.YOUTUBE_MUSIC) });
      
      const response = await axios.post(getApiUrl(API_CONFIG.ENDPOINTS.YOUTUBE_MUSIC), { 
        url,
        format 
      }, {
        timeout: 60000, // 60 second timeout
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      console.log('YouTube Music API response:', response.status, response.data);
      
      // Check if backend downloaded the file directly
      if (response.data.filePath && response.data.filename) {
        // Download locally for offline access
        const fileUrl = getFileUrl(response.data.filename);
        console.log('YouTube Music - filename:', response.data.filename, 'fileUrl:', fileUrl);
        const localPath = `${this.downloadDirectory}${response.data.filename}`;
        
        // Download file to local storage for offline access
        try {
          console.log('Downloading YouTube Music audio locally from:', fileUrl);
          console.log('Saving to local path:', localPath);
          const downloadResult = await FileSystem.downloadAsync(fileUrl, localPath);
          console.log('YouTube Music audio downloaded locally to:', downloadResult.uri);
          return {
            url: downloadResult.uri,
            metadata: {
              title: response.data.title,
              duration: response.data.duration,
              uploader: response.data.artist,
              album: response.data.album,
              actualFormat: response.data.contentType,
              fileSize: response.data.fileSize
            }
          };
        } catch (localDownloadError) {
          console.error('Failed to download YouTube Music audio locally, using server URL:', localDownloadError);
          // Fallback to server URL if local download fails
          return {
            url: fileUrl,
            metadata: {
              title: response.data.title,
              duration: response.data.duration,
              uploader: response.data.artist,
              album: response.data.album,
              actualFormat: response.data.contentType,
              fileSize: response.data.fileSize
            }
          };
        }
      } else {
        // Fallback to old URL method
        return {
          url: response.data.downloadUrl,
          metadata: response.data
        };
      }
      
    } catch (error) {
      console.error('YouTube Music download failed:', error);
      throw new Error('Could not get download URL');
    }
  }

  private async getSpotifyDownloadUrl(url: string): Promise<{url: string, metadata: any} | null> {
    try {
      const settings = settingsService.getSettings();
      const format = settings.downloadFormat; // 'audio' or 'video'
      
      console.log('Attempting Spotify download:', { url, format, endpoint: getApiUrl(API_CONFIG.ENDPOINTS.SPOTIFY) });
      
      const response = await axios.post(getApiUrl(API_CONFIG.ENDPOINTS.SPOTIFY), { 
        url,
        format 
      }, {
        timeout: 60000, // 60 second timeout
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      console.log('Spotify API response:', response.status, response.data);
      
      // Check if backend downloaded the file directly
      if (response.data.filePath && response.data.filename) {
        // Download locally for offline access
        const fileUrl = getFileUrl(response.data.filename);
        console.log('Spotify - filename:', response.data.filename, 'fileUrl:', fileUrl);
        const localPath = `${this.downloadDirectory}${response.data.filename}`;
        
        // Download file to local storage for offline access
        try {
          console.log('Downloading Spotify audio locally from:', fileUrl);
          console.log('Saving to local path:', localPath);
          const downloadResult = await FileSystem.downloadAsync(fileUrl, localPath);
          console.log('Spotify audio downloaded locally to:', downloadResult.uri);
          return {
            url: downloadResult.uri,
            metadata: {
              title: response.data.title,
              duration: response.data.duration,
              actualFormat: response.data.contentType,
              fileSize: response.data.fileSize
            }
          };
        } catch (localDownloadError) {
          console.error('Failed to download Spotify audio locally, using server URL:', localDownloadError);
          // Fallback to server URL if local download fails
          return {
            url: fileUrl,
            metadata: {
              title: response.data.title,
              duration: response.data.duration,
              actualFormat: response.data.contentType,
              fileSize: response.data.fileSize
            }
          };
        }
      } else {
        // Fallback to old URL method
        return {
          url: response.data.downloadUrl,
          metadata: response.data
        };
      }
      
    } catch (error) {
      console.error('Spotify download failed:', error);
      throw new Error('Could not get download URL');
    }
  }

  private async getInstagramDownloadUrl(url: string): Promise<{url: string, metadata: any} | null> {
    try {
      const settings = settingsService.getSettings();
      const format = settings.downloadFormat; // 'audio' or 'video'
      
      const response = await axios.post(getApiUrl(API_CONFIG.ENDPOINTS.INSTAGRAM), { 
        url,
        format 
      });
      
      // Check if backend downloaded the file directly
      if (response.data.filePath) {
        // For videos, download to local device storage for better compatibility
        if (response.data.contentType === 'video') {
          const fileUrl = getFileUrl(response.data.filename);
          const localPath = `${this.downloadDirectory}${response.data.filename}`;
          
          // Download file to local storage for better video playback
          try {
            console.log('Downloading Instagram video locally from:', fileUrl);
            console.log('Saving to local path:', localPath);
            const downloadResult = await FileSystem.downloadAsync(fileUrl, localPath);
            console.log('Instagram video downloaded locally to:', downloadResult.uri);
            return {
              url: downloadResult.uri,
              metadata: {
                title: response.data.title,
                duration: response.data.duration,
                uploader: response.data.uploader,
                viewCount: response.data.viewCount,
                actualFormat: response.data.contentType,
                fileSize: response.data.fileSize
              }
            };
          } catch (localDownloadError) {
            console.error('Failed to download Instagram video locally, using server URL:', localDownloadError);
            // Fallback to server URL
            const fileUrl = getFileUrl(response.data.filename);
            return {
              url: fileUrl,
              metadata: {
                title: response.data.title,
                duration: response.data.duration,
                uploader: response.data.uploader,
                viewCount: response.data.viewCount,
                actualFormat: response.data.contentType,
                fileSize: response.data.fileSize
              }
            };
          }
        } else {
          // For non-videos (images), use server URL directly
          const fileUrl = getFileUrl(response.data.filename);
          return {
            url: fileUrl,
            metadata: {
              title: response.data.title,
              duration: response.data.duration,
              uploader: response.data.uploader,
              viewCount: response.data.viewCount,
              actualFormat: response.data.contentType,
              fileSize: response.data.fileSize
            }
          };
        }
      } else {
        // Fallback to old URL method
        return {
          url: response.data.downloadUrl,
          metadata: {
            title: response.data.title,
            duration: response.data.duration,
            uploader: response.data.uploader,
            viewCount: response.data.viewCount,
            actualFormat: response.data.contentType
          }
        };
      }
    } catch (error: any) {
      console.error('Instagram download failed:', error);
      
      // Show user-friendly error message for authentication issues
      if (error?.response?.data?.error) {
        const errorMsg = error.response.data.error;
        const suggestions = error.response.data.suggestions;
        
        if (errorMsg.includes('login') || errorMsg.includes('authentication')) {
          console.warn('Instagram authentication required:', suggestions);
          // Could show a user-friendly alert here if needed
        }
      }
      
      return null;
    }
  }

  private async getTikTokDownloadUrl(url: string): Promise<{url: string, metadata: any} | null> {
    try {
      const settings = settingsService.getSettings();
      const format = settings.downloadFormat; // 'audio' or 'video'
      
      const response = await axios.post(getApiUrl(API_CONFIG.ENDPOINTS.TIKTOK), { 
        url,
        format 
      });
      
      // Check if backend downloaded the file directly
      if (response.data.filePath) {
        // For videos, download to local device storage for better compatibility
        if (response.data.contentType === 'video') {
          const fileUrl = getFileUrl(response.data.filename);
          const localPath = `${this.downloadDirectory}${response.data.filename}`;
          
          // Download file to local storage for better video playback
          try {
            console.log('Downloading TikTok video locally from:', fileUrl);
            console.log('Saving to local path:', localPath);
            const downloadResult = await FileSystem.downloadAsync(fileUrl, localPath);
            console.log('TikTok video downloaded locally to:', downloadResult.uri);
            return {
              url: downloadResult.uri,
              metadata: {
                title: response.data.title,
                duration: response.data.duration,
                uploader: response.data.uploader,
                viewCount: response.data.viewCount,
                actualFormat: response.data.contentType,
                fileSize: response.data.fileSize
              }
            };
          } catch (localDownloadError) {
            console.error('Failed to download TikTok video locally, using server URL:', localDownloadError);
            // Fallback to server URL
            const fileUrl = getFileUrl(response.data.filename);
            return {
              url: fileUrl,
              metadata: {
                title: response.data.title,
                duration: response.data.duration,
                uploader: response.data.uploader,
                viewCount: response.data.viewCount,
                actualFormat: response.data.contentType,
                fileSize: response.data.fileSize
              }
            };
          }
        } else {
          // For non-videos, use server URL directly
          const fileUrl = getFileUrl(response.data.filename);
          return {
            url: fileUrl,
            metadata: {
              title: response.data.title,
              duration: response.data.duration,
              uploader: response.data.uploader,
              viewCount: response.data.viewCount,
              actualFormat: response.data.contentType,
              fileSize: response.data.fileSize
            }
          };
        }
      } else {
        // Fallback to old URL method
        return {
          url: response.data.downloadUrl,
          metadata: {
            title: response.data.title,
            duration: response.data.duration,
            uploader: response.data.uploader,
            viewCount: response.data.viewCount,
            actualFormat: response.data.contentType
          }
        };
      }
    } catch (error) {
      console.error('TikTok download failed:', error);
      return null;
    }
  }

  getDownloads(): DownloadItem[] {
    return Array.from(this.downloads.values()).sort((a, b) => 
      new Date(b.downloadedAt || 0).getTime() - new Date(a.downloadedAt || 0).getTime()
    );
  }

  getDownload(id: string): DownloadItem | undefined {
    return this.downloads.get(id);
  }

  async deleteDownload(id: string): Promise<boolean> {
    const item = this.downloads.get(id);
    if (!item) return false;

    if (item.filePath) {
      try {
        // Only delete local files, not remote URLs
        if (item.filePath.startsWith('file://') || item.filePath.startsWith('/')) {
          await FileSystem.deleteAsync(item.filePath);
        }
        // For remote URLs, we don't need to delete them - they're hosted remotely
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    }

    this.downloads.delete(id);
    await this.saveDownloadsToStorage();
    
    // Remove from all playlists
    try {
      const { playlistService } = await import('./playlistService');
      await playlistService.removeFromAllPlaylists(id);
    } catch (error) {
      console.error('Error removing download from playlists:', error);
    }
    
    return true;
  }

  private async getTwitterDownloadUrl(url: string): Promise<{url: string, metadata: any} | null> {
    try {
      const settings = settingsService.getSettings();
      const format = settings.downloadFormat; // 'audio' or 'video'
      
      const response = await axios.post(getApiUrl(API_CONFIG.ENDPOINTS.TWITTER), { 
        url,
        format 
      });
      
      // Check if backend downloaded the file directly
      if (response.data.filePath) {
        // For videos, download to local device storage for better compatibility
        if (response.data.contentType === 'video') {
          const fileUrl = getFileUrl(response.data.filename);
          const localPath = `${this.downloadDirectory}${response.data.filename}`;
          
          // Download file to local storage for better video playback
          try {
            console.log('Downloading Twitter video locally from:', fileUrl);
            const downloadResult = await FileSystem.downloadAsync(fileUrl, localPath);
            console.log('Twitter video downloaded locally to:', downloadResult.uri);
            return {
              url: downloadResult.uri,
              metadata: {
                title: response.data.title,
                duration: response.data.duration,
                uploader: response.data.uploader,
                viewCount: response.data.viewCount,
                actualFormat: response.data.contentType,
                fileSize: response.data.fileSize
              }
            };
          } catch (localDownloadError) {
            console.error('Failed to download Twitter video locally, using server URL:', localDownloadError);
            const fileUrl = getFileUrl(response.data.filename);
            return {
              url: fileUrl,
              metadata: {
                title: response.data.title,
                duration: response.data.duration,
                uploader: response.data.uploader,
                viewCount: response.data.viewCount,
                actualFormat: response.data.contentType,
                fileSize: response.data.fileSize
              }
            };
          }
        } else {
          // For text posts, use server URL directly
          const fileUrl = getFileUrl(response.data.filename);
          return {
            url: fileUrl,
            metadata: {
              title: response.data.title,
              uploader: response.data.uploader,
              viewCount: response.data.viewCount,
              actualFormat: response.data.contentType,
              fileSize: response.data.fileSize
            }
          };
        }
      }
    } catch (error: any) {
      console.error('Twitter download failed:', error);
      return null;
    }
  }

  private async getPodcastDownloadUrl(url: string): Promise<{url: string, metadata: any} | null> {
    try {
      // All podcast URLs are treated as individual episodes
      const response = await axios.post(getApiUrl(API_CONFIG.ENDPOINTS.PODCAST), { 
        url,
        format: 'audio'
      });
      
      // Handle single file downloads
      if (response.data.filePath) {
        // For audio, use server URL directly
        const fileUrl = getFileUrl(response.data.filename);
        return {
          url: fileUrl,
          metadata: {
            title: response.data.title,
            uploader: response.data.uploader,
            actualFormat: 'audio',
            fileSize: response.data.fileSize,
            description: response.data.description,
            publishDate: response.data.publishDate
          }
        };
      }
    } catch (error: any) {
      console.error('Podcast download failed:', error);
      return null;
    }
  }

  private async getFacebookDownloadUrl(url: string): Promise<{url: string, metadata: any} | null> {
    try {
      const settings = settingsService.getSettings();
      const format = settings.downloadFormat; // 'audio' or 'video'
      
      const response = await axios.post(getApiUrl(API_CONFIG.ENDPOINTS.FACEBOOK), { 
        url,
        format 
      });
      
      // Check if backend downloaded the file directly
      if (response.data.filePath) {
        // For videos, download to local device storage for better compatibility
        if (response.data.contentType === 'video') {
          const fileUrl = getFileUrl(response.data.filename);
          const localPath = `${this.downloadDirectory}${response.data.filename}`;
          
          try {
            console.log('Downloading Facebook video locally from:', fileUrl);
            const downloadResult = await FileSystem.downloadAsync(fileUrl, localPath);
            console.log('Facebook video downloaded locally to:', downloadResult.uri);
            return {
              url: downloadResult.uri,
              metadata: {
                title: response.data.title,
                duration: response.data.duration,
                uploader: response.data.uploader,
                viewCount: response.data.viewCount,
                actualFormat: response.data.contentType,
                fileSize: response.data.fileSize
              }
            };
          } catch (localDownloadError) {
            console.error('Failed to download Facebook video locally, using server URL:', localDownloadError);
            const fileUrl = getFileUrl(response.data.filename);
            return {
              url: fileUrl,
              metadata: {
                title: response.data.title,
                duration: response.data.duration,
                uploader: response.data.uploader,
                viewCount: response.data.viewCount,
                actualFormat: response.data.contentType,
                fileSize: response.data.fileSize
              }
            };
          }
        } else {
          // For audio, use server URL directly
          const fileUrl = getFileUrl(response.data.filename);
          return {
            url: fileUrl,
            metadata: {
              title: response.data.title,
              duration: response.data.duration,
              uploader: response.data.uploader,
              viewCount: response.data.viewCount,
              actualFormat: response.data.contentType,
              fileSize: response.data.fileSize
            }
          };
        }
      }
    } catch (error: any) {
      console.error('Facebook download failed:', error);
      return null;
    }
  }

  private async getLinkedInDownloadUrl(url: string): Promise<{url: string, metadata: any} | null> {
    try {
      const settings = settingsService.getSettings();
      const format = settings.downloadFormat; // 'audio' or 'video'
      
      const response = await axios.post(getApiUrl(API_CONFIG.ENDPOINTS.LINKEDIN), { 
        url,
        format 
      });
      
      // Check if backend downloaded the file directly
      if (response.data.filePath) {
        // For videos, download to local device storage for better compatibility
        if (response.data.contentType === 'video') {
          const fileUrl = getFileUrl(response.data.filename);
          const localPath = `${this.downloadDirectory}${response.data.filename}`;
          
          try {
            console.log('Downloading LinkedIn video locally from:', fileUrl);
            const downloadResult = await FileSystem.downloadAsync(fileUrl, localPath);
            console.log('LinkedIn video downloaded locally to:', downloadResult.uri);
            return {
              url: downloadResult.uri,
              metadata: {
                title: response.data.title,
                duration: response.data.duration,
                uploader: response.data.uploader,
                actualFormat: response.data.contentType,
                fileSize: response.data.fileSize
              }
            };
          } catch (localDownloadError) {
            console.error('Failed to download LinkedIn video locally, using server URL:', localDownloadError);
            const fileUrl = getFileUrl(response.data.filename);
            return {
              url: fileUrl,
              metadata: {
                title: response.data.title,
                duration: response.data.duration,
                uploader: response.data.uploader,
                actualFormat: response.data.contentType,
                fileSize: response.data.fileSize
              }
            };
          }
        } else {
          // For text posts, use server URL directly
          const fileUrl = getFileUrl(response.data.filename);
          return {
            url: fileUrl,
            metadata: {
              title: response.data.title,
              uploader: response.data.uploader,
              actualFormat: response.data.contentType,
              fileSize: response.data.fileSize
            }
          };
        }
      }
    } catch (error: any) {
      console.error('LinkedIn download failed:', error);
      return null;
    }
  }

  private async getPinterestDownloadUrl(url: string): Promise<{url: string, metadata: any} | null> {
    try {
      const settings = settingsService.getSettings();
      const format = settings.downloadFormat; // 'audio' or 'video'
      
      const response = await axios.post(getApiUrl(API_CONFIG.ENDPOINTS.PINTEREST), { 
        url,
        format 
      });
      
      // Check if backend downloaded the file directly
      if (response.data.filePath) {
        // For images, use server URL directly
        const fileUrl = getFileUrl(response.data.filename);
        return {
          url: fileUrl,
          metadata: {
            title: response.data.title,
            uploader: response.data.uploader,
            actualFormat: response.data.contentType,
            fileSize: response.data.fileSize,
            description: response.data.description
          }
        };
      }
    } catch (error: any) {
      console.error('Pinterest download failed:', error);
      return null;
    }
  }

  async clearAllDownloads(): Promise<void> {
    for (const item of this.downloads.values()) {
      if (item.filePath) {
        try {
          // Only delete local files, not remote URLs
          if (item.filePath.startsWith('file://') || item.filePath.startsWith('/')) {
            await FileSystem.deleteAsync(item.filePath);
          }
          // For remote URLs, we don't need to delete them - they're hosted remotely
        } catch (error) {
          console.error('Error deleting file:', error);
        }
      }
    }
    
    this.downloads.clear();
    await AsyncStorage.removeItem('@downloads');
  }

  // Folder management methods
  async createFolder(name: string): Promise<string> {
    const id = this.generateId();
    const folder: Folder = {
      id,
      name: name.trim(),
      createdAt: new Date().toISOString(),
      itemCount: 0
    };

    this.folders.set(id, folder);
    await this.saveFoldersToStorage();
    return id;
  }

  getFolders(): Folder[] {
    const folders = Array.from(this.folders.values()).sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    
    // Update item counts
    folders.forEach(folder => {
      folder.itemCount = Array.from(this.downloads.values()).filter(d => d.folderId === folder.id).length;
    });
    
    return folders;
  }

  getFolder(id: string): Folder | undefined {
    return this.folders.get(id);
  }

  async deleteFolder(id: string): Promise<boolean> {
    const folder = this.folders.get(id);
    if (!folder) return false;

    // Move all items in this folder back to root (no folder)
    const itemsInFolder = Array.from(this.downloads.values()).filter(d => d.folderId === id);
    for (const item of itemsInFolder) {
      item.folderId = undefined;
      this.downloads.set(item.id, item);
    }

    this.folders.delete(id);
    await this.saveFoldersToStorage();
    await this.saveDownloadsToStorage();
    return true;
  }

  async renameFolder(id: string, newName: string): Promise<boolean> {
    const folder = this.folders.get(id);
    if (!folder) return false;

    folder.name = newName.trim();
    this.folders.set(id, folder);
    await this.saveFoldersToStorage();
    return true;
  }

  async moveToFolder(downloadId: string, folderId?: string): Promise<boolean> {
    const download = this.downloads.get(downloadId);
    if (!download) return false;

    // Verify folder exists if folderId is provided
    if (folderId && !this.folders.has(folderId)) {
      return false;
    }

    download.folderId = folderId;
    this.downloads.set(downloadId, download);
    await this.saveDownloadsToStorage();
    return true;
  }

  getDownloadsByFolder(folderId?: string): DownloadItem[] {
    return Array.from(this.downloads.values())
      .filter(item => item.folderId === folderId)
      .sort((a, b) => 
        new Date(b.downloadedAt || 0).getTime() - new Date(a.downloadedAt || 0).getTime()
      );
  }

  async updateTitle(downloadId: string, newTitle: string): Promise<boolean> {
    const download = this.downloads.get(downloadId);
    if (!download) return false;

    // Validate title (must be non-empty and reasonable length)
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle || trimmedTitle.length > 200) {
      return false;
    }

    download.title = trimmedTitle;
    this.downloads.set(downloadId, download);
    await this.saveDownloadsToStorage();
    return true;
  }

  getDownloadById(downloadId: string): DownloadItem | undefined {
    return this.downloads.get(downloadId);
  }
}

export const downloadService = new DownloadService();