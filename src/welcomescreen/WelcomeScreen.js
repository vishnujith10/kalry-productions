import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PRIMARY = '#000000';
const SECONDARY = '#666666';
const BACKGROUND = '#ffffff';
const ACCENT = '#FAD89B';

const WelcomeScreen = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flexGrow}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.contentWrap}>
          <View style={styles.logoWrap}>
            <Image source={require('../../assets/logo/logo.png')} style={styles.logoImage} />
          </View>
          <Text style={styles.welcomeTitle}>Welcome to Kalry</Text>
          <Text style={styles.subtitle}>
            Your space to grow strong habits, gently — and with meaning.
          </Text>
          <Text style={styles.quote}>
            "You don't need intensity. You need consistency."
          </Text>
        </View>
        <View style={styles.bottomArea}>
          <TouchableOpacity style={styles.ctaButton} onPress={() => navigation.navigate('MiniProfile')}>
            <Text style={styles.ctaButtonText}>Begin My Journey →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.alreadyUserBtn} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.alreadyUserText}>Already a user?</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  flexGrow: {
    flex: 1,
    justifyContent: 'space-between',
  },
  contentWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  logoWrap: {
    backgroundColor: '#faf9f6',
    borderRadius: 40,
    padding: 32,
    marginBottom: 36,
    marginTop: 24,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  logoImage: {
    width: 170,
    height: 170,
    resizeMode: 'contain',
  },
  welcomeTitle: {
    fontSize: 32,
    fontFamily: 'Lexend-Bold',
    color: PRIMARY,
    textAlign: 'center',
    marginBottom: 18,
    marginTop: 8,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 17,
    fontFamily: 'Manrope-Regular',
    color: SECONDARY,
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 24,
  },
  quote: {
    fontSize: 16,
    fontFamily: 'Manrope-Regular',
    color: '#7b8794',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 36,
  },
  bottomArea: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 32,
    backgroundColor: 'transparent',
  },
  ctaButton: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
    marginBottom: 14,
    shadowColor: '#FAD89B',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  ctaButtonText: {
    color: PRIMARY,
    fontSize: 18,
    fontFamily: 'Lexend-Bold',
    fontWeight: '600',
  },
  alreadyUserBtn: {
    alignItems: 'center',
    marginTop: 0,
  },
  alreadyUserText: {
    color: '#8e8e93',
    fontSize: 16,
    fontFamily: 'Manrope-Regular',
    textDecorationLine: 'underline',
  },
});

export default WelcomeScreen; 