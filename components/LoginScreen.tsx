import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import GoogleIcon from './icons/GoogleIcon';
import AppleIcon from './icons/AppleIcon';

export default function LoginScreen() {
  const { signInWithGoogle, signInWithApple } = useAuth();
  const { theme } = useTheme();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      await signInWithGoogle();
    } catch (error: any) {
      Alert.alert('Sign In Error', error.message || 'Failed to sign in with Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setAppleLoading(true);
      await signInWithApple();
    } catch (error: any) {
      Alert.alert('Sign In Error', error.message || 'Failed to sign in with Apple');
    } finally {
      setAppleLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#fffbeb', // Warm cream background (Laudate theme)
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    header: {
      alignItems: 'center',
      marginBottom: 60,
    },
    logo: {
      width: 80,
      height: 80,
      marginBottom: 20,
      borderRadius: 16,
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      color: '#451a03', // Ancient brown (Laudate theme)
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: '#92400e', // Golden brown (Laudate theme)
      textAlign: 'center',
      marginBottom: 8,
      fontStyle: 'italic',
    },
    description: {
      fontSize: 14,
      color: '#a16207', // Darker golden (Laudate theme)
      textAlign: 'center',
      lineHeight: 20,
    },
    loginSection: {
      width: '100%',
      maxWidth: 320,
    },
    // Apple button - official black design
    appleButton: {
      backgroundColor: '#000000',
      paddingHorizontal: 24,
      paddingVertical: 16,
      borderRadius: 8, // Apple uses slightly rounded corners
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    appleButtonDisabled: {
      opacity: 0.6,
    },
    appleButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 10,
      fontFamily: 'SF Pro Display', // Apple's official font
    },
    // Google button - official white design with border
    googleButton: {
      backgroundColor: '#FFFFFF',
      paddingHorizontal: 24,
      paddingVertical: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#dadce0',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 1,
    },
    googleButtonDisabled: {
      opacity: 0.6,
    },
    googleButtonText: {
      color: '#3c4043', // Google's official text color
      fontSize: 16,
      fontWeight: '500',
      marginLeft: 12,
      fontFamily: 'Roboto', // Google's official font
    },
    signInRequiredText: {
      fontSize: 12,
      color: '#a16207', // Laudate theme color
      textAlign: 'center',
      marginTop: 20,
      lineHeight: 18,
    },
    benefits: {
      marginTop: 40,
      alignItems: 'center',
    },
    benefitsTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#451a03', // Laudate theme color
      marginBottom: 12,
    },
    benefitItem: {
      fontSize: 14,
      color: '#92400e', // Laudate theme color
      textAlign: 'center',
      marginBottom: 6,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Image 
          source={require('../assets/images/icon.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>Detach</Text>
        <Text style={styles.subtitle}>
          "Be still and know that I am God" - Psalm 46:10
        </Text>
        <Text style={styles.description}>
          Save content locally for intentional, prayerful consumption
        </Text>
      </View>

      <View style={styles.loginSection}>
        <TouchableOpacity
          style={[
            styles.appleButton,
            appleLoading && styles.appleButtonDisabled,
          ]}
          onPress={handleAppleSignIn}
          disabled={appleLoading || googleLoading}
        >
          {appleLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <AppleIcon size={18} color="#FFFFFF" />
              <Text style={styles.appleButtonText}>Sign in with Apple</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.googleButton,
            googleLoading && styles.googleButtonDisabled,
          ]}
          onPress={handleGoogleSignIn}
          disabled={googleLoading || appleLoading}
        >
          {googleLoading ? (
            <ActivityIndicator color="#3c4043" size="small" />
          ) : (
            <>
              <GoogleIcon size={18} />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.signInRequiredText}>
          Sign in is required to sync your downloads across devices and access cloud features.
        </Text>
      </View>

      <View style={styles.benefits}>
        <Text style={styles.benefitsTitle}>Why sign in?</Text>
        <Text style={styles.benefitItem}>• Sync downloads across all your devices</Text>
        <Text style={styles.benefitItem}>• Backup your content library</Text>
        <Text style={styles.benefitItem}>• Access your downloads anywhere</Text>
        <Text style={styles.benefitItem}>• Secure cloud storage</Text>
      </View>
    </SafeAreaView>
  );
}