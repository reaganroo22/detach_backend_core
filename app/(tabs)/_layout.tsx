import React from 'react';
import { Tabs } from 'expo-router';
import { Download, Archive, List } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import LoginScreen from '../../components/LoginScreen';
import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export default function TabLayout() {
  const { session, loading } = useAuth();
  const { theme } = useTheme();

  if (loading) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: '#fffbeb' // Laudate theme background
      }}>
        <ActivityIndicator size="large" color="#d97706" />
      </View>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#d97706', // Laudate theme active color
        tabBarInactiveTintColor: '#92400e', // Laudate theme inactive color
        tabBarStyle: {
          backgroundColor: '#fffbeb', // Laudate theme background
          borderTopWidth: 2,
          borderTopColor: '#fbbf24', // Laudate theme border
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Download',
          tabBarIcon: ({ size, color }) => (
            <Download size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: ({ size, color }) => (
            <Archive size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="playlists"
        options={{
          title: 'Playlists',
          tabBarIcon: ({ size, color }) => (
            <List size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}