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
  TextInput,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Download, Trash2, Folder, Copy, Eye, Headphones, FileText, ImageIcon, Video, FolderPlus, Archive, Edit3, MoreHorizontal, Settings, Plus } from 'lucide-react-native';
import { downloadService, DownloadItem, Folder as FolderType } from '../../services/downloadService';
import { playlistService } from '../../services/playlistService';
import EnhancedMediaViewer from '../../components/EnhancedMediaViewer';
import { useTheme } from '../../contexts/ThemeContext';
import { router } from 'expo-router';

export default function LibraryTab() {
  const { theme } = useTheme();
  const [filter, setFilter] = useState<'all' | 'completed' | 'downloading' | 'pending' | 'failed'>('completed');
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DownloadItem | null>(null);
  const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
  const [showOrganizeOptions, setShowOrganizeOptions] = useState(false);

  useEffect(() => {
    loadDownloads();
  }, [currentFolderId]);

  const loadDownloads = () => {
    if (currentFolderId) {
      // Load downloads from specific folder
      setDownloads(downloadService.getDownloadsByFolder(currentFolderId));
    } else {
      // Load all downloads or downloads not in any folder
      setDownloads(downloadService.getDownloads());
    }
    setFolders(downloadService.getFolders());
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDownloads();
    setRefreshing(false);
  };

  const filteredContent = downloads.filter(item => {
    // Filter by status
    const statusMatch = filter === 'all' || item.status === filter;
    
    // Filter by current folder
    if (currentFolderId) {
      return statusMatch && item.folderId === currentFolderId;
    } else {
      // When viewing "All Downloads", show items not in folders or all items based on filter
      return statusMatch;
    }
  });

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
      case 'completed': return theme.colors.surface;
      case 'downloading': return theme.colors.primary + '20'; // primary with opacity
      case 'pending': return theme.colors.textTertiary + '30'; // tertiary with opacity
      case 'failed': return theme.colors.error + '20'; // error with opacity
      default: return theme.colors.border;
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

  const handleClearCategory = async (category: 'all' | 'completed' | 'downloading' | 'pending' | 'failed') => {
    const categoryName = category === 'all' ? 'All Downloads' : `${category.charAt(0).toUpperCase() + category.slice(1)} Downloads`;
    const itemsToDelete = category === 'all' ? downloads : downloads.filter(d => d.status === category);
    
    if (itemsToDelete.length === 0) {
      Alert.alert('Nothing to Clear', `No ${category === 'all' ? '' : category + ' '}downloads found.`);
      return;
    }
    
    Alert.alert(
      `Clear ${categoryName}`,
      `Are you sure you want to clear ${itemsToDelete.length} ${category === 'all' ? '' : category + ' '}download(s)? This will delete local files.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Clear ${itemsToDelete.length}`,
          style: 'destructive',
          onPress: async () => {
            if (category === 'all') {
              await downloadService.clearAllDownloads();
            } else {
              // Delete individual items by category
              for (const item of itemsToDelete) {
                await downloadService.deleteDownload(item.id);
              }
            }
            loadDownloads();
          },
        },
      ]
    );
  };

  const handleViewFile = (item: DownloadItem) => {
    if (item.filePath) {
      Alert.alert(
        'File Location', 
        item.filePath, 
        [
          { text: 'Copy Path', onPress: () => Clipboard.setString(item.filePath || '') },
          { 
            text: 'View in Files', 
            onPress: async () => {
              try {
                // On iOS, use the file:// URL to open in Files app
                const fileUrl = item.filePath;
                const canOpen = await Linking.canOpenURL(fileUrl);
                if (canOpen) {
                  await Linking.openURL(fileUrl);
                } else {
                  Alert.alert('Cannot Open', 'Unable to open file in Files app');
                }
              } catch (error) {
                Alert.alert('Error', 'Failed to open file location');
              }
            }
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
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
        return <Headphones size={16} color={theme.colors.primary} />;
      case 'video':
        return <Video size={16} color={theme.colors.primary} />;
      case 'image':
        return <ImageIcon size={16} color={theme.colors.primary} />;
      case 'text':
        return <FileText size={16} color={theme.colors.primary} />;
      default:
        return <Eye size={16} color={theme.colors.primary} />;
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

  const handleCreateFolder = () => {
    Alert.prompt(
      'Create Folder',
      'Enter a name for your new folder:',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Create', 
          onPress: async (folderName) => {
            if (folderName && folderName.trim()) {
              try {
                const folderId = await downloadService.createFolder(folderName.trim());
                loadDownloads();
                setShowOrganizeOptions(false);
                Alert.alert(
                  'Folder Created!', 
                  `"${folderName.trim()}" folder has been created. You can now organize your downloads here.`,
                  [{ text: 'OK' }]
                );
              } catch (error) {
                Alert.alert('Error', 'Failed to create folder. Please try again.');
              }
            } else {
              Alert.alert('Invalid Name', 'Please enter a valid folder name.');
            }
          }
        }
      ],
      'plain-text',
      'My Folder'
    );
  };

  const handleStartDownload = async (itemId: string) => {
    try {
      await downloadService.startDownload(itemId);
      loadDownloads(); // Refresh the list
    } catch (error) {
      Alert.alert('Error', 'Failed to start download');
    }
  };

  const handleMoveToFolder = (downloadId: string) => {
    const folderOptions = [
      { text: 'All Downloads', onPress: () => moveItemToFolder(downloadId, undefined) },
      ...folders.map(folder => ({
        text: folder.name,
        onPress: () => moveItemToFolder(downloadId, folder.id)
      })),
      { text: 'Cancel', style: 'cancel' as const }
    ];

    Alert.alert('Move to Folder', 'Choose where to move this download:', folderOptions);
  };

  const moveItemToFolder = async (downloadId: string, folderId?: string) => {
    try {
      await downloadService.moveToFolder(downloadId, folderId);
      loadDownloads();
    } catch (error) {
      Alert.alert('Error', 'Failed to move item to folder.');
    }
  };

  const handleDeleteFolder = (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    Alert.alert(
      'Delete Folder',
      `Are you sure you want to delete "${folder?.name}"? All items will be moved to All Downloads.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await downloadService.deleteFolder(folderId);
            setCurrentFolderId(undefined);
            loadDownloads();
          },
        },
      ]
    );
  };

  const handleRenameFolder = (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    Alert.prompt(
      'Rename Folder',
      'Enter a new name for this folder:',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Rename', 
          onPress: async (newName) => {
            if (newName && newName.trim()) {
              await downloadService.renameFolder(folderId, newName.trim());
              loadDownloads();
            }
          }
        }
      ],
      'plain-text',
      folder?.name || ''
    );
  };

  const handleEditTitle = (downloadId: string) => {
    const download = downloads.find(d => d.id === downloadId);
    if (!download) return;

    Alert.prompt(
      'Edit Title',
      'Enter a new title for this download:',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Save', 
          onPress: async (newTitle) => {
            if (newTitle && newTitle.trim()) {
              const success = await downloadService.updateTitle(downloadId, newTitle.trim());
              if (success) {
                loadDownloads();
                Alert.alert('Success', 'Title updated successfully!');
              } else {
                Alert.alert('Error', 'Failed to update title. Please try again.');
              }
            }
          }
        }
      ],
      'plain-text',
      download.title
    );
  };

  const handleAddToPlaylist = (downloadId: string) => {
    const playlists = playlistService.getPlaylists();
    
    if (playlists.length === 0) {
      Alert.alert(
        'No Playlists',
        'You need to create a playlist first. Would you like to create one now?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Create Playlist',
            onPress: () => {
              Alert.prompt(
                'Create Playlist',
                'Enter a name for your new playlist:',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Create',
                    onPress: async (playlistName) => {
                      if (playlistName && playlistName.trim()) {
                        const playlistId = await playlistService.createPlaylist(playlistName.trim());
                        await playlistService.addToPlaylist(playlistId, downloadId);
                        Alert.alert('Success', `Added to "${playlistName}" playlist!`);
                      }
                    }
                  }
                ],
                'plain-text',
                'My Playlist'
              );
            }
          }
        ]
      );
      return;
    }

    const playlistOptions = [
      ...playlists.map(playlist => ({
        text: playlist.name,
        onPress: async () => {
          const success = await playlistService.addToPlaylist(playlist.id, downloadId);
          if (success) {
            Alert.alert('Success', `Added to "${playlist.name}" playlist!`);
          } else {
            Alert.alert('Error', 'This item is already in that playlist');
          }
        }
      })),
      { text: 'Cancel', style: 'cancel' as const }
    ];

    Alert.alert('Add to Playlist', 'Choose a playlist:', playlistOptions);
  };

  const handleFolderMenu = (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    Alert.alert(
      folder?.name || 'Folder',
      'Choose an action:',
      [
        { text: 'Rename', onPress: () => handleRenameFolder(folderId) },
        { text: 'Delete', style: 'destructive', onPress: () => handleDeleteFolder(folderId) },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerMain}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>
              {currentFolderId 
                ? folders.find(f => f.id === currentFolderId)?.name || 'Folder'
                : 'Your Library'
              }
            </Text>
            {currentFolderId && (
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => setCurrentFolderId(undefined)}
              >
                <Text style={styles.backButtonText}>← All</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.subtitle}>
            {filteredContent.length} downloads • {filteredContent.filter(d => d.status === 'completed').length} completed
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.settingsButton} 
            onPress={() => router.push('/settings')}
          >
            <Settings size={20} color={theme.colors.text} />
          </TouchableOpacity>
          {filteredContent.length > 0 && (
            <TouchableOpacity 
              style={styles.organizeButton} 
              onPress={() => setShowOrganizeOptions(!showOrganizeOptions)}
            >
              <FolderPlus size={16} color={theme.colors.primaryText} />
              <Text style={styles.organizeButtonText}>Organize</Text>
            </TouchableOpacity>
          )}
          {filteredContent.length > 0 && (
            <TouchableOpacity 
              style={styles.clearButton} 
              onPress={() => handleClearCategory(filter)}
            >
              <Text style={styles.clearButtonText}>
                Clear {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {showOrganizeOptions && (
        <View style={styles.organizeOptions}>
          <Text style={styles.organizeTitle}>Create Custom Folder</Text>
          <Text style={styles.organizeSubtitle}>
            Create a custom folder to organize your downloads by topic, category, or any way you'd like.
          </Text>
          <TouchableOpacity style={styles.createFolderButton} onPress={handleCreateFolder}>
            <FolderPlus size={20} color={theme.colors.primaryText} />
            <Text style={styles.createFolderButtonText}>Create New Folder</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterButtons}>
            {[
              { key: 'completed', label: 'Completed', count: downloads.filter(d => d.status === 'completed').length },
              { key: 'downloading', label: 'Downloading', count: downloads.filter(d => d.status === 'downloading').length },
              { key: 'pending', label: 'Pending', count: downloads.filter(d => d.status === 'pending').length },
              { key: 'failed', label: 'Failed', count: downloads.filter(d => d.status === 'failed').length },
              { key: 'all', label: 'All', count: downloads.length },
            ].map((filterOption) => (
              <TouchableOpacity
                key={filterOption.key}
                style={[
                  styles.filterButton,
                  filter === filterOption.key && styles.filterButtonActive,
                ]}
                onPress={() => setFilter(filterOption.key as 'all' | 'completed' | 'downloading' | 'pending' | 'failed')}
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
        {/* Folders Section - Only show when not in a specific folder AND on completed tab */}
        {!currentFolderId && folders.length > 0 && filter === 'completed' && (
          <View style={styles.foldersSection}>
            <Text style={styles.sectionTitle}>Folders</Text>
            <View style={styles.foldersGrid}>
              {folders.map((folder) => (
                <TouchableOpacity
                  key={folder.id}
                  style={styles.folderCard}
                  onPress={() => setCurrentFolderId(folder.id)}
                >
                  <View style={styles.folderHeader}>
                    <Folder size={20} color={theme.colors.primary} />
                    <TouchableOpacity
                      style={styles.folderMenuButton}
                      onPress={() => handleFolderMenu(folder.id)}
                    >
                      <MoreHorizontal size={16} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.folderName} numberOfLines={2}>
                    {folder.name}
                  </Text>
                  <Text style={styles.folderCount}>
                    {folder.itemCount} {folder.itemCount === 1 ? 'item' : 'items'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Downloads Section */}
        {filteredContent.length === 0 ? (
          <View style={styles.emptyState}>
            <Download size={64} color={theme.colors.textSecondary} />
            <Text style={styles.emptyTitle}>
              {downloads.length === 0 ? 'No Downloads Yet' : `No ${filter} Downloads`}
            </Text>
            <Text style={styles.emptySubtitle}>
              {downloads.length === 0 
                ? 'Download content from the Download tab to build your mindful library'
                : filter === 'pending'
                ? 'No pending downloads. Turn off Auto Download in Settings to queue URLs before downloading.'
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
                  
                  {item.isPlaylist && item.playlistItems && (
                    <Text style={styles.playlistInfo}>
                      📁 {item.playlistItems.length} items downloaded
                    </Text>
                  )}
                  {/* Debug: Show if item has playlist properties */}
                  
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
                  
                  {item.filePath && !item.isPlaylist && (
                    <Text style={styles.filePath} numberOfLines={1}>
                      File: {item.filePath?.split('/').pop() || 'Unknown'}
                    </Text>
                  )}
                  
                  {item.isPlaylist && item.playlistItems && item.playlistItems.length > 0 && (
                    <View style={styles.playlistPreview}>
                      {item.playlistItems.slice(0, 3).map((playlistItem, index) => (
                        <Text key={index} style={styles.playlistItemPreview} numberOfLines={1}>
                          • {playlistItem.title}
                        </Text>
                      ))}
                      {item.playlistItems.length > 3 && (
                        <Text style={styles.playlistItemPreview}>
                          + {item.playlistItems.length - 3} more items
                        </Text>
                      )}
                    </View>
                  )}
                </View>

                <View style={styles.contentActions}>
                  {item.status === 'pending' && (
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => handleStartDownload(item.id)}
                    >
                      <Download size={16} color={theme.colors.primary} />
                    </TouchableOpacity>
                  )}
                  
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
                      <Folder size={16} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => handleEditTitle(item.id)}
                  >
                    <Edit3 size={16} color={theme.colors.primary} />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => handleMoveToFolder(item.id)}
                  >
                    <Archive size={16} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                  
                  {item.status === 'completed' && (item.contentType === 'audio' || item.contentType === 'video') && (
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => handleAddToPlaylist(item.id)}
                    >
                      <Plus size={16} color={theme.colors.primary} />
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => handleCopyLink(item.url)}
                  >
                    <Copy size={16} color={theme.colors.text} />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => handleDeleteDownload(item.id)}
                  >
                    <Trash2 size={16} color={theme.colors.error} />
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
          playlist={filteredContent.filter(item => item.contentType === 'audio' && item.status === 'completed')}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: 20,
    paddingBottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerMain: {
    flex: 1,
    marginRight: 16,
  },
  headerActions: {
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-end',
  },
  organizeButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.colors.text,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  organizeButtonText: {
    color: theme.colors.primaryText,
    fontSize: 12,
    fontWeight: '600',
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 6,
    letterSpacing: -0.5,
    textShadowColor: theme.colors.shadow,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
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
    backgroundColor: '#ffffff', // Pure white for better contrast
    borderRadius: 16, // More modern rounded corners
    padding: 20,
    marginHorizontal: 4, // Add slight margin for shadow
    borderWidth: 0, // Remove border for cleaner look
    borderColor: 'transparent',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
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
  playlistInfo: {
    fontSize: 14,
    color: '#d97706', // Golden brown color
    fontWeight: '500',
    marginBottom: 4,
  },
  playlistPreview: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#fffbeb', // Warm cream background
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fbbf24', // Golden border
  },
  playlistItemPreview: {
    fontSize: 12,
    color: '#92400e', // Ancient brown text
    lineHeight: 16,
    marginBottom: 2,
  },
  organizeOptions: {
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    margin: 20,
    marginTop: 0,
    padding: 16,
    borderWidth: 2,
    borderColor: '#fbbf24',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  organizeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 8,
    textAlign: 'center',
  },
  organizeSubtitle: {
    fontSize: 14,
    color: '#a16207',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  createFolderButton: {
    backgroundColor: '#d97706',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  createFolderButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    backgroundColor: '#fbbf24',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#92400e',
  },
  backButtonText: {
    color: '#451a03',
    fontSize: 12,
    fontWeight: '500',
  },
  foldersSection: {
    marginBottom: 20,
  },
  foldersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  folderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    width: '47%',
    minHeight: 100,
    borderWidth: 2,
    borderColor: '#fbbf24',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  folderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  folderMenuButton: {
    padding: 4,
  },
  folderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#451a03',
    marginBottom: 4,
  },
  folderCount: {
    fontSize: 12,
    color: '#a16207',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#451a03',
    marginBottom: 12,
  },
});