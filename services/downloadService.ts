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
  platform: 'youtube' | 'instagram' | 'tiktok' | 'twitter' | 'podcast' | 'facebook' | 'linkedin' | 'pinterest';
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
    if (url.includes('music.youtube.com')) return 'youtube'; // YouTube Music uses same endpoint
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('open.spotify.com')) return 'youtube'; // Route Spotify through YouTube for now
    if (url.includes('instagram.com')) return 'instagram';
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
    if (url.includes('podcasts.apple.com') || url.includes('.rss') || url.includes('podcast') || url.includes('/feed')) return 'podcast';
    if (url.includes('facebook.com') || url.includes('fb.watch')) return 'facebook';
    if (url.includes('linkedin.com')) return 'linkedin';
    if (url.includes('pinterest.com')) return 'pinterest';
    
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
    const platform = this.detectPlatform(url);
    if (!platform) {
      throw new Error('Unsupported platform');
    }

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
    
    // Check if auto-download is enabled
    const settings = settingsService.getSettings();
    if (settings.autoDownload) {
      this.startDownload(id);
    }
    
    return id;
  }

  private async testBackendConnectivity(): Promise<boolean> {
    try {
      const response = await axios.get(getApiUrl(API_CONFIG.ENDPOINTS.HEALTH), {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      console.error('Backend connectivity test failed:', error);
      return false;
    }
  }

  async startDownload(id: string) {
    const item = this.downloads.get(id);
    if (!item) return;

    try {
      // Test backend connectivity first
      const isBackendOnline = await this.testBackendConnectivity();
      if (!isBackendOnline) {
        throw new Error('Backend server is currently unavailable. Please check your internet connection and try again later.');
      }

      item.status = 'downloading';
      this.downloads.set(id, item);
      await this.saveDownloadsToStorage();

      let downloadData: {url: string, metadata?: any} | string | null = null;
      
      switch (item.platform) {
        case 'youtube':
          downloadData = await this.getYouTubeDownloadUrl(item.url);
          break;
        case 'instagram':
          downloadData = await this.getInstagramDownloadUrl(item.url);
          break;
        case 'tiktok':
          downloadData = await this.getTikTokDownloadUrl(item.url);
          break;
        case 'twitter':
          downloadData = await this.getTwitterDownloadUrl(item.url);
          break;
        case 'podcast':
          downloadData = await this.getPodcastDownloadUrl(item.url);
          break;
        case 'facebook':
          downloadData = await this.getFacebookDownloadUrl(item.url);
          break;
        case 'linkedin':
          downloadData = await this.getLinkedInDownloadUrl(item.url);
          break;
        case 'pinterest':
          downloadData = await this.getPinterestDownloadUrl(item.url);
          break;
        default:
          throw new Error(`Platform ${item.platform} not yet implemented`);
      }

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
      
      // Simplified - no playlist handling, all downloads are individual files

      const extension = this.getFileExtension(item.contentType, item.platform);
      const fileName = `${id}_${item.platform}_${item.contentType}.${extension}`;
      const filePath = `${this.downloadDirectory}${fileName}`;
      
      item.fileExtension = extension;

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
      
      // For audio files (especially podcasts), use server URL directly instead of downloading locally
      if (item.contentType === 'audio') {
        console.log('Audio file detected - using server URL for better streaming performance');
        
        // Clear the progress interval
        clearInterval(progressInterval);
        
        item.status = 'completed';
        item.progress = 100;
        item.filePath = downloadUrl; // Use server URL directly for audio
        item.downloadedAt = new Date().toISOString();
      } else {
        // For videos and images, download locally
        console.log('Saving to path:', filePath);
        
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
        
        // Check if file was actually downloaded
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        console.log('Downloaded file info:', fileInfo);

        // Clear the progress interval
        clearInterval(progressInterval);

        item.status = 'completed';
        item.progress = 100;
        // Use downloadResult.uri if available, otherwise use the original filePath
        item.filePath = downloadResult?.uri || filePath;
        item.downloadedAt = new Date().toISOString();
      }
      
      this.downloads.set(id, item);
      await this.saveDownloadsToStorage();

    } catch (error) {
      console.error('Download failed:', error);
      item.status = 'failed';
      this.downloads.set(id, item);
      await this.saveDownloadsToStorage();
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
        await FileSystem.deleteAsync(item.filePath);
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    }

    this.downloads.delete(id);
    await this.saveDownloadsToStorage();
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
          await FileSystem.deleteAsync(item.filePath);
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
}

export const downloadService = new DownloadService();