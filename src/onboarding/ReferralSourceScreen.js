import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useContext, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OnboardingContext } from '../context/OnboardingContext';

// Modern Fitness Light Mode Palette
const LIGHT_BG = '#F8F9FE';
const CARD_BG = '#FFFFFF';
const TEXT_PRIMARY = '#1A1D2E';
const TEXT_SECONDARY = '#6B7280';
const ELECTRIC_BLUE = '#2563EB';
const BRIGHT_CYAN = '#06B6D4';
const VIBRANT_PURPLE = '#7C3AED';

const options = [
  { label: 'Instagram', icon: 'instagram', gradient: ['#FECACA', '#FCA5A5'] },
  { label: 'TikTok', icon: 'music-note', gradient: ['#FDE68A', '#FCD34D'] },
  { label: 'YouTube', icon: 'play-circle', gradient: ['#FCA5A5', '#F87171'] },
  { label: 'Google Search', icon: 'search', gradient: ['#A7F3D0', '#6EE7B7'] },
  { label: 'App Store', icon: 'apps', gradient: ['#BFDBFE', '#93C5FD'] },
  { label: 'Friend / Referral', icon: 'people', gradient: ['#E9D5FF', '#D8B4FE'] },
  { label: 'Other', icon: 'edit', gradient: ['#FED7AA', '#FDBA74'] },
];

const saveOnboardingData = async (key, value) => {
  try {
    const existing = await AsyncStorage.getItem('onboardingData');
    const data = existing ? JSON.parse(existing) : {};
    data[key] = value;
    await AsyncStorage.setItem('onboardingData', JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save onboarding data', e);
  }
};

const ReferralSourceScreen = ({ navigation }) => {
  const { onboardingData, setOnboardingData } = useContext(OnboardingContext);
  const [selected, setSelected] = useState(null);
  const [otherText, setOtherText] = useState('');
  const inputRef = useRef(null);

  const isOtherSelected = selected === 6;
  const isContinueEnabled = (selected !== null && (!isOtherSelected || (isOtherSelected && otherText.trim().length > 0)));

  const handleOptionSelect = (idx) => {
    setSelected(idx);
    if (idx !== 6) setOtherText('');
  };

  const handleContinue = (selectedSource) => {
    setOnboardingData({
      ...onboardingData,
      social_refference: selectedSource,
    });
    navigation.navigate('ActivityLevel');
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <View style={styles.backButtonCircle}>
          <Ionicons name="chevron-back" size={24} color={TEXT_PRIMARY} />
        </View>
      </TouchableOpacity>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrapper}>
          <View style={styles.header}>
            <Text style={styles.subtitle}>ONE QUICK QUESTION</Text>
            <Text style={styles.title}>How did you{'\n'}hear about us?</Text>
            <Text style={styles.description}>
              Helps us grow and improve your experience
            </Text>
          </View>

          <View style={styles.optionsGrid}>
            {options.map((option, idx) => (
              <TouchableOpacity
                key={option.label}
                style={[
                  styles.optionCard,
                  selected === idx && styles.optionCardSelected
                ]}
                onPress={() => handleOptionSelect(idx)}
                activeOpacity={0.7}
              >
                <View style={styles.optionContent}>
                  <LinearGradient
                    colors={option.gradient}
                    style={styles.iconWrapper}
                  >
                    <MaterialIcons name={option.icon} size={24} color={TEXT_PRIMARY} />
                  </LinearGradient>
                  <Text style={styles.optionText}>{option.label}</Text>
                  {selected === idx ? (
                    <View style={styles.checkCircle}>
                      <MaterialIcons name="check" size={16} color="#FFFFFF" />
                    </View>
                  ) : (
                    <View style={styles.emptyCircle} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {isOtherSelected && (
            <View style={styles.otherInputCard}>
              <MaterialCommunityIcons name="pencil" size={20} color={TEXT_SECONDARY} />
              <TextInput
                ref={inputRef}
                style={styles.otherInput}
                placeholder="Tell us where you found Kalry..."
                value={otherText}
                onChangeText={setOtherText}
                autoFocus={true}
                placeholderTextColor={TEXT_SECONDARY}
              />
            </View>
          )}

          <View style={styles.infoCard}>
            <MaterialCommunityIcons name="shield-check" size={20} color={VIBRANT_PURPLE} />
            <Text style={styles.infoText}>
              We never share your data or use it for ads
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.ctaButton, !isContinueEnabled && styles.ctaButtonDisabled]}
          disabled={!isContinueEnabled}
          onPress={() => handleContinue(selected === 6 ? otherText.trim() : options[selected].label)}
          activeOpacity={0.85}
        >
          {isContinueEnabled ? (
            <LinearGradient
              colors={[ELECTRIC_BLUE, BRIGHT_CYAN]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>Continue</Text>
              <MaterialIcons name="arrow-forward" size={22} color="#FFFFFF" />
            </LinearGradient>
          ) : (
            <View style={styles.buttonDisabled}>
              <Text style={styles.buttonTextDisabled}>Select an option</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LIGHT_BG,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
  },
 
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 70,
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
    fontSize: 32,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    fontFamily: 'Lexend-Bold',
    letterSpacing: -0.5,
    marginBottom: 8,
    lineHeight: 38,
  },
  description: {
    fontSize: 16,
    color: TEXT_SECONDARY,
    fontFamily: 'Manrope-Regular',
    lineHeight: 24,
  },
  optionsGrid: {
    gap: 12,
    marginBottom: 20,
  },
  optionCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  optionCardSelected: {
    borderColor: ELECTRIC_BLUE,
    shadowColor: ELECTRIC_BLUE,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 14,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    fontFamily: 'Manrope-Regular',
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: ELECTRIC_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  otherInputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: ELECTRIC_BLUE,
    shadowColor: ELECTRIC_BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  otherInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Manrope-Regular',
    color: TEXT_PRIMARY,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: TEXT_PRIMARY,
    fontFamily: 'Manrope-Regular',
    fontWeight: '500',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: LIGHT_BG,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  ctaButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 12,
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
    paddingVertical: 18,
    alignItems: 'center',
    borderRadius: 16,
  },
  buttonTextDisabled: {
    fontSize: 17,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    fontFamily: 'Manrope-Regular',
  },
});

export default ReferralSourceScreen;