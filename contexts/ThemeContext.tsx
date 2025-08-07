import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { settingsService, AppSettings } from '../services/settingsService';

export interface Theme {
  colors: {
    background: string;
    surface: string;
    cardBackground: string;
    border: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
    primary: string;
    primaryText: string;
    success: string;
    error: string;
    warning: string;
    shadow: string;
  };
  isDark: boolean;
}

const lightTheme: Theme = {
  colors: {
    background: '#faf7f2', // Softer warm cream background
    surface: '#f7f3ed', // Gentle cream surface 
    cardBackground: '#fefcf9', // Very soft off-white cards
    border: '#e4b429', // Slightly muted golden border
    text: '#8b4513', // Softer brown text
    textSecondary: '#a0651d', // Softer golden brown
    textTertiary: '#5d2e05', // Softer dark brown
    primary: '#c4721a', // Softer golden brown
    primaryText: '#fefcf9', // Off-white instead of pure white
    success: '#dcfce7',
    error: '#dc2626', 
    warning: '#fef3c7',
    shadow: '#00000020', // Much softer shadow
  },
  isDark: false,
};

const darkTheme: Theme = {
  colors: {
    background: '#1c1917', // Dark brown
    surface: '#292524', // Slightly lighter brown
    cardBackground: '#44403c', // Medium brown
    border: '#a16207', // Golden border (dimmed)
    text: '#fbbf24', // Golden text
    textSecondary: '#d97706', // Orange-gold
    textTertiary: '#f59e0b', // Bright gold
    primary: '#f59e0b', // Bright gold
    primaryText: '#1c1917', // Dark text on bright background
    success: '#166534',
    error: '#ef4444',
    warning: '#a16207',
    shadow: '#000000',
  },
  isDark: true,
};

interface ThemeContextType {
  theme: Theme;
  settings: AppSettings;
  updateTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>({
    downloadFormat: 'audio',
    audioQuality: 'high',
    videoQuality: 'medium',
    autoDownload: false,
    darkMode: false,
    notifications: true,
    storageLocation: 'default',
    maxFileSize: 100,
  });

  const [theme, setTheme] = useState<Theme>(lightTheme);

  useEffect(() => {
    loadSettings();
    
    // Subscribe to settings changes
    const unsubscribe = settingsService.subscribe((newSettings) => {
      setSettings(newSettings);
      setTheme(newSettings.darkMode ? darkTheme : lightTheme);
    });

    return unsubscribe;
  }, []);

  const loadSettings = async () => {
    const currentSettings = await settingsService.loadSettings();
    setSettings(currentSettings);
    setTheme(currentSettings.darkMode ? darkTheme : lightTheme);
  };

  const updateTheme = () => {
    setTheme(settings.darkMode ? darkTheme : lightTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, settings, updateTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};