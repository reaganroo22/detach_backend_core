import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Bell, 
  Download, 
  Trash2, 
  Shield, 
  Clock, 
  Moon,
  Smartphone,
  ChevronRight,
  Info,
  Music,
  Video,
  Image,
  Settings,
  Upload,
  Archive
} from 'lucide-react-native';
import { settingsService, AppSettings } from '../../services/settingsService';
import { downloadService } from '../../services/downloadService';
import { backupService } from '../../services/backupService';

export default function SettingsTab() {
  const [settings, setSettings] = useState<AppSettings>({
    downloadFormat: 'audio',
    audioQuality: 'high',
    videoQuality: 'medium',
    autoDownload: false,
    darkMode: false,
    notifications: true,
    storageLocation: 'default',
    maxFileSize: 100,
    blackAndWhiteImages: true,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const currentSettings = await settingsService.loadSettings();
    setSettings(currentSettings);
  };

  const updateSetting = async (key: keyof AppSettings, value: any) => {
    try {
      await settingsService.updateSetting(key, value);
      setSettings(prev => ({ ...prev, [key]: value }));
    } catch (error) {
      Alert.alert('Error', 'Failed to save setting');
    }
  };

  const handleClearAllDownloads = () => {
    Alert.alert(
      'Clear All Downloads',
      'This will permanently delete all downloaded content. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await downloadService.clearAllDownloads();
              Alert.alert('Success', 'All downloads have been cleared');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear downloads');
            }
          },
        },
      ]
    );
  };

  const handleFormatChange = () => {
    Alert.alert(
      'Download Format',
      'Choose how to download video content from YouTube, TikTok, and Instagram Reels:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Audio Only (Mindful)',
          onPress: () => updateSetting('downloadFormat', 'audio'),
        },
        {
          text: 'Full Video (Standard)',
          onPress: () => updateSetting('downloadFormat', 'video'),
        },
      ]
    );
  };

  const handleExportBackup = async () => {
    try {
      await backupService.exportBackup();
    } catch (error) {
      Alert.alert('Error', 'Failed to export backup');
    }
  };

  const handleExportURLs = async () => {
    try {
      await backupService.exportURLsOnly();
    } catch (error) {
      Alert.alert('Error', 'Failed to export URLs');
    }
  };

  const handleBackupOptions = () => {
    Alert.alert(
      'Backup Options',
      'Choose what to export:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Full Backup (JSON)',
          onPress: handleExportBackup,
        },
        {
          text: 'URLs Only (TXT)',
          onPress: handleExportURLs,
        },
      ]
    );
  };

  const settingSections = [
    {
      title: 'Download Preferences',
      items: [
        {
          icon: settings.downloadFormat === 'audio' ? Music : Video,
          title: 'Download Format',
          subtitle: `${settings.downloadFormat === 'audio' ? 'Audio Only (Mindful)' : 'Full Video (Standard)'} - Applies to YouTube, TikTok, Instagram Reels`,
          hasArrow: true,
          onPress: handleFormatChange,
        },
        {
          icon: Download,
          title: 'Auto Download',
          subtitle: 'Start downloading immediately when you paste a URL (otherwise downloads stay pending)',
          toggle: settings.autoDownload,
          onToggle: (value: boolean) => updateSetting('autoDownload', value),
        },
        {
          icon: Image,
          title: 'Black & White Media',
          subtitle: 'Display images and videos in grayscale for mindful viewing',
          toggle: settings.blackAndWhiteImages,
          onToggle: (value: boolean) => updateSetting('blackAndWhiteImages', value),
        },
      ],
    },
    {
      title: 'Focus & Mindfulness',
      items: [
        {
          icon: Bell,
          title: 'Notifications',
          subtitle: 'Get notified when downloads complete',
          toggle: settings.notifications,
          onToggle: (value: boolean) => updateSetting('notifications', value),
        },
        {
          icon: Moon,
          title: 'Dark Mode',
          subtitle: 'Use dark theme for evening use',
          toggle: settings.darkMode,
          onToggle: (value: boolean) => updateSetting('darkMode', value),
        },
        {
          icon: Shield,
          title: 'File Size Limit',
          subtitle: `Maximum file size: ${settings.maxFileSize}MB`,
          hasArrow: true,
        },
      ],
    },
    {
      title: 'Backup & Storage',
      items: [
        {
          icon: Archive,
          title: 'Export Backup',
          subtitle: 'Save your downloads list for safekeeping',
          hasArrow: true,
          onPress: handleBackupOptions,
        },
        {
          icon: Upload,
          title: 'Auto Backup',
          subtitle: 'Automatically backup downloads weekly',
          toggle: false, // Could be a setting
          onToggle: (value: boolean) => {
            // Future feature
            Alert.alert('Coming Soon', 'Auto backup feature will be available in a future update');
          },
        },
        {
          icon: Trash2,
          title: 'Clear All Downloads',
          subtitle: 'Remove all saved content from device',
          isDestructive: true,
          onPress: handleClearAllDownloads,
        },
      ],
    },
    {
      title: 'About',
      items: [
        {
          icon: Info,
          title: 'App Information',
          subtitle: 'Version 1.0.0 - Built for intentional living',
          hasArrow: true,
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>
          Configure your app for mindful, intentional use
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inspirationalCard}>
          <Text style={styles.inspirationalTitle}>
            "Be it done unto me according to thy word"
          </Text>
          <Text style={styles.inspirationalSubtitle}>
            Luke 1:38 - Embrace God's will in all things
          </Text>
        </View>

        {settingSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionContent}>
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={itemIndex}
                  style={[
                    styles.settingItem,
                    itemIndex === section.items.length - 1 && styles.settingItemLast,
                  ]}
                  activeOpacity={0.7}
                  onPress={item.onPress}
                >
                  <View style={styles.settingIcon}>
                    <item.icon 
                      size={20} 
                      color={item.isDestructive ? '#ef4444' : '#6b7280'} 
                    />
                  </View>
                  
                  <View style={styles.settingInfo}>
                    <Text style={[
                      styles.settingTitle,
                      item.isDestructive && styles.settingTitleDestructive,
                    ]}>
                      {item.title}
                    </Text>
                    <Text style={styles.settingSubtitle}>
                      {item.subtitle}
                    </Text>
                  </View>

                  <View style={styles.settingAction}>
                    {item.toggle !== undefined ? (
                      <Switch
                        value={item.toggle}
                        onValueChange={item.onToggle}
                        trackColor={{ false: '#f3f4f6', true: '#dbeafe' }}
                        thumbColor={item.toggle ? '#2563eb' : '#9ca3af'}
                      />
                    ) : item.hasArrow ? (
                      <ChevronRight size={20} color="#9ca3af" />
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.footerSection}>
          <Text style={styles.footerTitle}>Digital Minimalism</Text>
          <Text style={styles.footerText}>
            This app is designed to help you consume content intentionally, 
            reducing digital distractions and supporting your spiritual growth. 
            Use technology as a tool, not entertainment.
          </Text>
        </View>
      </ScrollView>
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
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#92400e', // Ancient brown/gold color
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#a16207', // Darker golden color
    lineHeight: 24,
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },
  inspirationalCard: {
    backgroundColor: '#fffbeb', // Warm cream background
    borderWidth: 2,
    borderColor: '#fbbf24', // Golden border
    borderRadius: 8, // Less rounded for ancient look
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 24,
  },
  inspirationalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#92400e', // Ancient brown
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  inspirationalSubtitle: {
    fontSize: 14,
    color: '#b45309', // Warm golden brown
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400e', // Ancient brown
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  sectionContent: {
    backgroundColor: '#fffbeb', // Warm cream background
    marginHorizontal: 20,
    borderRadius: 8, // Less rounded
    borderWidth: 2,
    borderColor: '#fbbf24', // Golden border
    shadowColor: '#92400e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingItemLast: {
    borderBottomWidth: 0,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  settingTitleDestructive: {
    color: '#ef4444',
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  settingAction: {
    marginLeft: 12,
  },
  footerSection: {
    backgroundColor: '#fffbeb', // Warm cream background
    marginHorizontal: 20,
    borderRadius: 8,
    padding: 20,
    marginBottom: 40,
    borderWidth: 2,
    borderColor: '#fbbf24', // Golden border
    shadowColor: '#92400e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  footerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400e', // Ancient brown
    marginBottom: 8,
  },
  footerText: {
    fontSize: 14,
    color: '#a16207', // Darker golden color
    lineHeight: 22,
  },
});