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
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
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
  Settings,
  Upload,
  Archive,
  LogOut,
  User
} from 'lucide-react-native';
import { settingsService, AppSettings } from '../../services/settingsService';
import { downloadService } from '../../services/downloadService';
import { backupService } from '../../services/backupService';

export default function SettingsTab() {
  const { theme, settings } = useTheme();
  const { user, signOut } = useAuth();
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const updateSetting = async (key: keyof AppSettings, value: any) => {
    try {
      await settingsService.updateSetting(key, value);
      setLocalSettings(prev => ({ ...prev, [key]: value }));
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

  const handleFileSizeLimit = () => {
    Alert.alert(
      'File Size Limit',
      'Set the maximum file size for downloads:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '50MB (Conservative)',
          onPress: () => updateSetting('maxFileSize', 50),
        },
        {
          text: '100MB (Balanced)',
          onPress: () => updateSetting('maxFileSize', 100),
        },
        {
          text: '200MB (Generous)',
          onPress: () => updateSetting('maxFileSize', 200),
        },
        {
          text: 'No Limit',
          onPress: () => updateSetting('maxFileSize', 999),
        },
      ]
    );
  };

  const handleQualitySettings = () => {
    Alert.alert(
      'Quality Settings',
      'Choose quality preferences:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Low (Fast/Small)',
          onPress: () => {
            updateSetting('audioQuality', 'low');
            updateSetting('videoQuality', 'low');
          },
        },
        {
          text: 'Medium (Balanced)',
          onPress: () => {
            updateSetting('audioQuality', 'medium');
            updateSetting('videoQuality', 'medium');
          },
        },
        {
          text: 'High (Best Quality)',
          onPress: () => {
            updateSetting('audioQuality', 'high');
            updateSetting('videoQuality', 'high');
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? You will need to sign in again to access your synced content.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          }
        },
      ]
    );
  };

  const handleAppInfo = () => {
    Alert.alert(
      'Detach',
      `Version 1.0.0

Built for intentional living and spiritual growth.

"Be still and know that I am God" - Psalm 46:10

This app helps you:
• Download content for offline, mindful consumption
• Reduce digital distractions
• Support your spiritual journey
• Practice digital minimalism

Backend service required for downloading functionality.`,
      [{ text: 'OK' }]
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
          icon: localSettings.downloadFormat === 'audio' ? Music : Video,
          title: 'Download Format',
          subtitle: `${localSettings.downloadFormat === 'audio' ? 'Audio Only (Mindful)' : 'Full Video (Standard)'} - Applies to YouTube, TikTok, Instagram Reels`,
          hasArrow: true,
          onPress: handleFormatChange,
        },
        {
          icon: Settings,
          title: 'Quality Settings',
          subtitle: `Audio: ${localSettings.audioQuality.charAt(0).toUpperCase() + localSettings.audioQuality.slice(1)} • Video: ${localSettings.videoQuality.charAt(0).toUpperCase() + localSettings.videoQuality.slice(1)}`,
          hasArrow: true,
          onPress: handleQualitySettings,
        },
        {
          icon: Download,
          title: 'Auto Download',
          subtitle: 'Start downloading immediately when you paste a URL (otherwise downloads stay pending)',
          toggle: localSettings.autoDownload,
          onToggle: (value: boolean) => updateSetting('autoDownload', value),
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
          toggle: localSettings.notifications,
          onToggle: (value: boolean) => updateSetting('notifications', value),
        },
        {
          icon: Moon,
          title: 'Dark Mode',
          subtitle: 'Use dark theme for evening use',
          toggle: localSettings.darkMode,
          onToggle: (value: boolean) => updateSetting('darkMode', value),
        },
        {
          icon: Shield,
          title: 'File Size Limit',
          subtitle: `Maximum file size: ${localSettings.maxFileSize === 999 ? 'No Limit' : localSettings.maxFileSize + 'MB'}`,
          hasArrow: true,
          onPress: handleFileSizeLimit,
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
      title: 'Account',
      items: [
        {
          icon: User,
          title: 'Signed in as',
          subtitle: user?.email || 'Unknown',
          hasArrow: false,
        },
        {
          icon: LogOut,
          title: 'Sign Out',
          subtitle: 'You will need to sign in again to access synced content',
          hasArrow: true,
          isDestructive: true,
          onPress: handleSignOut,
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
          onPress: handleAppInfo,
        },
      ],
    },
  ];

  const styles = createStyles(theme);

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
                      color={item.isDestructive ? theme.colors.error : theme.colors.text} 
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
                    {'toggle' in item && item.toggle !== undefined ? (
                      <Switch
                        value={item.toggle}
                        onValueChange={item.onToggle}
                        trackColor={{ false: theme.colors.cardBackground, true: theme.colors.primary }}
                        thumbColor={item.toggle ? theme.colors.primaryText : theme.colors.textSecondary}
                      />
                    ) : item.hasArrow ? (
                      <ChevronRight size={20} color={theme.colors.text} />
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

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: 20,
    paddingBottom: 0,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 24,
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },
  inspirationalCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 24,
  },
  inspirationalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  inspirationalSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  sectionContent: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: 20,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
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
    borderBottomColor: theme.colors.border,
  },
  settingItemLast: {
    borderBottomWidth: 0,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.cardBackground,
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
    color: theme.colors.text,
    marginBottom: 2,
  },
  settingTitleDestructive: {
    color: '#ef4444',
  },
  settingSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  settingAction: {
    marginLeft: 12,
  },
  footerSection: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: 20,
    borderRadius: 8,
    padding: 20,
    marginBottom: 40,
    borderWidth: 2,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  footerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  footerText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
});