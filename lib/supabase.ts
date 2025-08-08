import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://eqxbfambjcrmbxbkybuu.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxeGJmYW1iamNybWJ4Ymt5YnV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MjM3NTMsImV4cCI6MjA3MDA5OTc1M30.Rk-KZB43KZm_rt0H8uVx9i-tdoHA3qY-l3i-fXfPVe4'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})