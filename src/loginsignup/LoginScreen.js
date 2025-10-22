import { GOOGLE_CLIENT_ID } from '@env';
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { makeRedirectUri } from 'expo-auth-session';
import React, { useContext, useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OnboardingContext } from '../context/OnboardingContext';
import supabase from '../lib/supabase';

const PRIMARY = '#000000';
const ORANGE = '  #ff8800';
const BACKGROUND = '#ffffff';
const GRAY_MEDIUM = '#e0e0e0';
const GRAY_LIGHT = '#f5f5f5';

const useProxy = true;
const redirectUri = makeRedirectUri({ useProxy });

const CLIENT_ID = GOOGLE_CLIENT_ID;

const LoginScreen = ({ navigation }) => {
  const { onboardingData } = useContext(OnboardingContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Note: We don't need to handle navigation in onAuthStateChange here
  // because handleLogin already navigates after successful login.
  // This prevents double navigation animation.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Only handle OAuth redirects (Google/Apple), not password login
      if (event === 'SIGNED_IN' && session && !email) {
        // OAuth login (no email in state means it's from Google/Apple)
        navigation.replace('MainDashboard');
      }
    });
    return () => {
      subscription?.unsubscribe();
    };
  }, [email]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      const user = data.user;
      if (!user) {
        Alert.alert('Error', 'Login failed. Please try again.');
        setLoading(false);
        return;
      }

      // Check if profile exists
      const { data: profile, error: profileError } = await supabase
        .from('user_profile')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!profile) {
        // For production: Verify session exists after login
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.error('No session found after login - this should not happen');
          Alert.alert('Error', 'Login failed to establish session. Please try again.');
          return;
        }
        
        console.log('Session verified, proceeding with profile creation...');

        // Insert onboardingData
        const userProfile = {
          id: user.id,
          name: onboardingData.name,
          age: Number(onboardingData.age),
          gender: onboardingData.gender,
          height: parseFloat(onboardingData.height),
          weight: parseFloat(onboardingData.weight),
          social_refference: onboardingData.social_refference,
          daily_activity_level: onboardingData.daily_activity_level,
          goal_focus: onboardingData.goal_focus,
          target_weight: parseFloat(onboardingData.target_weight),
          weekly_target: onboardingData.weekly_target,
          spending_time: onboardingData.spending_time,
          prefered_workout: onboardingData.prefered_workout,
          total_days_per_week: Number(onboardingData.total_days_per_week),
          prefered_time: onboardingData.prefered_time,
          // Add unit preferences from onboarding
          weight_unit: onboardingData.isMetric ? 'kg' : 'lbs',
          height_unit: onboardingData.isMetric ? 'cm' : 'ft',
        };
        
        console.log('Attempting to insert profile for user:', user.id);
        const { error: insertError } = await supabase
          .from('user_profile')
          .insert([userProfile]);
        if (insertError) {
          console.error('Profile insert error:', insertError);
          Alert.alert('Warning', 'Account created but failed to save profile. Please contact support.');
        }
      }

      navigation.replace('MainDashboard');
    } catch (error) {
      if (error.message && error.message.includes('Invalid login credentials')) {
        Alert.alert('Error', 'Invalid email or password');
      } else {
        Alert.alert('Error', error.message || 'Login failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
        }
      });
      
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        // The OAuth flow will be handled by the provider
        console.log('Google OAuth initiated');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleAppleLogin = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: redirectUri,
        }
      });
      
      if (error) throw error;
      // The OAuth flow will be handled by the provider
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={28} color={PRIMARY} />
          </TouchableOpacity>
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>
            Sign in to continue your fitness journey
          </Text>
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <MaterialIcons name="email" size={24} color={GRAY_MEDIUM} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.inputContainer}>
              <MaterialIcons name="lock" size={24} color={GRAY_MEDIUM} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Signing in...' : 'SIGN IN'}
              </Text>
            </TouchableOpacity>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>
            <TouchableOpacity
              style={[styles.socialButton, styles.appleButton]}
              onPress={handleAppleLogin}
            >
              <FontAwesome5 name="apple" size={20} color={BACKGROUND} />
              <Text style={styles.socialButtonText}>CONNECT WITH APPLE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.socialButton, styles.googleButton]}
              onPress={handleGoogleLogin}
            >
              <FontAwesome5 name="google" size={20} color={BACKGROUND} />
              <Text style={styles.socialButtonText}>CONNECT WITH GOOGLE</Text>
            </TouchableOpacity>
            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>Don&apos;t have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('MiniProfile')}>
                <Text style={styles.signupLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    padding: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GRAY_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: PRIMARY,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: GRAY_MEDIUM,
    marginBottom: 32,
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GRAY_LIGHT,
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 56,
    fontSize: 16,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: ORANGE,
    fontSize: 14,
  },
  button: {
    backgroundColor: PRIMARY,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: BACKGROUND,
    fontSize: 16,
    fontWeight: 'bold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: GRAY_MEDIUM,
  },
  dividerText: {
    marginHorizontal: 16,
    color: GRAY_MEDIUM,
  },
  socialButton: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appleButton: {
    backgroundColor: '#000000',
  },
  googleButton: {
    backgroundColor: '#DB4437',
  },
  socialButtonText: {
    color: BACKGROUND,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  signupText: {
    color: GRAY_MEDIUM,
  },
  signupLink: {
    color: ORANGE,
    fontWeight: 'bold',
  },
});

export default LoginScreen; 