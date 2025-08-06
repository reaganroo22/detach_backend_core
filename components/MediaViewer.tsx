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
import { X, Play, Pause, Volume2, VolumeX } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';
import { DownloadItem } from '../services/downloadService';

interface MediaViewerProps {
  item: DownloadItem;
  visible: boolean;
  onClose: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function MediaViewer({ item, visible, onClose }: MediaViewerProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState<number>(0);
  const [position, setPosition] = useState<number>(0);
  const [isMuted, setIsMuted] = useState(false);
  const [textContent, setTextContent] = useState<string>('');
  const [imageUri, setImageUri] = useState<string>('');

  useEffect(() => {
    if (visible && item.filePath) {
      loadContent();
    }
    
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [visible, item.filePath]);

  const loadContent = async () => {
    if (!item.filePath) return;

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
      }
    } catch (error) {
      console.error('Error loading content:', error);
      Alert.alert('Error', 'Failed to load content');
    }
  };

  const loadAudio = async () => {
    try {
      if (sound) {
        await sound.unloadAsync();
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: item.filePath! },
        { shouldPlay: false }
      );

      setSound(newSound);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setDuration(status.durationMillis || 0);
          setPosition(status.positionMillis || 0);
          setIsPlaying(status.isPlaying);
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
      setTextContent(content);
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

  const formatTime = (milliseconds: number) => {
    if (!milliseconds || isNaN(milliseconds)) return '0:00';
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleClose = async () => {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
    }
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
    setTextContent('');
    setImageUri('');
    onClose();
  };

  const renderAudioPlayer = () => (
    <View style={styles.audioContainer}>
      <Text style={styles.audioTitle}>{item.title || 'Audio Content'}</Text>
      <Text style={styles.audioSubtitle}>
        {formatPlatformName(item.platform)} • Audio
      </Text>
      
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: duration > 0 ? `${(position / duration) * 100}%` : '0%' }
            ]} 
          />
        </View>
        <View style={styles.timeContainer}>
          <Text style={styles.timeText}>{formatTime(position || 0)}</Text>
          <Text style={styles.timeText}>{formatTime(duration || 0)}</Text>
        </View>
      </View>

      <View style={styles.audioControls}>
        <TouchableOpacity style={styles.controlButton} onPress={toggleMute}>
          {isMuted ? <VolumeX size={24} color="#6b7280" /> : <Volume2 size={24} color="#6b7280" />}
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.playButton} onPress={togglePlayback}>
          {isPlaying ? <Pause size={32} color="#ffffff" /> : <Play size={32} color="#ffffff" />}
        </TouchableOpacity>
        
        <View style={styles.controlButton} />
      </View>
    </View>
  );

  const renderImageViewer = () => (
    <View style={styles.imageContainer}>
      <Text style={styles.imageTitle}>{item.title || 'Image Content'}</Text>
      <Text style={styles.imageSubtitle}>
        {formatPlatformName(item.platform)} • Image (B&W Filter)
      </Text>
      
      <ScrollView 
        style={styles.imageScrollView}
        contentContainerStyle={styles.imageScrollContent}
        maximumZoomScale={3}
        minimumZoomScale={1}
      >
        <Image 
          source={{ uri: imageUri }} 
          style={[styles.image, styles.blackAndWhite]}
          resizeMode="contain"
        />
      </ScrollView>
    </View>
  );

  const renderTextViewer = () => (
    <View style={styles.textContainer}>
      <Text style={styles.textTitle}>{item.title || 'Text Content'}</Text>
      <Text style={styles.textSubtitle}>
        {formatPlatformName(item.platform)} • Text Content
      </Text>
      
      <ScrollView style={styles.textScrollView}>
        <Text style={styles.textContent}>{textContent || 'No content available'}</Text>
      </ScrollView>
    </View>
  );

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

  const renderContent = () => {
    if (!item || !item.contentType) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No content available</Text>
        </View>
      );
    }

    switch (item.contentType) {
      case 'audio':
        return renderAudioPlayer();
      case 'image':
        return renderImageViewer();
      case 'text':
        return renderTextViewer();
      default:
        return (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Unsupported content type: {item.contentType}</Text>
          </View>
        );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft} />
          <Text style={styles.headerTitle}>Media Viewer</Text>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <X size={24} color="#374151" />
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
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerLeft: {
    width: 24,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  
  // Audio Player Styles
  audioContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  audioSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 40,
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
    backgroundColor: '#2563eb',
    borderRadius: 2,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 14,
    color: '#6b7280',
  },
  audioControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: 200,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Image Viewer Styles
  imageContainer: {
    flex: 1,
  },
  imageTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  imageSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  imageScrollView: {
    flex: 1,
  },
  imageScrollContent: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: screenHeight - 200,
  },
  image: {
    width: screenWidth - 40,
    height: screenHeight - 200,
  },
  blackAndWhite: {
    // React Native doesn't have direct grayscale filter
    // This would need a more complex implementation with image processing libraries
    opacity: 0.9,
  },
  
  // Text Viewer Styles
  textContainer: {
    flex: 1,
  },
  textTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  textSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  textScrollView: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
  },
  textContent: {
    fontSize: 16,
    lineHeight: 24,
    color: '#374151',
  },
  
  // Error Styles
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
  },
});