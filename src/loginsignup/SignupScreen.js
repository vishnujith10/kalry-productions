import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
import calculateCalorieProfile from '../utils/calorieCalculator';

// Modern Fitness Light Mode Palette
const LIGHT_BG = '#F8F9FE';
const CARD_BG = '#FFFFFF';
const TEXT_PRIMARY = '#1A1D2E';
const TEXT_SECONDARY = '#6B7280';
const ELECTRIC_BLUE = '#2563EB';
const BRIGHT_CYAN = '#06B6D4';

const SignupScreen = ({ navigation }) => {
  const { onboardingData } = useContext(OnboardingContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [confirmPasswordError, setConfirmPasswordError] = useState(false);

  // Test Supabase connectivity
  useEffect(() => {
    supabase
      .from('user_profile')
      .select('*')
      .limit(1)
      .then(({ data, error }) => {
        console.log('Test select:', { data, error });
      });
  }, []);

  const handlePasswordChange = (text) => {
    setPassword(text);
    if (passwordError) {
      setPasswordError(false);
    }
  };

  const handleConfirmPasswordChange = (text) => {
    setConfirmPassword(text);
    if (confirmPasswordError) {
      setConfirmPasswordError(false);
    }
  };

  const handleSignup = async () => {
    // Clear previous errors
    setPasswordError(false);
    setConfirmPasswordError(false);

    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      setPasswordError(true);
      Alert.alert('Weak Password', 'Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setConfirmPasswordError(true);
      Alert.alert('Password Mismatch', 'Passwords do not match. Please re-enter the correct password.');
      return;
    }

    try {
      setLoading(true);
      console.log('Attempting signup with:', { email });
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: 'kalry://login',
        },
      });

      console.log('Signup response:', { data, error });

      if (error) {
        if (error.message === 'User already registered') {
          Alert.alert(
            'Account Exists',
            'This email is already registered. Please try logging in instead.',
            [
              {
                text: 'Go to Login',
                onPress: () => navigation.navigate('Login'),
              },
              {
                text: 'Cancel',
                style: 'cancel',
              },
            ]
          );
        } else {
          Alert.alert('Signup Error', error.message);
        }
        return;
      }

      if (!data) {
        Alert.alert(
          'Signup Complete',
          'Your account was created! Please log in to continue.',
          [{ text: 'OK', onPress: () => navigation.replace('Login') }]
        );
        return;
      }

      // Check if email confirmation is required
      if (data.user?.identities?.length === 0) {
        Alert.alert(
          'Check Your Email',
          'Please check your email for a confirmation link to complete your registration.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Login'),
            },
          ]
        );
        return;
      }

      // If we get here, the user is confirmed
      if (data.user) {
        // For production: Sign in immediately after signup to establish session
        console.log('User created, signing in to establish session...');
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email,
          password: password
        });
        
        if (signInError) {
          console.error('Sign in failed after signup:', signInError);
          Alert.alert('Error', 'Account created but failed to establish session. Please try logging in manually.');
          return;
        }
        
        console.log('Successfully signed in, session established for profile creation');

        // Prepare the user profile data
        const userProfile = {
          id: data.user.id, // uuid from Supabase Auth
          name: onboardingData.name,
          age: onboardingData.age,
          gender: onboardingData.gender,
          height: onboardingData.height,
          weight: onboardingData.weight,
          social_refference: onboardingData.social_refference,
          daily_activity_level: onboardingData.daily_activity_level,
          goal_focus: onboardingData.goal_focus,
          target_weight: onboardingData.target_weight,
          weekly_target: onboardingData.weekly_target,
          spending_time: onboardingData.spending_time,
          prefered_workout: onboardingData.prefered_workout,
          total_days_per_week: onboardingData.total_days_per_week,
          prefered_time: onboardingData.prefered_time,
          // Add unit preferences from onboarding
          weight_unit: onboardingData.isMetric ? 'kg' : 'lbs',
          height_unit: onboardingData.isMetric ? 'cm' : 'ft',
        };

        console.log('Attempting to insert profile for user:', data.user.id);
        
        // Use a more permissive approach for profile creation
        // This works because we're using the user ID from the authenticated signup response
        const { error: profileError } = await supabase
          .from('user_profile')
          .insert([userProfile]);

        if (profileError) {
          console.error('Profile insert error:', profileError);
          Alert.alert('Warning', 'Account created but failed to save profile. Please contact support.');
        } else {
          // Calculate and update calorie profile
          const calorieData = calculateCalorieProfile({
            age: Number(onboardingData.age),
            gender: (onboardingData.gender || '').toLowerCase(),
            weight_kg: Number(onboardingData.weight),
            height_cm: Number(onboardingData.height),
            activity_level: (onboardingData.daily_activity_level || '').toLowerCase(),
            goal_type: (onboardingData.goal_focus || '').toLowerCase().includes('lose') ? 'lose' : (onboardingData.goal_focus || '').toLowerCase().includes('gain') ? 'gain' : 'maintain',
          });
          await supabase.from('user_profile').update({
            bmr: calorieData.bmr,
            tdee: calorieData.tdee,
            calorie_goal: calorieData.calorie_goal,
            protein_g: calorieData.macro_targets.protein_g,
            fat_g: calorieData.macro_targets.fat_g,
            carbs_g: calorieData.macro_targets.carbs_g,
          }).eq('id', data.user.id);
        }

        navigation.reset({
          index: 0,
          routes: [{ name: 'MainDashboard' }],
        });
      }
    } catch (error) {
      console.error('Signup error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <View style={styles.backButtonCircle}>
            <MaterialIcons name="arrow-back" size={24} color={TEXT_PRIMARY} />
          </View>
        </TouchableOpacity>
        <Text style={styles.heading}>Create Account</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false} 
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.contentWrapper}>
          <View style={styles.header}>
            <Text style={styles.subtitle}>GET STARTED</Text>
            <Text style={styles.title}>Create your{'\n'}account</Text>
            <Text style={styles.description}>
              Sign up to start your fitness journey
            </Text>
          </View>
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <LinearGradient
                colors={['#EEF2FF', '#E0E7FF']}
                style={styles.inputIconWrapper}
              >
                <MaterialIcons name="email" size={20} color={ELECTRIC_BLUE} />
              </LinearGradient>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={TEXT_SECONDARY}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={[styles.inputContainer, passwordError && styles.inputContainerError]}>
              <LinearGradient
                colors={passwordError ? ['#FEE2E2', '#FECACA'] : ['#F3E8FF', '#E9D5FF']}
                style={styles.inputIconWrapper}
              >
                <MaterialIcons name="lock" size={20} color={passwordError ? '#EF4444' : ELECTRIC_BLUE} />
              </LinearGradient>
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={TEXT_SECONDARY}
                value={password}
                onChangeText={handlePasswordChange}
                secureTextEntry
              />
            </View>
            {passwordError && (
              <Text style={styles.errorText}>Password must be at least 6 characters long</Text>
            )}
            <View style={[styles.inputContainer, confirmPasswordError && styles.inputContainerError]}>
              <LinearGradient
                colors={confirmPasswordError ? ['#FEE2E2', '#FECACA'] : ['#DBEAFE', '#BFDBFE']}
                style={styles.inputIconWrapper}
              >
                <MaterialIcons name="lock" size={20} color={confirmPasswordError ? '#EF4444' : ELECTRIC_BLUE} />
              </LinearGradient>
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor={TEXT_SECONDARY}
                value={confirmPassword}
                onChangeText={handleConfirmPasswordChange}
                secureTextEntry
              />
            </View>
            {confirmPasswordError && (
              <Text style={styles.errorText}>Passwords do not match</Text>
            )}
            <TouchableOpacity
              style={[styles.ctaButton, loading && styles.ctaButtonDisabled]}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <View style={styles.buttonDisabled}>
                  <Text style={styles.buttonTextDisabled}>Creating Account...</Text>
                </View>
              ) : (
                <LinearGradient
                  colors={[ELECTRIC_BLUE, BRIGHT_CYAN]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.buttonText}>Create Account</Text>
                  <MaterialIcons name="arrow-forward" size={22} color="#FFFFFF" />
                </LinearGradient>
              )}
            </TouchableOpacity>
            {/* <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View> */}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LIGHT_BG,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    marginBottom: 20,
  },
  backButton: {
    zIndex: 10,
  },
  backButtonCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CARD_BG,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  heading: {
    fontSize: 20,
    fontFamily: 'Lexend-Bold',
    color: TEXT_PRIMARY,
    textAlign: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 28,
  },
  subtitle: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    fontFamily: 'Manrope-Regular',
    letterSpacing: 2,
    fontWeight: '600',
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    fontFamily: 'Lexend-Bold',
    letterSpacing: -0.5,
    marginBottom: 8,
    lineHeight: 34,
  },
  description: {
    fontSize: 16,
    color: TEXT_SECONDARY,
    fontFamily: 'Manrope-Regular',
    lineHeight: 24,
    marginBottom: 32,
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  inputIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: TEXT_PRIMARY,
    fontFamily: 'Manrope-Regular',
  },
  inputContainerError: {
    borderWidth: 2,
    borderColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOpacity: 0.2,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    marginTop: -12,
    marginBottom: 16,
    marginLeft: 4,
  },
  ctaButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 24,
    shadowColor: ELECTRIC_BLUE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Lexend-Bold',
    letterSpacing: 0.3,
  },
  ctaButtonDisabled: {
    opacity: 1,
  },
  buttonDisabled: {
    backgroundColor: '#E5E7EB',
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 16,
  },
  buttonTextDisabled: {
    fontSize: 17,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    fontFamily: 'Manrope-Regular',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  loginText: {
    color: TEXT_SECONDARY,
    fontFamily: 'Manrope-Regular',
  },
  loginLink: {
    color: ELECTRIC_BLUE,
    fontWeight: '600',
    fontFamily: 'Manrope-Regular',
  },
});

export default SignupScreen; 