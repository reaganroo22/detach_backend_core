import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  RefreshControl,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Download, Trash2, Folder, Copy, Eye, Headphones, FileText, ImageIcon, Video } from 'lucide-react-native';
import { downloadService, DownloadItem } from '../../services/downloadService';
import EnhancedMediaViewer from '../../components/EnhancedMediaViewer';

export default function LibraryTab() {
  const [filter, setFilter] = useState<'all' | 'completed' | 'downloading' | 'pending' | 'failed'>('all');
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DownloadItem | null>(null);
  const [mediaViewerVisible, setMediaViewerVisible] = useState(false);

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

  const filteredContent = downloads.filter(item => 
    filter === 'all' || item.status === filter
  );

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'In progress...';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    return date.toLocaleDateString();
  };

  const formatPlatformName = (platform: DownloadItem['platform']) => {
    switch (platform) {
      case 'youtube': return 'YouTube';
      case 'instagram': return 'Instagram';
      case 'tiktok': return 'TikTok';
      case 'twitter': return 'X/Twitter';
      case 'podcast': return 'Podcast';
      case 'facebook': return 'Facebook';
      case 'linkedin': return 'LinkedIn';
      default: return platform;
    }
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

  const handleDeleteDownload = async (id: string) => {
    Alert.alert(
      'Delete Download',
      'Are you sure you want to delete this download and its local file?',
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

  const handleClearAll = async () => {
    Alert.alert(
      'Clear All Downloads',
      'Are you sure you want to clear all downloads? This will delete all local files.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await downloadService.clearAllDownloads();
            loadDownloads();
          },
        },
      ]
    );
  };

  const handleViewFile = (item: DownloadItem) => {
    if (item.filePath) {
      Alert.alert('File Location', item.filePath, [
        { text: 'OK', style: 'default' },
      ]);
    } else {
      Alert.alert('No File', 'File not available');
    }
  };

  const handleOpenMedia = (item: DownloadItem) => {
    if (item.status === 'completed' && item.filePath) {
      setSelectedItem(item);
      setMediaViewerVisible(true);
    } else {
      Alert.alert('Not Available', 'Media file is not ready for viewing');
    }
  };

  const handleCloseMediaViewer = () => {
    setMediaViewerVisible(false);
    setSelectedItem(null);
  };

  const getContentTypeIcon = (contentType: DownloadItem['contentType']) => {
    switch (contentType) {
      case 'audio':
        return <Headphones size={16} color="#92400e" />; // Ancient brown
      case 'video':
        return <Video size={16} color="#92400e" />; // Ancient brown
      case 'image':
        return <ImageIcon size={16} color="#92400e" />; // Ancient brown
      case 'text':
        return <FileText size={16} color="#92400e" />; // Ancient brown
      default:
        return <Eye size={16} color="#92400e" />; // Ancient brown
    }
  };

  const handleCopyLink = async (url: string) => {
    try {
      Clipboard.setString(url);
      Alert.alert('Copied', 'Link copied to clipboard');
    } catch (error) {
      Alert.alert('Error', 'Failed to copy link');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Library</Text>
        <Text style={styles.subtitle}>
          {downloads.length} downloads • {downloads.filter(d => d.status === 'completed').length} completed
        </Text>
        {downloads.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={handleClearAll}>
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterButtons}>
            {[
              { key: 'all', label: 'All', count: downloads.length },
              { key: 'completed', label: 'Completed', count: downloads.filter(d => d.status === 'completed').length },
              { key: 'downloading', label: 'Downloading', count: downloads.filter(d => d.status === 'downloading').length },
              { key: 'pending', label: 'Pending', count: downloads.filter(d => d.status === 'pending').length },
              { key: 'failed', label: 'Failed', count: downloads.filter(d => d.status === 'failed').length },
            ].map((filterOption) => (
              <TouchableOpacity
                key={filterOption.key}
                style={[
                  styles.filterButton,
                  filter === filterOption.key && styles.filterButtonActive,
                ]}
                onPress={() => setFilter(filterOption.key as any)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    filter === filterOption.key && styles.filterButtonTextActive,
                  ]}
                >
                  {filterOption.label}
                  {filterOption.count > 0 && ` (${filterOption.count})`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredContent.length === 0 ? (
          <View style={styles.emptyState}>
            <Download size={64} color="#a16207" /> {/* Darker golden color */}
            <Text style={styles.emptyTitle}>
              {downloads.length === 0 ? 'No Downloads Yet' : `No ${filter} Downloads`}
            </Text>
            <Text style={styles.emptySubtitle}>
              {downloads.length === 0 
                ? 'Download content from the Download tab to build your mindful library'
                : `No downloads with ${filter} status found`
              }
            </Text>
          </View>
        ) : (
          <View style={styles.contentGrid}>
            {filteredContent.map((item) => (
              <View key={item.id} style={styles.contentCard}>
                <View style={styles.contentHeader}>
                  <View style={styles.platformBadge}>
                    <Text style={styles.platformText}>{formatPlatformName(item.platform)}</Text>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(item.status) }
                  ]}>
                    <Text style={styles.statusText}>{item.status}</Text>
                  </View>
                </View>
                
                <View style={styles.contentInfo}>
                  <Text style={styles.contentTitle} numberOfLines={2}>
                    {item.title || 'Untitled'}
                  </Text>
                  <Text style={styles.downloadDate}>
                    {item.downloadedAt ? `Downloaded ${formatDate(item.downloadedAt)}` : 'In progress...'}
                  </Text>
                  
                  {item.status === 'downloading' && (
                    <View style={styles.progressContainer}>
                      <View style={styles.progressBar}>
                        <View 
                          style={[styles.progressFill, { width: `${Math.round(item.progress || 0)}%` }]} 
                        />
                      </View>
                      <Text style={styles.progressText}>{Math.round(item.progress || 0)}%</Text>
                    </View>
                  )}
                  
                  {item.filePath && (
                    <Text style={styles.filePath} numberOfLines={1}>
                      File: {item.filePath?.split('/').pop() || 'Unknown'}
                    </Text>
                  )}
                </View>

                <View style={styles.contentActions}>
                  {item.status === 'completed' && item.filePath && (
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => handleOpenMedia(item)}
                    >
                      {getContentTypeIcon(item.contentType)}
                    </TouchableOpacity>
                  )}
                  
                  {item.status === 'completed' && item.filePath && (
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => handleViewFile(item)}
                    >
                      <Folder size={16} color="#451a03" /> {/* Dark brown */}
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => handleCopyLink(item.url)}
                  >
                    <Copy size={16} color="#451a03" /> {/* Dark brown */}
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => handleDeleteDownload(item.id)}
                  >
                    <Trash2 size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      
      {selectedItem && (
        <EnhancedMediaViewer
          item={selectedItem}
          visible={mediaViewerVisible}
          onClose={handleCloseMediaViewer}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fefce8', // Warm ancient parchment background
  },
  header: {
    padding: 20,
    paddingBottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#92400e', // Ancient brown/gold color
    marginBottom: 4,
    flex: 1,
  },
  subtitle: {
    fontSize: 16,
    color: '#a16207', // Darker golden color
    flex: 1,
  },
  clearButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4, // Sharp corners for ancient look
    borderWidth: 2,
    borderColor: '#dc2626',
  },
  clearButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  filterSection: {
    paddingVertical: 20,
    paddingLeft: 20,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 20,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4, // Sharp corners for ancient look
    backgroundColor: '#fffbeb', // Warm cream background
    borderWidth: 2,
    borderColor: '#fbbf24', // Golden border
  },
  filterButtonActive: {
    backgroundColor: '#d97706', // Golden brown active
    borderColor: '#92400e', // Ancient brown border
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#92400e', // Ancient brown text
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#92400e', // Ancient brown
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#a16207', // Darker golden color
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 40,
  },
  contentGrid: {
    gap: 16,
    paddingBottom: 20,
  },
  contentCard: {
    backgroundColor: '#fffbeb', // Warm cream background
    borderRadius: 8, // Less rounded for ancient look
    padding: 16,
    borderWidth: 2,
    borderColor: '#fbbf24', // Golden border
    shadowColor: '#92400e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  contentInfo: {
    flex: 1,
    marginBottom: 12,
  },
  platformBadge: {
    backgroundColor: '#fbbf24', // Golden background
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4, // Sharp corners
    borderWidth: 2,
    borderColor: '#92400e', // Ancient brown border
  },
  platformText: {
    fontSize: 12,
    color: '#451a03', // Dark brown text
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4, // Sharp corners
    borderWidth: 1,
    borderColor: '#92400e', // Ancient brown border
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#92400e', // Ancient brown text
  },
  contentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#451a03', // Dark brown text
    lineHeight: 22,
    marginBottom: 4,
  },
  downloadDate: {
    fontSize: 14,
    color: '#a16207', // Darker golden color
    marginBottom: 4,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 3,
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#d97706', // Golden brown progress
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#d97706', // Golden brown text
    fontWeight: '600',
    minWidth: 32,
  },
  filePath: {
    fontSize: 12,
    color: '#a16207', // Darker golden color
    fontFamily: 'monospace',
  },
  contentActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 4, // Sharp corners for ancient look
    backgroundColor: '#fbbf24', // Golden background
    borderWidth: 2,
    borderColor: '#92400e', // Ancient brown border
    justifyContent: 'center',
    alignItems: 'center',
  },
});