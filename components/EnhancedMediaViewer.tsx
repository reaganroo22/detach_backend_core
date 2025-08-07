import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Dimensions,
  Image,
  StatusBar,
} from 'react-native';
import { Video } from 'expo-av';
import { Audio } from 'expo-av';
import { useAudioPlayer, AudioSource } from 'expo-audio';
import { 
  X, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  SkipBack, 
  SkipForward, 
  Maximize,
  Minimize,
  Gauge
} from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';
// Removed color matrix filters for production
import { DownloadItem } from '../services/downloadService';
import { useTheme } from '../contexts/ThemeContext';

interface EnhancedMediaViewerProps {
  item: DownloadItem;
  visible: boolean;
  onClose: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type PlaybackStatus = {
  isLoaded: boolean;
  isPlaying?: boolean;
  positionMillis?: number;
  durationMillis?: number;
  shouldPlay?: boolean;
  rate?: number;
};

export default function EnhancedMediaViewer({ item, visible, onClose }: EnhancedMediaViewerProps) {
  const { theme } = useTheme();
  const [textContent, setTextContent] = useState('');
  const [imageUri, setImageUri] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showControls, setShowControls] = useState(true);
  const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // Playlist states
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(0);
  const [showPlaylist, setShowPlaylist] = useState(false);
  
  // Audio player states
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  
  // Video player states
  const videoRef = useRef<Video>(null);
  const [videoStatus, setVideoStatus] = useState<PlaybackStatus>({ isLoaded: false });
  const [videoLoadError, setVideoLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && item && item.filePath) {
      loadContent();
    }
    
