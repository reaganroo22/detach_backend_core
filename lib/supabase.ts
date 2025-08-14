import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import Constants from 'expo-constants'

const extra = (Constants.expoConfig?.extra || (Constants.manifest as any)?.extra || {}) as any
const supabaseUrl = extra.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = extra.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment missing: ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in app config')
}

export const supabase = createClient(String(supabaseUrl || ''), String(supabaseAnonKey || ''), {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})