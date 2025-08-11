import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  FlatList,
  Animated,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { 
  ArrowLeft, 
  Play, 
  Shuffle, 
  Plus,
  Trash2,
  MoreVertical,
  Music,
  Headphones,
  Video,
  Menu,
  X,
  Check,
  ArrowUp,
  ArrowDown
} from 'lucide-react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { playlistService, Playlist, PlaylistItem } from '../../services/playlistService';
import { downloadService, DownloadItem } from '../../services/downloadService';
import { useTheme } from '../../contexts/ThemeContext';
import EnhancedMediaViewer from '../../components/EnhancedMediaViewer';

export default function PlaylistDetailScreen() {
  const { theme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<DownloadItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<DownloadItem | null>(null);
  const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
  const [showContentSelector, setShowContentSelector] = useState(false);
  const [availableContent, setAvailableContent] = useState<DownloadItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (id) {
      loadPlaylist();
    }
  }, [id]);

  const loadPlaylist = () => {
    if (!id) return;
    
    const playlistData = playlistService.getPlaylist(id);
    if (!playlistData) {
      Alert.alert('Error', 'Playlist not found');
      router.back();
      return;
    }
    
    setPlaylist(playlistData);
    
    // Load actual download items for the playlist
    const tracks = playlistData.items.map(item => {
      return downloadService.getDownloadById(item.downloadItemId);
    }).filter(item => item !== null) as DownloadItem[];
    
    setPlaylistTracks(tracks);
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


  const handlePlayPlaylist = async (shuffle: boolean = false) => {
    if (!playlist || playlist.items.length === 0) {
      Alert.alert('Empty Playlist', 'This playlist has no tracks to play');
      return;
    }

    try {
      await playlistService.startPlaylist(playlist.id, 0, shuffle);
      
      const firstTrack = playlistTracks[0];
      if (firstTrack && firstTrack.status === 'completed' && (firstTrack.contentType === 'audio' || firstTrack.contentType === 'video')) {
        setSelectedItem(firstTrack);
        setMediaViewerVisible(true);
      } else {
        Alert.alert('Error', 'Unable to play the first track in this playlist');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to start playlist playbook');
    }
  };

  const handlePlayTrack = async (track: DownloadItem, index: number) => {
    if (!playlist) return;
    
    if (track.status !== 'completed') {
      Alert.alert('Not Available', 'This track is not ready for playbook');
      return;
    }

    try {
      await playlistService.startPlaylist(playlist.id, index, false);
      setSelectedItem(track);
      setMediaViewerVisible(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to start track playbook');
    }
  };

  const handleRemoveFromPlaylist = async (downloadId: string, itemTitle: string) => {
    if (!playlist) return;

    Alert.alert(
      'Remove Track',
      `Remove "${itemTitle}" from this playlist?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await playlistService.removeFromPlaylist(playlist.id, downloadId);
            loadPlaylist();
          },
        },
      ]
    );
  };


  const handleAddContent = () => {
    setShowContentSelector(true);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    loadPlaylist();
    setRefreshing(false);
  };

  const moveTrackUp = async (index: number) => {
    if (!playlist || index === 0) return;
    
    await playlistService.reorderPlaylistItems(playlist.id, index, index - 1);
    loadPlaylist();
  };

  const moveTrackDown = async (index: number) => {
    if (!playlist || index === playlistTracks.length - 1) return;
    
    await playlistService.reorderPlaylistItems(playlist.id, index, index + 1);
    loadPlaylist();
  };

  const handleAddToPlaylist = async (downloadId: string) => {
    if (!playlist) return;

    const success = await playlistService.addToPlaylist(playlist.id, downloadId);
    if (success) {
      Alert.alert('Success', 'Added to playlist!');
      loadPlaylist(); // Refresh playlist
    } else {
      Alert.alert('Error', 'This item is already in the playlist or failed to add');
    }
  };

  const handleCloseContentSelector = () => {
    setShowContentSelector(false);
  };

  const isItemInPlaylist = (downloadId: string): boolean => {
    if (!playlist) return false;
    return playlist.items.some(item => item.downloadItemId === downloadId);
  };

  const handleCloseMediaViewer = () => {
    setMediaViewerVisible(false);
    setSelectedItem(null);
  };

  const handleTrackChange = (newItem: DownloadItem) => {
    console.log('Track change requested:', newItem.title, newItem.contentType);
    
    // Direct transition - just update the item
    // The EnhancedMediaViewer will handle content type changes internally
    setSelectedItem(newItem);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const getContentIcon = (contentType: string) => {
    switch (contentType) {
      case 'audio':
        return <Headphones size={20} color={theme.colors.primary} />;
      case 'video':
        return <Video size={20} color={theme.colors.primary} />;
      default:
        return <Music size={20} color={theme.colors.primary} />;
    }
  };

  const styles = createStyles(theme);

  if (!playlist) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading playlist...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.title} numberOfLines={1}>
            {playlist.name}
          </Text>
          <Text style={styles.subtitle}>
            {playlist.items.length} tracks • Created {formatDate(playlist.createdAt)}
          </Text>
        </View>
      </View>

      <View style={styles.playControls}>
        <TouchableOpacity 
          style={styles.playButton}
          onPress={() => handlePlayPlaylist(false)}
          disabled={playlist.items.length === 0}
        >
          <Play size={20} color="white" />
          <Text style={styles.playButtonText}>Play</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.shuffleButton}
          onPress={() => handlePlayPlaylist(true)}
          disabled={playlist.items.length === 0}
        >
          <Shuffle size={18} color={theme.colors.primary} />
          <Text style={styles.shuffleButtonText}>Shuffle</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.addContentButton}
          onPress={handleAddContent}
        >
          <Plus size={18} color={theme.colors.primary} />
          <Text style={styles.addContentButtonText}>Add Content</Text>
        </TouchableOpacity>
      </View>

      {playlistTracks.length === 0 ? (
        <View style={styles.emptyState}>
          <Music size={64} color={theme.colors.textSecondary} />
          <Text style={styles.emptyTitle}>No Tracks Yet</Text>
          <Text style={styles.emptySubtitle}>
            Add some content to start building your playlist
          </Text>
          <TouchableOpacity style={styles.emptyAddButton} onPress={handleAddContent}>
            <Plus size={20} color="white" />
            <Text style={styles.emptyAddButtonText}>Add Content</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={playlistTracks}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          style={styles.content}
          contentContainerStyle={styles.tracksList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderItem={({ item: track, index }) => {
            if (!track) return null;
            
            return (
              <View style={styles.trackItem}>
                <View style={styles.trackContent}>
                  <TouchableOpacity
                    style={styles.trackMain}
                    onPress={() => handlePlayTrack(track, index)}
                  >
                    <View style={styles.trackNumber}>
                      <Text style={styles.trackNumberText}>{index + 1}</Text>
                    </View>
                    
                    <View style={styles.trackIcon}>
                      {getContentIcon(track.contentType)}
                    </View>
                    
                    <View style={styles.trackInfo}>
                      <Text style={styles.trackTitle} numberOfLines={2}>
                        {track.title || 'Untitled'}
                      </Text>
                      <Text style={styles.trackMeta}>
                        {track.platform.charAt(0).toUpperCase() + track.platform.slice(1)} • {track.contentType}
                        {track.status !== 'completed' && ` • ${track.status}`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  
                  <View style={styles.trackActions}>
                    <TouchableOpacity 
                      style={styles.trackRemoveButton}
                      onPress={() => handleRemoveFromPlaylist(track.id, track.title || 'Untitled')}
                    >
                      <Trash2 size={16} color={theme.colors.error} />
                    </TouchableOpacity>
                    
                    <View style={styles.reorderButtons}>
                      <TouchableOpacity 
                        style={[styles.reorderButton, index === 0 && styles.reorderButtonDisabled]}
                        onPress={() => moveTrackUp(index)}
                        disabled={index === 0}
                      >
                        <ArrowUp size={14} color={index === 0 ? theme.colors.textTertiary : theme.colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.reorderButton, index === playlistTracks.length - 1 && styles.reorderButtonDisabled]}
                        onPress={() => moveTrackDown(index)}
                        disabled={index === playlistTracks.length - 1}
                      >
                        <ArrowDown size={14} color={index === playlistTracks.length - 1 ? theme.colors.textTertiary : theme.colors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
      
      {selectedItem && (
        <EnhancedMediaViewer
          item={selectedItem}
          visible={mediaViewerVisible}
          onClose={handleCloseMediaViewer}
          playlist={playlistTracks.filter(track => track && (track.contentType === 'audio' || track.contentType === 'video') && track.status === 'completed')}
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
                Add to "{playlist?.name}"
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
                      onPress={() => !isInPlaylist && handleAddToPlaylist(item.id)}
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
    </GestureHandlerRootView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  playControls: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  playButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  playButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  shuffleButton: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  shuffleButtonText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  addContentButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addContentButtonText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '600',
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
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  emptyAddButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emptyAddButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  tracksList: {
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  trackItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  trackItemActive: {
    backgroundColor: '#f8f9fa',
    borderColor: theme.colors.primary,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  trackContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  trackMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  trackActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trackNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  trackNumberText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  trackIcon: {
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
  trackInfo: {
    flex: 1,
    marginRight: 12,
  },
  trackTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    lineHeight: 22,
    marginBottom: 4,
  },
  trackMeta: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  trackRemoveButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reorderButtons: {
    flexDirection: 'column',
    marginLeft: 8,
  },
  reorderButton: {
    width: 32,
    height: 18,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  reorderButtonDisabled: {
    opacity: 0.4,
    backgroundColor: theme.colors.surface,
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