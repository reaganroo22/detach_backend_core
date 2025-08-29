import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import Constants from 'expo-constants'

const extra = (Constants.expoConfig?.extra || (Constants.manifest as any)?.extra || {}) as any
const supabaseUrl = extra.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = extra.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

// Fallback values for production builds when env vars aren't available
const fallbackUrl = 'https://placeholder.supabase.co'
const fallbackKey = 'placeholder-key'

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment missing: using fallback configuration for offline mode')
}

export const supabase = createClient(
  String(supabaseUrl || fallbackUrl), 
  String(supabaseAnonKey || fallbackKey), 
{
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})