import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import supabase from '../lib/supabase';

const AuthLoadingScreen = ({ navigation }) => {
  useEffect(() => {
    const checkAuthAndOnboarding = async () => {
      // 1. Check Supabase auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigation.replace('Welcome');
        return;
      }
      // 2. Check onboarding status (from user_profile or AsyncStorage)
      // Try to get onboarding flag from AsyncStorage (fallback)
      let onboarded = false;
      try {
        const onboardedFlag = await AsyncStorage.getItem('onboarded');
        if (onboardedFlag === 'true') onboarded = true;
      } catch {}
      // If not found in AsyncStorage, try Supabase user_profile
      if (!onboarded) {
        const { data: profile } = await supabase
          .from('user_profile')
          .select('onboarded')
          .eq('id', session.user.id)
          .single();
        if (profile && profile.onboarded) onboarded = true;
      }
      if (onboarded) {
        navigation.replace('MainDashboard');
      } else {
        navigation.replace('Profile'); // First onboarding screen
      }
    };
    checkAuthAndOnboarding();
  }, [navigation]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#7B61FF" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
});

export default AuthLoadingScreen; 