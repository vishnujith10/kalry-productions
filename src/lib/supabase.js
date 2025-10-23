import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Use environment variables directly (from eas.json in production)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || Constants.expoConfig.extra.supabaseUrl;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || Constants.expoConfig.extra.supabaseAnonKey;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;
