import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { X } from 'lucide-react-native';
import { DownloadItem } from '../services/downloadService';

interface SafeMediaViewerProps {
  item: DownloadItem | null;
  visible: boolean;
  onClose: () => void;
  playlist?: DownloadItem[];
  initialIndex?: number;
}

// Minimal, crash-free media viewer for production builds
export default function SafeMediaViewer({ item, visible, onClose, playlist, initialIndex }: SafeMediaViewerProps) {
  if (!item) return null;

  return (
    <Modal
      visible={visible}
      presentationStyle="fullScreen"
      animationType="slide"
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.title}>{item.title}</Text>
        </View>
        
        <View style={styles.content}>
          <Text style={styles.message}>
            Media viewer temporarily simplified for production build.
          </Text>
          <Text style={styles.details}>
            Platform: {item.platform}
            {'\n'}Status: {item.status}
            {'\n'}Type: {item.contentType}
          </Text>
          
          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  closeButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  details: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 40,
    color: '#999',
  },
  button: {
    backgroundColor: '#000',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});