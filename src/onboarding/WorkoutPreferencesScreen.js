import { Feather, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useContext, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OnboardingContext } from '../context/OnboardingContext';

// Modern Fitness Light Mode Palette
const LIGHT_BG = '#F8F9FE';
const CARD_BG = '#FFFFFF';
const TEXT_PRIMARY = '#1A1D2E';
const TEXT_SECONDARY = '#6B7280';
const ELECTRIC_BLUE = '#2563EB';
const BRIGHT_CYAN = '#06B6D4';

const workoutOptions = [
  { 
    label: 'Strength', 
    icon: 'dumbbell',
    gradient: ['#FEE2E2', '#FECACA']
  },
  { 
    label: 'Yoga / Flexibility', 
    icon: 'yoga',
    gradient: ['#FEF3C7', '#FDE68A']
  },
  { 
    label: 'HIIT & Functional', 
    icon: 'fire',
    gradient: ['#D1FAE5', '#A7F3D0']
  },
  { 
    label: 'Running / Cardio', 
    icon: 'run-fast',
    gradient: ['#BFDBFE', '#93C5FD']
  },
  { 
    label: 'No Equipment / Home', 
    icon: 'home',
    gradient: ['#E9D5FF', '#D8B4FE']
  },
  { 
    label: 'Sports & Games', 
    icon: 'soccer',
    gradient: ['#FED7AA', '#FDBA74']
  },
  { 
    label: 'I\'m New to Working Out', 
    icon: 'user-plus',
    gradient: ['#F3E8FF', '#E9D5FF']
  },
  { 
    label: 'Not Sure Yet', 
    icon: 'help-outline',
    gradient: ['#F1F5F9', '#E2E8F0']
  },
];

const dayOptions = [1, 2, 3, 4, 5, 6, 7];
const timeOptions = [
  { 
    label: 'Morning', 
    sub: '6 AM – 9 AM', 
    icon: 'sunrise',
    gradient: ['#FEE2E2', '#FECACA']
  },
  { 
    label: 'Afternoon', 
    sub: '12 PM – 3 PM', 
    icon: 'sun',
    gradient: ['#FEF3C7', '#FDE68A']
  },
  { 
    label: 'Evening', 
    sub: '5 PM – 8 PM', 
    icon: 'moon',
    gradient: ['#D1FAE5', '#A7F3D0']
  },
  { 
    label: 'Night', 
    sub: 'After 8 PM', 
    icon: 'moon',
    gradient: ['#BFDBFE', '#93C5FD']
  },
  { 
    label: 'No Preference', 
    sub: 'I go with the flow', 
    icon: 'sunrise',
    gradient: ['#E9D5FF', '#D8B4FE']
  },
];

