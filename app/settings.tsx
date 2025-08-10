import React from 'react';
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
  ArrowLeft, 
  User, 
  Download,
  Palette,
  Shield,
  HelpCircle,
  LogOut,
  Moon,
  Sun,
  Smartphone,
  Globe
} from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { settingsService } from '../services/settingsService';
import { router } from 'expo-router';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme, isDarkMode } = useTheme();
  const [autoDownload, setAutoDownload] = React.useState(false);

  React.useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const settings = await settingsService.getSettings();
    setAutoDownload(settings.autoDownload);
  };

  const handleAutoDownloadToggle = async (value: boolean) => {
    setAutoDownload(value);
    await settingsService.updateSettings({ autoDownload: value });
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              router.replace('/(tabs)');
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  const handleAbout = () => {
    Alert.alert(
      'About Detach',
      'Save content locally for intentional, prayerful consumption. Practice digital minimalism with offline access to your favorite content.\n\nVersion 1.0.0',
      [{ text: 'OK' }]
    );
  };

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.settingItem}>
            <View style={styles.settingIcon}>
              <User size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Signed in as</Text>
              <Text style={styles.settingValue}>
                {user?.email || 'Unknown'}
              </Text>
            </View>
          </View>
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <TouchableOpacity 
            style={styles.settingItem} 
            onPress={toggleTheme}
          >
            <View style={styles.settingIcon}>
              {isDarkMode ? (
                <Moon size={20} color={theme.colors.primary} />
              ) : (
                <Sun size={20} color={theme.colors.primary} />
              )}
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Theme</Text>
              <Text style={styles.settingValue}>
                {isDarkMode ? 'Dark' : 'Light'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Download Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Downloads</Text>
          <View style={styles.settingItem}>
            <View style={styles.settingIcon}>
              <Download size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Auto Download</Text>
              <Text style={styles.settingDescription}>
                Automatically start downloads when URLs are added
              </Text>
            </View>
            <Switch
              value={autoDownload}
              onValueChange={handleAutoDownloadToggle}
              trackColor={{ 
                false: theme.colors.border, 
                true: theme.colors.primary + '50' 
              }}
              thumbColor={autoDownload ? theme.colors.primary : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleAbout}
          >
            <View style={styles.settingIcon}>
              <HelpCircle size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>About</Text>
              <Text style={styles.settingDescription}>
                Version and app information
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Account Actions */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={[styles.settingItem, styles.dangerItem]}
            onPress={handleSignOut}
          >
            <View style={styles.settingIcon}>
              <LogOut size={20} color="#ef4444" />
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, styles.dangerText]}>
                Sign Out
              </Text>
              <Text style={styles.settingDescription}>
                Sign out of your account
              </Text>
            </View>
          </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  settingValue: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  settingDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  dangerItem: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  dangerText: {
    color: '#ef4444',
  },
});