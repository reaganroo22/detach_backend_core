import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Audio } from 'expo-av';
import { X, Play, Pause, Volume2, VolumeX, SkipBack, SkipForward } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';
import { DownloadItem } from '../services/downloadService';

interface StableMediaViewerProps {
  item: DownloadItem;
  visible: boolean;
  onClose: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function StableMediaViewer({ item, visible, onClose }: StableMediaViewerProps) {
  const [textContent, setTextContent] = useState('');
  const [imageUri, setImageUri] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Audio player states
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (visible && item && item.filePath) {
      loadContent();
    }
    
    return () => {
      cleanup();
    };
  }, [visible, item?.filePath]);

  const cleanup = async () => {
    if (sound) {
      try {
        await sound.unloadAsync();
        setSound(null);
      } catch (error) {
        console.error('Error cleaning up sound:', error);
      }
    }
    setTextContent('');
    setImageUri('');
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
  };

  const loadContent = async () => {
    if (!item || !item.filePath) return;

    setIsLoading(true);
    try {
      switch (item.contentType) {
        case 'audio':
          await loadAudio();
          break;
        case 'image':
          setImageUri(item.filePath);
          break;
        case 'text':
          await loadText();
          break;
        case 'video':
          // For now, treat videos as audio for mindful consumption
          await loadAudio();
          break;
      }
    } catch (error) {
      console.error('Error loading content:', error);
      Alert.alert('Error', 'Failed to load content');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAudio = async () => {
    try {
      if (sound) {
        await sound.unloadAsync();
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: item.filePath! },
        { shouldPlay: false, isLooping: false }
      );

      setSound(newSound);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setDuration(status.durationMillis || 0);
          setPosition(status.positionMillis || 0);
          setIsPlaying(status.isPlaying || false);
        }
      });

    } catch (error) {
      console.error('Error loading audio:', error);
      Alert.alert('Error', 'Failed to load audio file');
    }
  };

  const loadText = async () => {
    try {
      const content = await FileSystem.readAsStringAsync(item.filePath!);
      setTextContent(content || 'No content available');
    } catch (error) {
      console.error('Error loading text:', error);
      setTextContent('Error loading text content');
    }
  };

  const togglePlayback = async () => {
    if (!sound) return;

    try {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
    }
  };

  const toggleMute = async () => {
    if (!sound) return;

    try {
      await sound.setIsMutedAsync(!isMuted);
      setIsMuted(!isMuted);
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  };

  const seekTo = async (milliseconds: number) => {
    if (!sound) return;

    try {
      await sound.setPositionAsync(Math.max(0, Math.min(milliseconds, duration)));
    } catch (error) {
      console.error('Error seeking:', error);
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

  const renderAudioPlayer = () => (
    <View style={styles.audioContainer}>
      <Text style={styles.mediaTitle}>{getSafeTitle()}</Text>
      <Text style={styles.mediaSubtitle}>
        {getSafePlatformName() + ' • Audio'}
      </Text>
      
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
          onPress={() => seekTo(Math.max(0, position - 10000))}
        >
          <SkipBack size={20} color="#92400e" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.controlButton} onPress={toggleMute}>
          {isMuted ? <VolumeX size={20} color="#92400e" /> : <Volume2 size={20} color="#92400e" />}
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.playButton} onPress={togglePlayback}>
          {isPlaying ? <Pause size={32} color="#ffffff" /> : <Play size={32} color="#ffffff" />}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.controlButton} 
          onPress={() => seekTo(Math.min(duration, position + 10000))}
        >
          <SkipForward size={20} color="#92400e" />
        </TouchableOpacity>
        
        <View style={styles.controlButton} />
      </View>
    </View>
  );

  const renderImageViewer = () => (
    <View style={styles.imageContainer}>
      <Text style={styles.mediaTitle}>{getSafeTitle()}</Text>
      <Text style={styles.mediaSubtitle}>
        {getSafePlatformName() + ' • Image (B&W Filter)'}
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
            style={[styles.image, styles.blackAndWhite]}
            resizeMode="contain"
          />
        ) : (
          <Text style={styles.errorText}>{'No image available'}</Text>
        )}
      </ScrollView>
    </View>
  );

  const renderTextViewer = () => (
    <View style={styles.textContainer}>
      <Text style={styles.mediaTitle}>{getSafeTitle()}</Text>
      <Text style={styles.mediaSubtitle}>
        {getSafePlatformName() + ' • Text Content'}
      </Text>
      
      <ScrollView style={styles.textScrollView} showsVerticalScrollIndicator={false}>
        <Text style={styles.textContent}>{textContent || 'No content available'}</Text>
      </ScrollView>
    </View>
  );

  const renderVideoPlayer = () => (
    <View style={styles.videoContainer}>
      <Text style={styles.mediaTitle}>{getSafeTitle()}</Text>
      <Text style={styles.mediaSubtitle}>
        {getSafePlatformName() + ' • Video (Audio Only for Mindful Consumption)'}
      </Text>
      
      <View style={styles.videoPlaceholder}>
        <Text style={styles.videoPlaceholderText}>
          {'🎵 Playing audio only for mindful consumption'}
        </Text>
        <Text style={styles.videoPlaceholderSubtext}>
          {'Video content is converted to audio to promote intentional listening'}
        </Text>
      </View>
      
      {renderAudioPlayer()}
    </View>
  );

  const renderContent = () => {
    if (!item) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{'No content available'}</Text>
        </View>
      );
    }

    if (isLoading) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{'Loading content...'}</Text>
        </View>
      );
    }

    switch (item.contentType) {
      case 'audio':
        return renderAudioPlayer();
      case 'video':
        return renderVideoPlayer();
      case 'image':
        return renderImageViewer();
      case 'text':
        return renderTextViewer();
      default:
        return (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{'Unsupported content type'}</Text>
          </View>
        );
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft} />
          <Text style={styles.headerTitle}>{'Media Viewer'}</Text>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <X size={24} color="#92400e" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {renderContent()}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fefce8',
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
  content: {
    flex: 1,
    padding: 20,
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
    width: 250,
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
  
  // Video Player Styles
  videoContainer: {
    flex: 1,
  },
  videoPlaceholder: {
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    padding: 30,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#fbbf24',
    alignItems: 'center',
  },
  videoPlaceholderText: {
    fontSize: 18,
    color: '#92400e',
    textAlign: 'center',
    marginBottom: 10,
  },
  videoPlaceholderSubtext: {
    fontSize: 14,
    color: '#a16207',
    textAlign: 'center',
    lineHeight: 20,
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
  blackAndWhite: {
    opacity: 0.8,
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
});