const WorkoutPreferencesScreen = ({ navigation }) => {
  const { onboardingData, setOnboardingData } = useContext(OnboardingContext);
  const [selectedWorkouts, setSelectedWorkouts] = useState([]);
  const [days, setDays] = useState(4);
  const [selectedTime, setSelectedTime] = useState([]);

  const toggleWorkout = (idx) => {
    setSelectedWorkouts((prev) =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const toggleTime = (idx) => {
    setSelectedTime((prev) =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const canContinue = selectedWorkouts.length > 0 && days > 0 && selectedTime.length > 0;

  const handleContinue = () => {
    setOnboardingData({
      ...onboardingData,
      prefered_workout: selectedWorkouts.map(idx => workoutOptions[idx].label),
      total_days_per_week: days,
      prefered_time: selectedTime.map(idx => timeOptions[idx].label),
    });
    navigation.navigate('GoalSummary');
  };

  // Summary string
  const summary = [
    selectedWorkouts.map(idx => workoutOptions[idx].label).join(', ') || '—',
    `${days} Day${days > 1 ? 's' : ''}`,
    selectedTime.map(idx => timeOptions[idx].label).join(', ') || '—',
  ].join(' | ');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <View style={styles.backButtonCircle}>
            <MaterialIcons name="arrow-back" size={24} color={TEXT_PRIMARY} />
          </View>
        </TouchableOpacity>
        <Text style={styles.heading}>Workout Preferences</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false} 
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.contentWrapper}>
          <View style={styles.header}>
            <Text style={styles.subtitle}>WORKOUT RHYTHM</Text>
            <Text style={styles.title}>Let&apos;s shape your{'\n'}workout rhythm</Text>
            <Text style={styles.description}>
              Choose what feels right. You can always change it later.
            </Text>
          </View>

          <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pick the ways you like to move</Text>
        <Text style={styles.sectionSub}>(You can select multiple — or skip)</Text>
        <View style={styles.workoutGrid}>
          {workoutOptions.map((option, idx) => {
            const selected = selectedWorkouts.includes(idx);
            return (
              <TouchableOpacity
                key={option.label}
                style={[styles.workoutCard, selected && styles.workoutCardSelected]}
                onPress={() => toggleWorkout(idx)}
                activeOpacity={0.85}
              >
                <LinearGradient
                      colors={option.gradient}
                  style={styles.workoutIconWrap}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                      {option.icon === 'dumbbell' && <MaterialCommunityIcons name="dumbbell" size={24} color={TEXT_PRIMARY} />}
                      {option.icon === 'yoga' && <MaterialCommunityIcons name="yoga" size={24} color={TEXT_PRIMARY} />}
                      {option.icon === 'fire' && <MaterialCommunityIcons name="fire" size={24} color={TEXT_PRIMARY} />}
                      {option.icon === 'run-fast' && <MaterialCommunityIcons name="run-fast" size={24} color={TEXT_PRIMARY} />}
                      {option.icon === 'home' && <MaterialIcons name="home" size={24} color={TEXT_PRIMARY} />}
                      {option.icon === 'soccer' && <MaterialCommunityIcons name="soccer" size={24} color={TEXT_PRIMARY} />}
                      {option.icon === 'user-plus' && <Feather name="user-plus" size={24} color={TEXT_PRIMARY} />}
                      {option.icon === 'help-outline' && <MaterialIcons name="help-outline" size={24} color={TEXT_PRIMARY} />}
                </LinearGradient>
                    <Text style={[styles.workoutCardLabel, selected && { color: TEXT_PRIMARY }]}>{option.label}</Text>
                    {selected && (
                      <View style={styles.checkCircle}>
                        <MaterialIcons name="check" size={16} color="#FFFFFF" />
                      </View>
                    )}
              </TouchableOpacity>
            );
          })}
            </View>
        </View>

          <View style={styles.section}>
        <Text style={styles.sectionTitle}>How many days per week would you like to be active?</Text>
        <View style={styles.daysRow}>
          {dayOptions.map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.dayCircle, days === d && styles.dayCircleSelected]}
              onPress={() => setDays(d)}
            >
              <Text style={[styles.dayCircleText, days === d && styles.dayCircleTextSelected]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.daysSub}>You selected {days} day{days > 1 ? 's' : ''} — sounds balanced!</Text>
          </View>

          <View style={styles.section}>
        <Text style={styles.sectionTitle}>When do you usually like to move?</Text>
        <View style={styles.timeGrid}>
          {timeOptions.map((option, idx) => {
            const selected = selectedTime.includes(idx);
            return (
              <TouchableOpacity
                key={option.label}
                style={[styles.timeCard, selected && styles.timeCardSelected]}
                onPress={() => toggleTime(idx)}
                activeOpacity={0.85}
              >
                    <LinearGradient
                      colors={option.gradient}
                      style={styles.timeIconWrap}
                    >
                      {option.icon === 'sunrise' && <Feather name="sunrise" size={20} color={TEXT_PRIMARY} />}
                      {option.icon === 'sun' && <Feather name="sun" size={20} color={TEXT_PRIMARY} />}
                      {option.icon === 'moon' && <Feather name="moon" size={20} color={TEXT_PRIMARY} />}
                    </LinearGradient>
                    <View style={styles.timeTextContent}>
                      <Text style={[styles.timeCardLabel, selected && { color: TEXT_PRIMARY }]}>{option.label}</Text>
                  <Text style={styles.timeCardSub}>{option.sub}</Text>
                </View>
                    {selected && (
                      <View style={styles.checkCircle}>
                        <MaterialIcons name="check" size={16} color="#FFFFFF" />
                      </View>
                    )}
              </TouchableOpacity>
            );
          })}
            </View>
        </View>

          <View style={styles.summaryCard}>
          <View style={styles.summaryRowCentered}>
              <MaterialIcons name="check-circle" size={22} color={TEXT_PRIMARY} style={{ marginRight: 8 }} />
            <Text style={styles.summaryText}>{summary}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.ctaButton, !canContinue && styles.ctaButtonDisabled]}
          disabled={!canContinue}
          onPress={handleContinue}
          activeOpacity={0.85}
        >
          {canContinue ? (
            <LinearGradient
              colors={[ELECTRIC_BLUE, BRIGHT_CYAN]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>Set My Workout Rhythm</Text>
              <MaterialIcons name="arrow-forward" size={22} color="#FFFFFF" />
          </LinearGradient>
          ) : (
            <View style={styles.buttonDisabled}>
              <Text style={styles.buttonTextDisabled}>Complete your preferences</Text>
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.ctaSub}>You can change any of this anytime</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: LIGHT_BG 
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
    paddingBottom: 100 
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: '600', 
    color: TEXT_PRIMARY, 
    marginBottom: 5, 
    fontFamily: 'Lexend-Bold' 
  },
  sectionSub: { 
    fontSize: 14, 
    color: TEXT_SECONDARY, 
    marginBottom: 16, 
    fontFamily: 'Manrope-Regular' 
  },
  workoutGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between', 
    gap: 12 
  },
  workoutCard: { 
    width: '48%', 
    aspectRatio: 1.1, 
    backgroundColor: CARD_BG, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  workoutCardSelected: { 
    borderColor: ELECTRIC_BLUE,
    shadowColor: ELECTRIC_BLUE,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  workoutIconWrap: { 
    width: 48, 
    height: 48, 
    borderRadius: 12, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 8 
  },
  workoutCardLabel: { 
    fontSize: 14, 
    color: TEXT_PRIMARY, 
    fontWeight: '600', 
    textAlign: 'center', 
    fontFamily: 'Manrope-Regular',
    lineHeight: 18,
  },
  checkCircle: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: ELECTRIC_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daysRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginTop: 16, 
    marginBottom: 16 
  },
  dayCircle: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#E5E7EB', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginHorizontal: 2 
  },
  dayCircleSelected: { 
    backgroundColor: ELECTRIC_BLUE 
  },
  dayCircleText: { 
    fontSize: 16, 
    color: TEXT_PRIMARY, 
    fontWeight: 'bold', 
    fontFamily: 'Lexend-Bold' 
  },
  dayCircleTextSelected: { 
    color: '#FFFFFF' 
  },
  daysSub: { 
    fontSize: 13, 
    color: TEXT_SECONDARY, 
    marginTop: 8, 
    fontFamily: 'Manrope-Regular' 
  },
  timeGrid: { 
    gap: 12 
  },
  timeCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: CARD_BG, 
    borderRadius: 16, 
    padding: 16, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  timeCardSelected: { 
    borderColor: ELECTRIC_BLUE,
    shadowColor: ELECTRIC_BLUE,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  timeIconWrap: { 
    width: 40, 
    height: 40, 
    borderRadius: 12, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 12 
  },
  timeTextContent: {
    flex: 1,
  },
  timeCardLabel: { 
    fontSize: 15, 
    color: TEXT_PRIMARY, 
    fontWeight: '600', 
    fontFamily: 'Manrope-Regular',
    marginBottom: 2,
  },
  timeCardSub: { 
    fontSize: 12, 
    color: TEXT_SECONDARY, 
    fontFamily: 'Manrope-Regular' 
  },
  summaryCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderRadius: 16, 
    marginTop: 16, 
    marginBottom: 25, 
    paddingVertical: 16, 
    paddingHorizontal: 20, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    backgroundColor: CARD_BG,
  },
  summaryRowCentered: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    flex: 1 
  },
  summaryText: { 
    color: TEXT_PRIMARY, 
    fontSize: 16, 
    fontWeight: '600', 
    fontFamily: 'Manrope-Regular', 
    textAlign: 'center', 
    flexShrink: 1 
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
  ctaSub: { 
    color: TEXT_SECONDARY, 
    fontSize: 12, 
    textAlign: 'center', 
    marginTop: 8, 
    fontFamily: 'Manrope-Regular' 
  },
});

export default WorkoutPreferencesScreen;