    return () => {
      cleanup();
    };
  }, [visible, item?.filePath]);

  // Auto-hide controls for video
  useEffect(() => {
    if (item?.contentType === 'video' && showControls) {
      if (controlsTimeout) {
        clearTimeout(controlsTimeout);
      }
      
      const timeout = setTimeout(() => {
        setShowControls(false);
      }, 3000);
      
      setControlsTimeout(timeout);
      
      return () => {
        if (timeout) clearTimeout(timeout);
      };
    }
  }, [showControls, item?.contentType]);

  const cleanup = async () => {
    // Cleanup audio
    if (sound) {
      try {
        await sound.unloadAsync();
        setSound(null);
      } catch (error) {
        console.error('Error cleaning up sound:', error);
      }
    }
    
    // Cleanup video
    if (videoRef.current) {
      try {
        await videoRef.current.unloadAsync();
      } catch (error) {
        console.error('Error cleaning up video:', error);
      }
    }
    
    // Clear timeouts
    if (controlsTimeout) {
      clearTimeout(controlsTimeout);
      setControlsTimeout(null);
    }
    
    // Reset states
    setTextContent('');
    setImageUri('');
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
    setVideoStatus({ isLoaded: false });
    setVideoLoadError(null);
    setIsFullscreen(false);
    setPlaybackRate(1.0);
    setShowControls(true);
  };

  const loadContent = async () => {
    if (!item) return;

    // Handle playlist differently
    if (item.isPlaylist) {
      setIsLoading(false);
      setShowPlaylist(true);
      return;
    }

    if (!item.filePath) return;

    setIsLoading(true);
    try {
      switch (item.contentType) {
        case 'audio':
          await loadAudio();
          break;
        case 'video':
          console.log('Loading video from path:', item.filePath);
          // Video loading is handled by the Video component
          setIsLoading(false);
          break;
        case 'image':
          setImageUri(item.filePath);
          setIsLoading(false);
          break;
        case 'text':
          await loadText();
          break;
      }
    } catch (error) {
      console.error('Error loading content:', error);
      Alert.alert('Error', 'Failed to load content');
    } finally {
      setIsLoading(false);
    }
  };

  const playPlaylistItem = (index: number) => {
    if (!item.playlistItems || !item.playlistPath) return;
    
    const playlistItem = item.playlistItems[index];
    if (!playlistItem) return;
    
    setCurrentPlaylistIndex(index);
    
    // Create a path to the individual file
    const itemPath = `${item.playlistPath}/${playlistItem.filename}`;
    
    // For now, we'll show an alert with the item info
    Alert.alert(
      'Playing Item',
      `${playlistItem.title}\n\nThis would play: ${playlistItem.filename}`,
      [{ text: 'OK' }]
    );
  };

  const loadAudio = async () => {
    try {
      if (sound) {
        await sound.unloadAsync();
      }

      console.log('Loading audio from path:', item.filePath);
      
      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(item.filePath!);
      console.log('Audio file info:', fileInfo);
      
      if (!fileInfo.exists) {
        throw new Error('Audio file does not exist');
      }

      // Simple approach - just create the audio with a short timeout and show the UI
      console.log('Creating audio sound...');
      
      try {
        // Try to create the audio with a 3-second timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Audio creation timeout')), 3000);
        });
        
        const audioPromise = Audio.Sound.createAsync(
          { uri: item.filePath! },
          { shouldPlay: false, isLooping: false }
        );

        const result = await Promise.race([audioPromise, timeoutPromise]) as { sound: Audio.Sound };
        const { sound: newSound } = result;

        console.log('Audio created successfully');
        setSound(newSound);

        newSound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.isLoaded) {
            setDuration(status.durationMillis || 0);
            setPosition(status.positionMillis || 0);
            setIsPlaying(status.isPlaying || false);
          }
        });

        // Try to get initial status
        try {
          const initialStatus = await newSound.getStatusAsync();
          if (initialStatus.isLoaded) {
            setDuration(initialStatus.durationMillis || 0);
          }
        } catch (statusError) {
          console.warn('Could not get initial status, but continuing anyway');
        }

      } catch (audioError) {
        console.warn('Audio creation failed, showing basic player UI anyway:', audioError);
        // Still show the player UI even if audio creation fails
        setSound(null);
        setDuration(0);
      }

    } catch (error) {
      console.error('Error loading audio:', error);
      setSound(null);
      setDuration(0);
    } finally {
      setIsLoading(false);
    }
  };

  const loadText = async () => {
    try {
      const content = await FileSystem.readAsStringAsync(item.filePath!);
      setTextContent(content || 'No content available');
    } catch (error) {
      console.error('Error loading text:', error);
      setTextContent('Error loading text content');
    } finally {
      setIsLoading(false);
    }
  };

  // Audio controls
  const toggleAudioPlayback = async () => {
    if (!sound) return;

    try {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    } catch (error) {
      console.error('Error toggling audio playback:', error);
    }
  };

  const changeAudioPlaybackRate = async (rate: number) => {
    if (!sound) return;

    try {
      await sound.setRateAsync(rate, true);
      setPlaybackRate(rate);
    } catch (error) {
      console.error('Error changing audio playback rate:', error);
    }
  };

  const toggleAudioMute = async () => {
    if (!sound) return;

    try {
      await sound.setIsMutedAsync(!isMuted);
      setIsMuted(!isMuted);
    } catch (error) {
      console.error('Error toggling audio mute:', error);
    }
  };

  const seekAudio = async (milliseconds: number) => {
    if (!sound) return;

    try {
      await sound.setPositionAsync(Math.max(0, Math.min(milliseconds, duration)));
    } catch (error) {
      console.error('Error seeking audio:', error);
    }
  };

  // Video controls
  const toggleVideoPlayback = async () => {
    if (!videoRef.current) return;
    
    try {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
    } catch (error) {
      console.error('Error toggling video playback:', error);
    }
  };

  const changeVideoPlaybackRate = async (rate: number) => {
    if (!videoRef.current) return;
    
    try {
      await videoRef.current.setRateAsync(rate, true);
      setPlaybackRate(rate);
    } catch (error) {
      console.error('Error changing video playback rate:', error);
    }
  };

  const toggleVideoMute = async () => {
    if (!videoRef.current) return;
    
    try {
      await videoRef.current.setIsMutedAsync(!isMuted);
      setIsMuted(!isMuted);
    } catch (error) {
      console.error('Error toggling video mute:', error);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    if (!isFullscreen) {
      StatusBar.setHidden(true);
    } else {
      StatusBar.setHidden(false);
    }
  };

  const showVideoControls = () => {
    setShowControls(true);
  };

  // Video status is handled by onLoad and onProgress callbacks

  const handlePlaybackRatePress = () => {
    const rates = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    const currentIndex = rates.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % rates.length;
    const newRate = rates[nextIndex];
    
    if (item?.contentType === 'video') {
      changeVideoPlaybackRate(newRate);
    } else if (item?.contentType === 'audio') {
      changeAudioPlaybackRate(newRate);
    }
  };

  const formatTime = (milliseconds: number): string => {
    if (!milliseconds || isNaN(milliseconds) || milliseconds < 0) return '0:00';
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleClose = async () => {
    StatusBar.setHidden(false);
    await cleanup();
    onClose();
  };

  const getSafePlatformName = (): string => {
    if (!item || !item.platform) return 'Unknown';
    
    const platformMap: Record<string, string> = {
      'youtube': 'YouTube',
      'instagram': 'Instagram', 
      'tiktok': 'TikTok',
      'facebook': 'Facebook',
      'twitter': 'X/Twitter',
      'linkedin': 'LinkedIn',
      'pinterest': 'Pinterest'
    };
    
    return platformMap[item.platform] || 'Unknown';
  };

  const getSafeTitle = (): string => {
    if (!item || !item.title) {
      switch (item?.contentType) {
        case 'audio': return 'Audio Content';
        case 'video': return 'Video Content';
        case 'image': return 'Image Content';
        case 'text': return 'Text Content';
        default: return 'Media Content';
      }
    }
    return String(item.title);
  };

  const renderVideoPlayer = () => (
    <View style={[styles.videoContainer, isFullscreen && styles.fullscreenContainer]}>
      {!isFullscreen && (
        <>
          <Text style={styles.mediaTitle}>{getSafeTitle()}</Text>
          <Text style={styles.mediaSubtitle}>
            {`${getSafePlatformName()} • Video`}
          </Text>
        </>
      )}
      
      <TouchableOpacity 
        style={[styles.videoWrapper, isFullscreen && styles.fullscreenVideoWrapper]}
        onPress={showVideoControls}
        activeOpacity={1}
      >
        {videoLoadError ? (
          <View style={styles.videoErrorContainer}>
            <Text style={styles.videoErrorText}>Video Load Error</Text>
            <Text style={styles.videoErrorDetails}>{videoLoadError}</Text>
            <Text style={styles.videoErrorPath}>Source: {item.filePath}</Text>
          </View>
        ) : (
          <Video
            ref={videoRef}
            source={{ uri: item.filePath! }}
            style={styles.video}
            useNativeControls={false}
            resizeMode="contain"
            shouldPlay={isPlaying}
            isLooping={false}
            rate={playbackRate}
            isMuted={isMuted}
            onLoad={(loadStatus) => {
              console.log('Video onLoad called with status:', loadStatus);
              if (loadStatus.isLoaded) {
                console.log('Video loaded successfully - Duration:', loadStatus.durationMillis);
                setDuration(loadStatus.durationMillis || 0);
                setVideoStatus({ isLoaded: true });
              } else {
                console.log('Video failed to load:', loadStatus);
              }
            }}
            onPlaybackStatusUpdate={(status) => {
              if (status.isLoaded) {
                setPosition(status.positionMillis || 0);
                setIsPlaying(status.isPlaying || false);
                if (status.durationMillis) {
                  setDuration(status.durationMillis);
                }
              } else if (status.error) {
                console.error('Video playback error:', status.error);
              }
            }}
            onError={(error) => {
              console.error('Video component error:', error);
              setVideoLoadError(`Video failed to load: ${error}`);
              Alert.alert('Video Error', 'Failed to load video. Please try again.');
            }}
          />
        )}
        
        {/* Custom video controls overlay */}
        {showControls && (
          <View style={styles.videoControls}>
            <View style={styles.videoControlsTop}>
              <TouchableOpacity style={styles.fullscreenButton} onPress={toggleFullscreen}>
                {isFullscreen ? <Minimize size={24} color="#ffffff" /> : <Maximize size={24} color="#ffffff" />}
              </TouchableOpacity>
            </View>
            
            <View style={styles.videoControlsCenter}>
              <TouchableOpacity style={styles.videoPlayButton} onPress={toggleVideoPlayback}>
                {isPlaying ? <Pause size={40} color="#ffffff" /> : <Play size={40} color="#ffffff" />}
              </TouchableOpacity>
            </View>
            
            <View style={styles.videoControlsBottom}>
              <View style={styles.videoControlsRow}>
                <TouchableOpacity style={styles.videoControlButton} onPress={toggleVideoMute}>
                  {isMuted ? <VolumeX size={20} color="#ffffff" /> : <Volume2 size={20} color="#ffffff" />}
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.videoControlButton} onPress={handlePlaybackRatePress}>
                  <Gauge size={20} color="#ffffff" />
                  <Text style={styles.playbackRateText}>{playbackRate}x</Text>
                </TouchableOpacity>
              </View>
              
              {/* Progress bar */}
              <View style={styles.videoProgressContainer}>
                <TouchableOpacity 
                  style={styles.videoProgressBar}
                  onPress={(e) => {
                    if (duration > 0 && videoRef.current) {
                      const { locationX } = e.nativeEvent;
                      const progressBarWidth = 280; // Approximate width
                      const seekPercent = locationX / progressBarWidth;
                      const seekTime = seekPercent * duration;
                      videoRef.current.setPositionAsync(Math.max(0, Math.min(seekTime, duration)));
                    }
                  }}
                  activeOpacity={1}
                >
                  <View 
                    style={[
                      styles.videoProgressFill, 
                      { width: duration > 0 ? `${Math.min((position / duration) * 100, 100)}%` : '0%' }
                    ]} 
                  />
                </TouchableOpacity>
                <View style={styles.videoTimeContainer}>
                  <Text style={styles.videoTimeText}>{formatTime(position)}</Text>
                  <Text style={styles.videoTimeText}>{formatTime(duration)}</Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderAudioPlayer = () => (
    <View style={styles.audioContainer}>
      <Text style={styles.mediaTitle}>{getSafeTitle()}</Text>
      <Text style={styles.mediaSubtitle}>
        {`${getSafePlatformName()} • Audio`}
      </Text>
      
      {!sound && (
        <View style={styles.audioErrorContainer}>
          <Text style={styles.audioErrorText}>⚠️ Audio Loading Issue</Text>
          <Text style={styles.audioErrorDescription}>
            This audio file downloaded successfully but React Native has trouble loading it. 
            The file is saved to your device storage.
          </Text>
          <TouchableOpacity 
            style={styles.showFileButton}
            onPress={() => Alert.alert('File Location', item.filePath || 'File path not available')}
          >
            <Text style={styles.showFileButtonText}>Show File Path</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {sound && (
        <>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: duration > 0 ? `${Math.min((position / duration) * 100, 100)}%` : '0%' }
                ]} 
              />
            </View>
            <View style={styles.timeContainer}>
              <Text style={styles.timeText}>{formatTime(position)}</Text>
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>
          </View>

          <View style={styles.audioControls}>
            <TouchableOpacity 
              style={styles.controlButton} 
              onPress={() => seekAudio(Math.max(0, position - 10000))}
            >
              <SkipBack size={20} color="#92400e" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.controlButton} onPress={toggleAudioMute}>
              {isMuted ? <VolumeX size={20} color="#92400e" /> : <Volume2 size={20} color="#92400e" />}
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.playButton} onPress={toggleAudioPlayback}>
              {isPlaying ? <Pause size={32} color="#ffffff" /> : <Play size={32} color="#ffffff" />}
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.controlButton} onPress={handlePlaybackRatePress}>
              <Gauge size={20} color="#92400e" />
              <Text style={styles.audioRateText}>{playbackRate}x</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.controlButton} 
              onPress={() => seekAudio(Math.min(duration, position + 10000))}
            >
              <SkipForward size={20} color="#92400e" />
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );

  const renderImageViewer = () => (
    <View style={styles.imageContainer}>
      <Text style={styles.mediaTitle}>{getSafeTitle()}</Text>
      <Text style={styles.mediaSubtitle}>
        {`${getSafePlatformName()} • Image`}
      </Text>
      
      <ScrollView 
        style={styles.imageScrollView}
        contentContainerStyle={styles.imageScrollContent}
        maximumZoomScale={3}
        minimumZoomScale={1}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      >
        {imageUri ? (
          <Image 
            source={{ uri: imageUri }} 
            style={styles.image}
            resizeMode="contain"
          />
        ) : (
          <Text style={styles.errorText}>No image available</Text>
        )}
      </ScrollView>
    </View>
  );

  const renderTextViewer = () => (
    <View style={styles.textContainer}>
      <Text style={styles.mediaTitle}>{getSafeTitle()}</Text>
      <Text style={styles.mediaSubtitle}>
        {`${getSafePlatformName()} • Text Content`}
      </Text>
      
      <ScrollView style={styles.textScrollView} showsVerticalScrollIndicator={false}>
        <Text style={styles.textContent}>{String(textContent || 'No content available')}</Text>
      </ScrollView>
    </View>
  );

  const renderPlaylistViewer = () => {
    if (!item.playlistItems) return null;

    return (
      <ScrollView style={styles.playlistContainer}>
        <View style={styles.playlistHeader}>
          <Text style={styles.playlistTitle}>
            📁 Playlist ({item.playlistItems.length} items)
          </Text>
          <Text style={styles.playlistSubtitle}>
            {item.title}
          </Text>
        </View>
        
        {item.playlistItems.map((playlistItem, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.playlistItem,
              currentPlaylistIndex === index && styles.playlistItemActive
            ]}
            onPress={() => playPlaylistItem(index)}
          >
            <View style={styles.playlistItemInfo}>
              <Text style={styles.playlistItemTitle} numberOfLines={2}>
                {index + 1}. {playlistItem.title}
              </Text>
              {playlistItem.duration && (
                <Text style={styles.playlistItemDuration}>
                  {Math.floor(playlistItem.duration / 60)}:
                  {String(playlistItem.duration % 60).padStart(2, '0')}
                </Text>
              )}
              <Text style={styles.playlistItemFilename} numberOfLines={1}>
                📄 {playlistItem.filename}
              </Text>
            </View>
            <View style={styles.playlistItemActions}>
              <TouchableOpacity style={styles.playlistItemButton}>
                <Play size={16} color="#92400e" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderContent = () => {
    if (!item) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No content available</Text>
        </View>
      );
    }

    // Handle playlist view
    if (item.isPlaylist && showPlaylist) {
      return renderPlaylistViewer();
    }

    if (isLoading) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Loading content...</Text>
        </View>
      );
    }

    switch (item.contentType) {
      case 'video':
        return renderVideoPlayer();
      case 'audio':
        return renderAudioPlayer();
      case 'image':
        return renderImageViewer();
      case 'text':
        return renderTextViewer();
      default:
        return (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Unsupported content type</Text>
          </View>
        );
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={[styles.container, isFullscreen && styles.fullscreenContainer]}>
        {!isFullscreen && (
          <View style={styles.header}>
            <View style={styles.headerLeft} />
            <Text style={styles.headerTitle}>Media Viewer</Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <X size={24} color="#92400e" />
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.content, isFullscreen && styles.fullscreenContent]}>
          {renderContent()}
        </View>
        
        {isFullscreen && (
          <TouchableOpacity style={styles.fullscreenCloseButton} onPress={handleClose}>
            <X size={24} color="#ffffff" />
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fefce8',
  },
  fullscreenContainer: {
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fffbeb',
    borderBottomWidth: 2,
    borderBottomColor: '#fbbf24',
  },
  headerLeft: {
    width: 24,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#92400e',
  },
  closeButton: {
    padding: 4,
  },
  fullscreenCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  fullscreenContent: {
    padding: 0,
  },
  
  // Common Media Styles
  mediaTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#92400e',
    textAlign: 'center',
    marginBottom: 8,
  },
  mediaSubtitle: {
    fontSize: 14,
    color: '#a16207',
    textAlign: 'center',
    marginBottom: 20,
  },
  
  // Video Player Styles
  videoContainer: {
    flex: 1,
  },
  videoWrapper: {
    position: 'relative',
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fbbf24',
    minHeight: 300,
  },
  fullscreenVideoWrapper: {
    borderRadius: 0,
    borderWidth: 0,
    minHeight: screenHeight,
  },
  video: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  videoControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  videoControlsTop: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  videoControlsCenter: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -40 }, { translateY: -40 }],
  },
  videoControlsBottom: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  videoControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  fullscreenButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(146, 64, 14, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(217, 119, 6, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoControlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(146, 64, 14, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  playbackRateText: {
    fontSize: 10,
    color: '#ffffff',
    marginLeft: 4,
  },
  videoProgressContainer: {
    width: '100%',
  },
  videoProgressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    marginBottom: 8,
  },
  videoProgressFill: {
    height: '100%',
    backgroundColor: '#d97706',
    borderRadius: 2,
  },
  videoTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  videoTimeText: {
    fontSize: 12,
    color: '#ffffff',
  },
  
  // Audio Player Styles
  audioContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    padding: 30,
    borderWidth: 2,
    borderColor: '#fbbf24',
  },
  progressContainer: {
    width: '100%',
    marginBottom: 40,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#d97706',
    borderRadius: 2,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 14,
    color: '#a16207',
  },
  audioControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: 280,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 4,
    backgroundColor: '#fbbf24',
    borderWidth: 2,
    borderColor: '#92400e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 4,
    backgroundColor: '#d97706',
    borderWidth: 2,
    borderColor: '#92400e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioRateText: {
    fontSize: 8,
    color: '#92400e',
    marginTop: 2,
  },
  audioErrorContainer: {
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    padding: 20,
    margin: 20,
    borderWidth: 2,
    borderColor: '#ffc107',
    alignItems: 'center',
  },
  audioErrorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 10,
    textAlign: 'center',
  },
  audioErrorDescription: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 15,
  },
  showFileButton: {
    backgroundColor: '#ffc107',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#856404',
  },
  showFileButtonText: {
    color: '#856404',
    fontWeight: '600',
    fontSize: 14,
  },
  
  // Image Viewer Styles
  imageContainer: {
    flex: 1,
  },
  imageScrollView: {
    flex: 1,
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fbbf24',
  },
  imageScrollContent: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: screenHeight - 200,
    padding: 10,
  },
  image: {
    width: screenWidth - 60,
    height: screenHeight - 280,
    borderRadius: 4,
  },
  
  // Text Viewer Styles
  textContainer: {
    flex: 1,
  },
  textScrollView: {
    flex: 1,
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    padding: 16,
    borderWidth: 2,
    borderColor: '#fbbf24',
  },
  textContent: {
    fontSize: 16,
    lineHeight: 24,
    color: '#451a03',
  },
  
  // Error Styles
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    padding: 30,
    borderWidth: 2,
    borderColor: '#fbbf24',
  },
  errorText: {
    fontSize: 16,
    color: '#92400e',
    textAlign: 'center',
  },
  videoErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    padding: 20,
  },
  videoErrorText: {
    fontSize: 18,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 10,
  },
  videoErrorDetails: {
    fontSize: 12,
    color: '#cccccc',
    textAlign: 'center',
    marginBottom: 10,
  },
  videoErrorPath: {
    fontSize: 10,
    color: '#888888',
    textAlign: 'center',
  },
  // Playlist styles
  playlistContainer: {
    flex: 1,
    backgroundColor: '#fefce8',
  },
  playlistHeader: {
    padding: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#fbbf24',
    backgroundColor: '#fffbeb',
  },
  playlistTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 4,
  },
  playlistSubtitle: {
    fontSize: 14,
    color: '#a16207',
  },
  playlistItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#fbbf24',
    backgroundColor: '#fefce8',
  },
  playlistItemActive: {
    backgroundColor: '#fffbeb',
    borderLeftWidth: 4,
    borderLeftColor: '#d97706',
  },
  playlistItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  playlistItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#451a03',
    marginBottom: 4,
  },
  playlistItemDuration: {
    fontSize: 12,
    color: '#d97706',
    marginBottom: 2,
  },
  playlistItemFilename: {
    fontSize: 11,
    color: '#a16207',
    fontFamily: 'monospace',
  },
  playlistItemActions: {
    justifyContent: 'center',
  },
  playlistItemButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fbbf24',
    borderWidth: 2,
    borderColor: '#92400e',
    justifyContent: 'center',
    alignItems: 'center',
  },
});