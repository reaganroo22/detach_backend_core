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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Download, ExternalLink, CircleAlert as AlertCircle, Trash2, Play, Folder } from 'lucide-react-native';
import { downloadService, DownloadItem } from '../../services/downloadService';

export default function DownloadTab() {
  const [url, setUrl] = useState('');
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
      Alert.alert('Success', 'Download started! Check the Library tab to see progress.');
      loadDownloads();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to start download');
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

  const openUrl = (url: string) => {
    Linking.openURL(url);
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Mindful Media</Text>
          <Text style={styles.subtitle}>
            "Be still and know that I am God" - Psalm 46:10
          </Text>
          <Text style={styles.description}>
            Save content locally for intentional, prayerful consumption
          </Text>
        </View>

        <View style={styles.inputSection}>
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
          
          <TouchableOpacity
            style={[styles.downloadButton, isLoading && styles.downloadButtonDisabled]}
            onPress={handleDownload}
            disabled={isLoading}
          >
            <Download size={20} color="#ffffff" />
            <Text style={styles.downloadButtonText}>
              {isLoading ? 'Starting Download...' : 'Download'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.supportedPlatforms}>
          <Text style={styles.sectionTitle}>Supported Platforms</Text>
          <View style={styles.platformGrid}>
            {['YouTube', 'Instagram', 'TikTok'].map((platform) => (
              <View key={platform} style={styles.platformChip}>
                <Text style={styles.platformText}>{platform}</Text>
              </View>
            ))}
          </View>
        </View>

        {downloads.length > 0 && (
          <View style={styles.recentDownloads}>
            <Text style={styles.sectionTitle}>Recent Downloads</Text>
            {downloads.slice(0, 5).map((item) => (
              <View key={item.id} style={styles.downloadItem}>
                <View style={styles.downloadInfo}>
                  <Text style={styles.platformName}>
                    {item.title || formatPlatformName(item.platform)}
                  </Text>
                  <Text style={styles.downloadTime}>
                    {item.downloadedAt 
                      ? new Date(item.downloadedAt).toLocaleString()
                      : 'In progress...'
                    }
                  </Text>
                  {item.status === 'downloading' && (
                    <Text style={styles.progressText}>
                      Progress: {item.progress}%
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
                      <Folder size={16} color="#6b7280" />
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => openUrl(item.url)}
                  >
                    <ExternalLink size={16} color="#6b7280" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => handleDeleteDownload(item.id)}
                  >
                    <Trash2 size={16} color="#ef4444" />
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
          <AlertCircle size={16} color="#f59e0b" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fefce8', // Warm ancient parchment background
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#92400e', // Ancient brown/gold color
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#b45309', // Warm golden brown
    textAlign: 'center',
    lineHeight: 24,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#a16207', // Darker golden color
    textAlign: 'center',
    lineHeight: 20,
  },
  inputSection: {
    backgroundColor: '#fffbeb', // Warm cream background
    borderRadius: 8, // Less rounded for ancient look
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
    borderRadius: 4, // Sharp corners
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#92400e',
  },
  downloadButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  downloadButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
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
});