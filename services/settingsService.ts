import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AppSettings {
  downloadFormat: 'audio' | 'video'; // User preference for video content
  audioQuality: 'high' | 'medium' | 'low';
  videoQuality: 'high' | 'medium' | 'low';
  autoDownload: boolean;
  darkMode: boolean;
  notifications: boolean;
  storageLocation: string;
  maxFileSize: number; // in MB
  blackAndWhiteImages: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  downloadFormat: 'audio',
  audioQuality: 'high',
  videoQuality: 'medium',
  autoDownload: false,
  darkMode: false,
  notifications: true,
  storageLocation: 'default',
  maxFileSize: 100,
  blackAndWhiteImages: true,
};

class SettingsService {
  private settings: AppSettings = DEFAULT_SETTINGS;
  private listeners: ((settings: AppSettings) => void)[] = [];

  async loadSettings(): Promise<AppSettings> {
    try {
      const stored = await AsyncStorage.getItem('@app_settings');
      if (stored) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
      return this.settings;
    } catch (error) {
      console.error('Error loading settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  async saveSettings(newSettings: Partial<AppSettings>): Promise<void> {
    try {
      this.settings = { ...this.settings, ...newSettings };
      await AsyncStorage.setItem('@app_settings', JSON.stringify(this.settings));
      
      // Notify listeners
      this.listeners.forEach(listener => listener(this.settings));
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }

  getSettings(): AppSettings {
    return this.settings;
  }

  getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.settings[key];
  }

  async updateSetting<K extends keyof AppSettings>(
    key: K, 
    value: AppSettings[K]
  ): Promise<void> {
    await this.saveSettings({ [key]: value });
  }

  subscribe(listener: (settings: AppSettings) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  async resetToDefaults(): Promise<void> {
    await this.saveSettings(DEFAULT_SETTINGS);
  }
}

export const settingsService = new SettingsService();