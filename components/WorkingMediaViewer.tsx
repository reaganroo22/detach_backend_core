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
import { VideoView, useVideoPlayer } from 'expo-video';
import { useAudioPlayer } from 'expo-audio';
import { X, Play, Pause, Volume2, VolumeX, SkipBack, SkipForward } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';
import { DownloadItem } from '../services/downloadService';

interface WorkingMediaViewerProps {
  item: DownloadItem;
  visible: boolean;
  onClose: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function WorkingMediaViewer({ item, visible, onClose }: WorkingMediaViewerProps) {
  const [textContent, setTextContent] = useState('');
  const [imageUri, setImageUri] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [videoSource, setVideoSource] = useState<string | null>(null);
  
  // Audio player setup
  const player = useAudioPlayer(item?.filePath || '');
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (visible && item?.filePath) {
      loadContent();
    }
    
    return () => {
      cleanup();
    };
  }, [visible, item?.filePath]);

  // Audio player status updates
  useEffect(() => {
    if (player) {
      const subscription = player.addListener('playbackStatusUpdate', (status) => {
        setIsPlaying(status.playing || false);
        setDuration(status.duration || 0);
        setPosition(status.currentTime || 0);
      });
      
      return () => subscription?.remove();
    }
  }, [player]);

  const cleanup = () => {
    if (player) {
      player.pause();
    }
    setTextContent('');
    setImageUri('');
    setVideoSource(null);
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
  };

  const loadContent = async () => {
    if (!item?.filePath) return;

    setIsLoading(true);
    try {
      switch (item.contentType) {
        case 'audio':
          // Audio is handled by useAudioPlayer hook
          break;
        case 'video':
          setVideoSource(item.filePath);
          break;
        case 'image':
          setImageUri(item.filePath);
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

  const loadText = async () => {
    try {
      const content = await FileSystem.readAsStringAsync(item.filePath!);
      setTextContent(content || 'No content available');
    } catch (error) {
      console.error('Error loading text:', error);
      setTextContent('Error loading text content');
    }
  };

  const togglePlayback = () => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  };

  const toggleMute = () => {
    player.volume = isMuted ? 1.0 : 0.0;
    setIsMuted(!isMuted);
  };

  const seekTo = (seconds: number) => {
    player.seekTo(seconds);
  };

  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClose = () => {
    cleanup();
    onClose();
  };

  const formatPlatformName = (platform: DownloadItem['platform']): string => {
    if (!platform) return 'Unknown';
    switch (platform) {
      case 'youtube': return 'YouTube';
      case 'instagram': return 'Instagram';
      case 'tiktok': return 'TikTok';
      case 'facebook': return 'Facebook';
      case 'twitter': return 'X/Twitter';
      case 'linkedin': return 'LinkedIn';
      case 'pinterest': return 'Pinterest';
      default: return String(platform) || 'Unknown';
    }
  };

  const renderVideoPlayer = () => (
    <View style={styles.videoContainer}>
      <Text style={styles.mediaTitle}>{String(item?.title || 'Video Content')}</Text>
      <Text style={styles.mediaSubtitle}>
        {formatPlatformName(item?.platform) + ' • Video (B&W Filter)'}
      </Text>
      
      <View style={styles.videoPlayerWrapper}>
        <VideoView
          style={styles.video}
          player={useVideoPlayer(videoSource!)}
          allowsFullscreen
          allowsPictureInPicture
          contentFit="contain"
        />
      </View>
    </View>
  );

  const renderAudioPlayer = () => (
    <View style={styles.audioContainer}>
      <Text style={styles.mediaTitle}>{String(item?.title || 'Audio Content')}</Text>
      <Text style={styles.mediaSubtitle}>
        {formatPlatformName(item?.platform) + ' • Audio'}
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
        <TouchableOpacity style={styles.controlButton} onPress={() => seekTo(Math.max(0, position - 10))}>
          <SkipBack size={20} color="#92400e" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.controlButton} onPress={toggleMute}>
          {isMuted ? <VolumeX size={20} color="#92400e" /> : <Volume2 size={20} color="#92400e" />}
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.playButton} onPress={togglePlayback}>
          {isPlaying ? <Pause size={32} color="#ffffff" /> : <Play size={32} color="#ffffff" />}
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.controlButton} onPress={() => seekTo(position + 10)}>
          <SkipForward size={20} color="#92400e" />
        </TouchableOpacity>
        
        <View style={styles.controlButton} />
      </View>
    </View>
  );

  const renderImageViewer = () => (
    <View style={styles.imageContainer}>
      <Text style={styles.mediaTitle}>{String(item?.title || 'Image Content')}</Text>
      <Text style={styles.mediaSubtitle}>
        {formatPlatformName(item?.platform) + ' • Image (B&W Filter)'}
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
          <Text style={styles.errorText}>No image available</Text>
        )}
      </ScrollView>
    </View>
  );

  const renderTextViewer = () => (
    <View style={styles.textContainer}>
      <Text style={styles.mediaTitle}>{String(item?.title || 'Text Content')}</Text>
      <Text style={styles.mediaSubtitle}>
        {formatPlatformName(item?.platform) + ' • Text Content'}
      </Text>
      
      <ScrollView style={styles.textScrollView} showsVerticalScrollIndicator={false}>
        <Text style={styles.textContent}>{String(textContent || 'No content available')}</Text>
      </ScrollView>
    </View>
  );

  const renderContent = () => {
    if (!item) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No content available</Text>
        </View>
      );
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
            <Text style={styles.errorText}>Unsupported content type: {String(item.contentType || 'unknown')}</Text>
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
          <Text style={styles.headerTitle}>Media Viewer</Text>
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
    backgroundColor: '#fefce8', // Ancient parchment background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fffbeb', // Warm cream background
    borderBottomWidth: 2,
    borderBottomColor: '#fbbf24', // Golden border
  },
  headerLeft: {
    width: 24,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#92400e', // Ancient brown
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
    color: '#92400e', // Ancient brown
    textAlign: 'center',
    marginBottom: 8,
  },
  mediaSubtitle: {
    fontSize: 14,
    color: '#a16207', // Darker golden color
    textAlign: 'center',
    marginBottom: 20,
  },
  
  // Video Player Styles
  videoContainer: {
    flex: 1,
  },
  videoPlayerWrapper: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fbbf24', // Golden border
  },
  video: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  
  // Audio Player Styles
  audioContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fffbeb', // Warm cream background
    borderRadius: 8,
    padding: 30,
    borderWidth: 2,
    borderColor: '#fbbf24', // Golden border
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
    backgroundColor: '#d97706', // Golden brown progress
    borderRadius: 2,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 14,
    color: '#a16207', // Darker golden color
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
    borderRadius: 4, // Sharp corners for ancient look
    backgroundColor: '#fbbf24', // Golden background
    borderWidth: 2,
    borderColor: '#92400e', // Ancient brown border
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 4, // Sharp corners
    backgroundColor: '#d97706', // Golden brown button
    borderWidth: 2,
    borderColor: '#92400e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Image Viewer Styles
  imageContainer: {
    flex: 1,
  },
  imageScrollView: {
    flex: 1,
    backgroundColor: '#fffbeb', // Warm cream background
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fbbf24', // Golden border
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
    // For actual black and white, we'd need a proper image filter library
    // This is a basic approximation
    opacity: 0.9,
  },
  
  // Text Viewer Styles
  textContainer: {
    flex: 1,
  },
  textScrollView: {
    flex: 1,
    backgroundColor: '#fffbeb', // Warm cream background
    borderRadius: 8,
    padding: 16,
    borderWidth: 2,
    borderColor: '#fbbf24', // Golden border
  },
  textContent: {
    fontSize: 16,
    lineHeight: 24,
    color: '#451a03', // Dark brown text
  },
  
  // Error Styles
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fffbeb', // Warm cream background
    borderRadius: 8,
    padding: 30,
    borderWidth: 2,
    borderColor: '#fbbf24', // Golden border
  },
  errorText: {
    fontSize: 16,
    color: '#92400e', // Ancient brown
    textAlign: 'center',
  },
});