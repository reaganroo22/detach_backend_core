import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { ThemeProvider } from '../contexts/ThemeContext';
import { AuthProvider } from '../contexts/AuthContext';
import BackgroundAudioService from '../services/backgroundAudioService';

export default function RootLayout() {
  useFrameworkReady();

  useEffect(() => {
    // Initialize background audio service
    const initializeBackgroundAudio = async () => {
      try {
        await BackgroundAudioService.initialize();
        console.log('Background audio service initialized successfully');
      } catch (error) {
        console.warn('Failed to initialize background audio:', error);
        // App will still work with fallback expo-audio
      }
    };

    initializeBackgroundAudio();
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </AuthProvider>
    </ThemeProvider>
  );
}
