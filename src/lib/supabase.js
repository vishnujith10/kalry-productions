import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Use environment variables directly (from eas.json in production)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || Constants.expoConfig.extra.supabaseUrl;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || Constants.expoConfig.extra.supabaseAnonKey;

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage, // Use AsyncStorage for persistent auth
    autoRefreshToken: true, // Automatically refresh tokens
    persistSession: true, // Persist session across app restarts
    detectSessionInUrl: false, // Don't detect session in URL (for mobile)
  },
});

// Enhanced session management with "Remember Me" functionality
export const handleSessionExpiry = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      // Check if we have stored credentials for auto-login
      const storedEmail = await AsyncStorage.getItem('remembered_email');
      const storedPassword = await AsyncStorage.getItem('remembered_password');
      
      if (storedEmail && storedPassword) {
        // Auto-login with stored credentials
        const { data, error: loginError } = await supabase.auth.signInWithPassword({
          email: storedEmail,
          password: storedPassword,
        });
        
        if (loginError) {
          // Clear invalid stored credentials
          await AsyncStorage.removeItem('remembered_email');
          await AsyncStorage.removeItem('remembered_password');
          return null;
        }
        
        return data.session;
      }
    }
    
    return session;
  } catch (error) {
    console.error('Session handling error:', error);
    return null;
  }
};

// Store credentials for "Remember Me" functionality
export const rememberUser = async (email, password) => {
  try {
    await AsyncStorage.setItem('remembered_email', email);
    await AsyncStorage.setItem('remembered_password', password);
  } catch (error) {
    console.error('Error storing credentials:', error);
  }
};

// Clear stored credentials
export const forgetUser = async () => {
  try {
    await AsyncStorage.removeItem('remembered_email');
    await AsyncStorage.removeItem('remembered_password');
  } catch (error) {
    console.error('Error clearing credentials:', error);
  }
};

export default supabase;
