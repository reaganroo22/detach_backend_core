import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Download, CircleAlert as AlertCircle, Trash2, Play, Folder } from 'lucide-react-native';
import { downloadService, DownloadItem } from '../../services/downloadService';
import { useTheme } from '../../contexts/ThemeContext';

export default function DownloadTab() {
  const { theme, settings } = useTheme();
  const [url, setUrl] = useState('');
  const [urls, setUrls] = useState(''); // Multiple URLs input
  const [isMultipleMode, setIsMultipleMode] = useState(false);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDownloads();
  }, []);

  const loadDownloads = () => {
    setDownloads(downloadService.getDownloads());
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDownloads();
    setRefreshing(false);
  };

  const isValidUrl = (string: string): boolean => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const handleDownload = async () => {
    if (isMultipleMode) {
      return handleMultipleDownload();
    }

    if (!url.trim()) {
      Alert.alert('Error', 'Please enter a URL');
      return;
    }

    if (!isValidUrl(url)) {
      Alert.alert('Error', 'Please enter a valid URL');
      return;
    }

    setIsLoading(true);
    
    try {
      await downloadService.addDownload(url.trim());
      setUrl('');
      const message = settings.autoDownload 
        ? 'Download started! Check the Library tab to see progress.'
        : 'URL added to pending! Go to Library > Pending to start the download.';
      Alert.alert('Success', message);
      loadDownloads();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to start download');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMultipleDownload = async () => {
    if (!urls.trim()) {
      Alert.alert('Error', 'Please enter URLs (one per line)');
      return;
    }

    // Split URLs by newlines and filter out empty lines
    const urlList = urls
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.length > 0);

    if (urlList.length === 0) {
      Alert.alert('Error', 'No valid URLs found');
      return;
    }

    // Validate all URLs
    const invalidUrls = urlList.filter(u => !isValidUrl(u));
    if (invalidUrls.length > 0) {
      Alert.alert(
        'Invalid URLs', 
        `Found ${invalidUrls.length} invalid URL(s):\n${invalidUrls.slice(0, 3).join('\n')}${invalidUrls.length > 3 ? '\n...' : ''}`
      );
      return;
    }

    setIsLoading(true);
    let successCount = 0;
    let failCount = 0;

    try {
      // Process URLs sequentially to avoid overwhelming the backend
      for (const singleUrl of urlList) {
        try {
          await downloadService.addDownload(singleUrl);
          successCount++;
        } catch (error) {
          console.error(`Failed to download ${singleUrl}:`, error);
          failCount++;
        }
      }

      setUrls('');
      
      if (successCount > 0) {
        const statusText = settings.autoDownload ? 'Started' : 'Added to pending';
        const actionText = settings.autoDownload 
          ? 'Check the Library tab to see progress.'
          : 'Go to Library > Pending to start downloads.';
        Alert.alert(
          'Batch Download', 
          `${statusText} ${successCount} download(s)${failCount > 0 ? ` (${failCount} failed)` : ''}. ${actionText}`
        );
      } else {
        Alert.alert('Error', 'All downloads failed to start');
      }
      
      loadDownloads();
    } catch (error) {
      Alert.alert('Error', 'Failed to process batch download');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDownload = async (id: string) => {
    Alert.alert(
      'Delete Download',
      'Are you sure you want to delete this download?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await downloadService.deleteDownload(id);
            loadDownloads();
          },
        },
      ]
    );
  };


  const getStatusColor = (status: DownloadItem['status']) => {
    switch (status) {
      case 'completed': return '#dcfce7';
      case 'downloading': return '#bfdbfe';
      case 'pending': return '#fef3c7';
      case 'failed': return '#fecaca';
      default: return '#f3f4f6';
    }
  };

  const formatPlatformName = (platform: DownloadItem['platform']) => {
    switch (platform) {
      case 'youtube': return 'YouTube';
      case 'instagram': return 'Instagram';
      case 'tiktok': return 'TikTok';
      case 'facebook': return 'Facebook';
      case 'twitter': return 'X/Twitter';
      case 'linkedin': return 'LinkedIn';
      case 'pinterest': return 'Pinterest';
      default: return platform;
    }
  };

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Image 
              source={require('../../assets/images/icon.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Temperance</Text>
          </View>
          <Text style={styles.subtitle}>
            "Be still and know that I am God" - Psalm 46:10
          </Text>
          <Text style={styles.description}>
            Save content locally for intentional, prayerful consumption
          </Text>
        </View>

        <View style={styles.inputSection}>
          <View style={styles.modeToggle}>
            <Text style={styles.label}>Download Mode</Text>
            <View style={styles.toggleButtons}>
              <TouchableOpacity
                style={[styles.toggleButton, !isMultipleMode && styles.toggleButtonActive]}
                onPress={() => setIsMultipleMode(false)}
              >
                <Text style={[styles.toggleButtonText, !isMultipleMode && styles.toggleButtonTextActive]}>
                  Single URL
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, isMultipleMode && styles.toggleButtonActive]}
                onPress={() => setIsMultipleMode(true)}
              >
                <Text style={[styles.toggleButtonText, isMultipleMode && styles.toggleButtonTextActive]}>
                  Multiple URLs
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {!isMultipleMode ? (
            // Single URL input
            <>
              <Text style={styles.label}>Paste URL</Text>
              <TextInput
                style={styles.input}
                value={url}
                onChangeText={setUrl}
                placeholder="https://www.youtube.com/watch?v=..."
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </>
          ) : (
            // Multiple URLs input
            <>
              <Text style={styles.label}>Paste URLs (one per line)</Text>
              <TextInput
                style={styles.multilineInput}
                value={urls}
                onChangeText={setUrls}
                placeholder={`https://www.youtube.com/watch?v=...
https://www.instagram.com/p/...
https://www.tiktok.com/@user/video/...`}
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
              <Text style={styles.multilineHint}>
                📝 {urls.split('\n').filter(u => u.trim()).length} URLs detected
              </Text>
            </>
          )}
          
          <TouchableOpacity
            style={[styles.downloadButton, isLoading && styles.downloadButtonDisabled]}
            onPress={handleDownload}
            disabled={isLoading}
          >
            <Download size={20} color={theme.colors.primaryText} />
            <Text style={styles.downloadButtonText}>
              {isLoading 
                ? (isMultipleMode ? 'Starting Downloads...' : 'Starting Download...') 
                : (isMultipleMode ? 'Download All' : 'Download')
              }
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.supportedPlatforms}>
          <Text style={styles.sectionTitle}>Supported Platforms</Text>
          <View style={styles.platformGrid}>
            {['YouTube', 'Instagram', 'TikTok', 'Facebook', 'X/Twitter', 'LinkedIn', 'Pinterest', 'Podcasts'].map((platform) => (
              <View key={platform} style={styles.platformChip}>
                <Text style={styles.platformText}>{platform}</Text>
              </View>
            ))}
          </View>
        </View>

        {downloads.length > 0 && (
          <View style={styles.recentDownloads}>
            <Text style={styles.sectionTitle}>Recent Downloads</Text>
            {downloads
              .sort((a, b) => {
                const dateA = a.downloadedAt ? new Date(a.downloadedAt).getTime() : 0;
                const dateB = b.downloadedAt ? new Date(b.downloadedAt).getTime() : 0;
                return dateB - dateA; // Most recent first
              })
              .slice(0, 5)
              .map((item) => (
              <View key={item.id} style={styles.downloadItem}>
                <View style={styles.downloadInfo}>
                  <View style={styles.downloadHeader}>
                    <Text style={styles.platformName} numberOfLines={1}>
                      {item.title || formatPlatformName(item.platform)}
                    </Text>
                    <View style={styles.platformBadge}>
                      <Text style={styles.platformBadgeText}>
                        {formatPlatformName(item.platform)}
                      </Text>
                    </View>
                  </View>
                  
                  {item.isPlaylist && item.playlistItems && (
                    <Text style={styles.playlistIndicator}>
                      📁 {item.playlistItems.length} items in playlist
                    </Text>
                  )}
                  
                  <Text style={styles.downloadTime}>
                    {item.downloadedAt 
                      ? `Downloaded ${new Date(item.downloadedAt).toLocaleDateString()}`
                      : 'In progress...'
                    }
                  </Text>
                  
                  {item.status === 'downloading' && (
                    <View style={styles.progressContainer}>
                      <View style={styles.progressBar}>
                        <View 
                          style={[styles.progressFill, { width: `${Math.round(item.progress || 0)}%` }]} 
                        />
                      </View>
                      <Text style={styles.progressText}>
                        {Math.round(item.progress || 0)}%
                      </Text>
                    </View>
                  )}
                  
                  {item.status === 'completed' && item.fileExtension && (
                    <Text style={styles.fileInfo}>
                      📄 {item.fileExtension.toUpperCase()} • {item.contentType}
                    </Text>
                  )}
                </View>
                <View style={styles.downloadActions}>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(item.status) }
                  ]}>
                    <Text style={styles.statusText}>{item.status}</Text>
                  </View>
                  
                  {item.status === 'completed' && item.filePath && (
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => Alert.alert('File Path', item.filePath || 'No file path')}
                    >
                      <Folder size={16} color={theme.colors.text} />
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => handleDeleteDownload(item.id)}
                  >
                    <Trash2 size={16} color={theme.colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            
            {downloads.length > 5 && (
              <Text style={styles.moreText}>
                +{downloads.length - 5} more downloads. Check Library tab for all downloads.
              </Text>
            )}
          </View>
        )}

        <View style={styles.disclaimer}>
          <AlertCircle size={16} color={theme.colors.warning} />
          <Text style={styles.disclaimerText}>
            This app helps you save content for intentional, offline consumption. 
            Please respect content creators' rights and platform terms of service.
            Backend service required for downloading functionality.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  logo: {
    width: 32,
    height: 32,
    marginRight: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
    textShadowColor: theme.colors.shadow,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  inputSection: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 24,
    marginBottom: 28,
    marginHorizontal: 4,
    borderWidth: 0,
    borderColor: 'transparent',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400e', // Ancient brown
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderColor: '#d97706', // Golden border
    borderRadius: 4, // Sharp corners for HTML look
    padding: 16,
    fontSize: 16,
    color: '#451a03', // Dark brown text
    backgroundColor: '#fefce8', // Light parchment
    marginBottom: 16,
  },
  downloadButton: {
    backgroundColor: '#d97706', // Golden brown button
    borderRadius: 16, // More rounded
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 0,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  downloadButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowOpacity: 0,
  },
  downloadButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  supportedPlatforms: {
    backgroundColor: '#fffbeb', // Warm cream background
    borderRadius: 8,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#fbbf24', // Golden border
    shadowColor: '#92400e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#92400e', // Ancient brown
    marginBottom: 16,
  },
  platformGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  platformChip: {
    backgroundColor: '#fbbf24', // Golden background
    borderRadius: 4, // Sharp corners
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: '#92400e', // Dark brown border
  },
  platformText: {
    fontSize: 14,
    color: '#451a03', // Dark brown text
    fontWeight: '500',
  },
  recentDownloads: {
    backgroundColor: '#ffffff', // Pure white
    borderRadius: 20,
    padding: 24,
    marginBottom: 28,
    marginHorizontal: 4, // For shadow
    borderWidth: 0,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 10,
  },
  downloadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
  },
  downloadInfo: {
    flex: 1,
  },
  platformName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  downloadTime: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#2563eb',
    marginTop: 2,
  },
  downloadActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  iconButton: {
    padding: 4,
  },
  moreText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fffbeb',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  disclaimerText: {
    flex: 1,
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
  },
  modeToggle: {
    marginBottom: 16,
  },
  toggleButtons: {
    flexDirection: 'row',
    marginTop: 8,
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fbbf24',
    padding: 2,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#d97706',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#92400e',
  },
  toggleButtonTextActive: {
    color: '#ffffff',
  },
  multilineInput: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#fbbf24',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    color: '#451a03',
  },
  multilineHint: {
    fontSize: 12,
    color: '#d97706',
    marginTop: 4,
    fontWeight: '500',
  },
  downloadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 8,
  },
  platformBadge: {
    backgroundColor: '#fbbf24',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#92400e',
  },
  platformBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#451a03',
  },
  playlistIndicator: {
    fontSize: 12,
    color: '#d97706',
    fontWeight: '500',
    marginBottom: 4,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#fef3c7',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#d97706',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    color: '#92400e',
    fontWeight: '500',
  },
  fileInfo: {
    fontSize: 11,
    color: '#a16207',
    marginTop: 4,
    fontFamily: 'monospace',
  },
});