import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Plus, 
  Play, 
  Shuffle, 
  List, 
  Edit3, 
  Trash2, 
  MoreHorizontal,
  Settings,
  Music,
  Clock,
  X,
  Check,
  Headphones,
  Video
} from 'lucide-react-native';
import { playlistService, Playlist } from '../../services/playlistService';
import { downloadService, DownloadItem } from '../../services/downloadService';
import { useTheme } from '../../contexts/ThemeContext';
import { router } from 'expo-router';
import EnhancedMediaViewer from '../../components/EnhancedMediaViewer';

export default function PlaylistsTab() {
  const { theme } = useTheme();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
  const [currentTrackItem, setCurrentTrackItem] = useState<any>(null);
  const [showContentSelector, setShowContentSelector] = useState(false);
  const [selectedPlaylistForContent, setSelectedPlaylistForContent] = useState<Playlist | null>(null);
  const [availableContent, setAvailableContent] = useState<DownloadItem[]>([]);

  useEffect(() => {
    loadPlaylists();
  }, []);

  const loadPlaylists = async () => {
    setPlaylists(playlistService.getPlaylists());
    loadAvailableContent();
  };

  const loadAvailableContent = () => {
    // Get all completed audio/video downloads
    const allDownloads = downloadService.getDownloads();
    const audioVideoContent = allDownloads.filter(item => 
      item.status === 'completed' && 
      (item.contentType === 'audio' || item.contentType === 'video')
    );
    setAvailableContent(audioVideoContent);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPlaylists();
    setRefreshing(false);
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) {
      Alert.alert('Error', 'Please enter a playlist name');
      return;
    }

    try {
      await playlistService.createPlaylist(newPlaylistName.trim());
      setNewPlaylistName('');
      setIsCreatingPlaylist(false);
      await loadPlaylists();
      Alert.alert('Success', 'Playlist created successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to create playlist');
    }
  };

  const handlePlayPlaylist = async (playlist: Playlist, shuffle: boolean = false) => {
    if (playlist.items.length === 0) {
      Alert.alert('Empty Playlist', 'This playlist has no tracks to play');
      return;
    }

    try {
      await playlistService.startPlaylist(playlist.id, 0, shuffle);
      
      // Get the first track to play
      const firstItemId = playlist.items[0].downloadItemId;
      const downloadItem = downloadService.getDownloadById(firstItemId);
      
      if (downloadItem && downloadItem.status === 'completed' && (downloadItem.contentType === 'audio' || downloadItem.contentType === 'video')) {
        setCurrentTrackItem(downloadItem);
        setSelectedPlaylist(playlist);
        setMediaViewerVisible(true);
      } else {
        Alert.alert('Error', 'Unable to play the first track in this playlist');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to start playlist playback');
    }
  };

  const handleDeletePlaylist = (playlist: Playlist) => {
    Alert.alert(
      'Delete Playlist',
      `Are you sure you want to delete "${playlist.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await playlistService.deletePlaylist(playlist.id);
            await loadPlaylists();
          },
        },
      ]
    );
  };

  const handleRenamePlaylist = (playlist: Playlist) => {
    Alert.prompt(
      'Rename Playlist',
      'Enter a new name for this playlist:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async (newName) => {
            if (newName && newName.trim()) {
              await playlistService.renamePlaylist(playlist.id, newName.trim());
              await loadPlaylists();
            }
          },
        },
      ],
      'plain-text',
      playlist.name
    );
  };

  const handlePlaylistMenu = (playlist: Playlist) => {
    Alert.alert(
      playlist.name,
      'Choose an action:',
      [
        {
          text: 'Play',
          onPress: () => handlePlayPlaylist(playlist, false),
        },
        {
          text: 'Shuffle Play',
          onPress: () => handlePlayPlaylist(playlist, true),
        },
        {
          text: 'Add Content',
          onPress: () => handleAddContentToPlaylist(playlist),
        },
        {
          text: 'Manage Tracks',
          onPress: () => {
            // Navigate to playlist detail screen
            router.push(`/playlist/${playlist.id}`);
          },
        },
        {
          text: 'Rename',
          onPress: () => handleRenamePlaylist(playlist),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDeletePlaylist(playlist),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleAddContentToPlaylist = (playlist: Playlist) => {
    setSelectedPlaylistForContent(playlist);
    setShowContentSelector(true);
  };

  const handleAddToSelectedPlaylist = async (downloadId: string) => {
    if (!selectedPlaylistForContent) return;

    const success = await playlistService.addToPlaylist(selectedPlaylistForContent.id, downloadId);
    if (success) {
      Alert.alert('Success', `Added to "${selectedPlaylistForContent.name}" playlist!`);
      await loadPlaylists(); // Refresh playlists
    } else {
      Alert.alert('Error', 'This item is already in that playlist or failed to add');
    }
  };

  const handleCloseContentSelector = () => {
    setShowContentSelector(false);
    setSelectedPlaylistForContent(null);
  };

  const isItemInPlaylist = (downloadId: string): boolean => {
    if (!selectedPlaylistForContent) return false;
    return selectedPlaylistForContent.items.some(item => item.downloadItemId === downloadId);
  };

  const handleSettingsPress = () => {
    router.push('/settings');
  };

  const handleCloseMediaViewer = () => {
    setMediaViewerVisible(false);
    setCurrentTrackItem(null);
    setSelectedPlaylist(null);
  };

  const handleTrackChange = (newItem: DownloadItem) => {
    console.log('Track change requested:', newItem.title, newItem.contentType);
    
    // Direct transition - just update the item
    // The EnhancedMediaViewer will handle content type changes internally
    setCurrentTrackItem(newItem);
  };

  const formatCreatedDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    return date.toLocaleDateString();
  };

  const getPlaylistDuration = (playlist: Playlist): string => {
    // This would need to calculate total duration from download items
    // For now, just show track count
    return `${playlist.items.length} tracks`;
  };

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerMain}>
          <Text style={styles.title}>Your Playlists</Text>
          <Text style={styles.subtitle}>
            {playlists.length} {playlists.length === 1 ? 'playlist' : 'playlists'}
          </Text>
        </View>
        <TouchableOpacity style={styles.settingsButton} onPress={handleSettingsPress}>
          <Settings size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {isCreatingPlaylist && (
        <View style={styles.createPlaylistSection}>
          <Text style={styles.createTitle}>Create New Playlist</Text>
          <TextInput
            style={styles.textInput}
            value={newPlaylistName}
            onChangeText={setNewPlaylistName}
            placeholder="Enter playlist name..."
            placeholderTextColor={theme.colors.textTertiary}
            autoFocus
          />
          <View style={styles.createButtons}>
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={() => {
                setIsCreatingPlaylist(false);
                setNewPlaylistName('');
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.createButton} onPress={handleCreatePlaylist}>
              <Text style={styles.createButtonText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {playlists.length === 0 ? (
          <View style={styles.emptyState}>
            <Music size={64} color={theme.colors.textSecondary} />
            <Text style={styles.emptyTitle}>No Playlists Yet</Text>
            <Text style={styles.emptySubtitle}>
              Create your first playlist to organize your downloaded content for continuous playback
            </Text>
          </View>
        ) : (
          <View style={styles.playlistsGrid}>
            {playlists.map((playlist) => (
              <TouchableOpacity
                key={playlist.id}
                style={styles.playlistCard}
                onPress={() => router.push(`/playlist/${playlist.id}`)}
              >
                <View style={styles.playlistHeader}>
                  <View style={styles.playlistIcon}>
                    <List size={24} color={theme.colors.primary} />
                  </View>
                  <TouchableOpacity
                    style={styles.playlistMenuButton}
                    onPress={() => handlePlaylistMenu(playlist)}
                  >
                    <MoreHorizontal size={16} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.playlistName} numberOfLines={2}>
                  {playlist.name}
                </Text>
                
                <View style={styles.playlistMeta}>
                  <Text style={styles.playlistCount}>
                    {getPlaylistDuration(playlist)}
                  </Text>
                  <Text style={styles.playlistDate}>
                    Created {formatCreatedDate(playlist.createdAt)}
                  </Text>
                </View>

                <View style={styles.playlistActions}>
                  <TouchableOpacity
                    style={styles.playButton}
                    onPress={() => handlePlayPlaylist(playlist, false)}
                  >
                    <Play size={16} color="white" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.shuffleButton}
                    onPress={() => handlePlayPlaylist(playlist, true)}
                  >
                    <Shuffle size={16} color={theme.colors.primary} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setIsCreatingPlaylist(true)}
      >
        <Plus size={24} color="white" />
      </TouchableOpacity>

      {currentTrackItem && selectedPlaylist && (
        <EnhancedMediaViewer
          item={currentTrackItem}
          visible={mediaViewerVisible}
          onClose={handleCloseMediaViewer}
          playlist={downloadService.getDownloads().filter(item => 
            selectedPlaylist.items.some(pItem => pItem.downloadItemId === item.id) &&
            (item.contentType === 'audio' || item.contentType === 'video') && 
            item.status === 'completed'
          )}
          isPlaylistMode={true}
          onTrackChange={handleTrackChange}
        />
      )}

      {/* Content Selector Modal */}
      <Modal
        visible={showContentSelector}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderMain}>
              <Text style={styles.modalTitle}>
                Add to "{selectedPlaylistForContent?.name}"
              </Text>
              <Text style={styles.modalSubtitle}>
                Select content to add to your playlist
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.modalCloseButton} 
              onPress={handleCloseContentSelector}
            >
              <X size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {availableContent.length === 0 ? (
              <View style={styles.modalEmptyState}>
                <Music size={64} color={theme.colors.textSecondary} />
                <Text style={styles.modalEmptyTitle}>No Content Available</Text>
                <Text style={styles.modalEmptySubtitle}>
                  You need to download some audio or video content first
                </Text>
              </View>
            ) : (
              <View style={styles.contentList}>
                {availableContent.map((item) => {
                  const isInPlaylist = isItemInPlaylist(item.id);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.contentItem,
                        isInPlaylist && styles.contentItemAdded
                      ]}
                      onPress={() => !isInPlaylist && handleAddToSelectedPlaylist(item.id)}
                      disabled={isInPlaylist}
                    >
                      <View style={styles.contentItemIcon}>
                        {item.contentType === 'audio' ? (
                          <Headphones size={20} color={theme.colors.primary} />
                        ) : (
                          <Video size={20} color={theme.colors.primary} />
                        )}
                      </View>
                      
                      <View style={styles.contentItemInfo}>
                        <Text style={styles.contentItemTitle} numberOfLines={2}>
                          {item.title || 'Untitled'}
                        </Text>
                        <Text style={styles.contentItemMeta}>
                          {item.platform.charAt(0).toUpperCase() + item.platform.slice(1)} • {item.contentType}
                        </Text>
                      </View>
                      
                      <View style={styles.contentItemAction}>
                        {isInPlaylist ? (
                          <View style={styles.addedBadge}>
                            <Check size={16} color="white" />
                          </View>
                        ) : (
                          <View style={styles.addButton}>
                            <Plus size={16} color={theme.colors.primary} />
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  createPlaylistSection: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    margin: 20,
    marginTop: 10,
    padding: 20,
    borderWidth: 2,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  createTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: 16,
  },
  createButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '500',
  },
  createButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  createButtonText: {
    color: theme.colors.primaryText,
    fontSize: 16,
    fontWeight: '600',
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
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 40,
  },
  playlistsGrid: {
    gap: 16,
    paddingVertical: 20,
  },
  playlistCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 4,
    borderWidth: 0,
    borderColor: 'transparent',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  playlistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  playlistIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistMenuButton: {
    padding: 4,
  },
  playlistName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
    lineHeight: 24,
  },
  playlistMeta: {
    marginBottom: 16,
  },
  playlistCount: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  playlistDate: {
    fontSize: 12,
    color: theme.colors.textTertiary,
  },
  playlistActions: {
    flexDirection: 'row',
    gap: 12,
  },
  playButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  shuffleButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalHeaderMain: {
    flex: 1,
    marginRight: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modalEmptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  modalEmptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  modalEmptySubtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 40,
  },
  contentList: {
    paddingVertical: 20,
    gap: 12,
  },
  contentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: theme.colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  contentItemAdded: {
    backgroundColor: theme.colors.surface,
    opacity: 0.6,
  },
  contentItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contentItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  contentItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    lineHeight: 22,
    marginBottom: 4,
  },
  contentItemMeta: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  contentItemAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    width: '100%',
    height: '100%',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addedBadge: {
    backgroundColor: theme.colors.primary,
    width: '100%',
    height: '100%',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});