import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { X } from 'lucide-react-native';
import { DownloadItem } from '../services/downloadService';

interface SimpleMediaViewerProps {
  item: DownloadItem;
  visible: boolean;
  onClose: () => void;
}

export default function SimpleMediaViewer({ item, visible, onClose }: SimpleMediaViewerProps) {
  const formatPlatformName = (platform: DownloadItem['platform']) => {
    switch (platform) {
      case 'youtube': return 'YouTube';
      case 'instagram': return 'Instagram';
      case 'tiktok': return 'TikTok';
      default: return platform;
    }
  };

  const handlePlayAudio = () => {
    Alert.alert(
      'Audio Player',
      `Would open audio player for: ${item.title || 'Audio Content'}`,
      [
        { text: 'OK', style: 'default' }
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft} />
          <Text style={styles.headerTitle}>Media Viewer</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.mediaContainer}>
            <Text style={styles.mediaTitle}>{item.title || 'Media Content'}</Text>
            <Text style={styles.mediaSubtitle}>
              {formatPlatformName(item.platform)} • {item.contentType}
            </Text>
            
            {item.contentType === 'audio' && (
              <TouchableOpacity style={styles.playButton} onPress={handlePlayAudio}>
                <Text style={styles.playButtonText}>Play Audio</Text>
              </TouchableOpacity>
            )}
            
            <View style={styles.infoContainer}>
              <Text style={styles.infoText}>File: {item.filePath?.split('/').pop() || 'N/A'}</Text>
              <Text style={styles.infoText}>Status: {item.status}</Text>
              <Text style={styles.infoText}>Platform: {formatPlatformName(item.platform)}</Text>
            </View>
          </View>
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
  mediaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fffbeb', // Warm cream background
    borderRadius: 8,
    padding: 30,
    borderWidth: 2,
    borderColor: '#fbbf24', // Golden border
  },
  mediaTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#92400e', // Ancient brown
    textAlign: 'center',
    marginBottom: 8,
  },
  mediaSubtitle: {
    fontSize: 16,
    color: '#a16207', // Darker golden color
    textAlign: 'center',
    marginBottom: 30,
  },
  playButton: {
    backgroundColor: '#d97706', // Golden brown button
    borderRadius: 4, // Sharp corners
    padding: 16,
    borderWidth: 2,
    borderColor: '#92400e',
    marginBottom: 30,
  },
  playButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  infoContainer: {
    alignSelf: 'stretch',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  infoText: {
    fontSize: 14,
    color: '#92400e', // Ancient brown
    marginBottom: 4,
  },
});