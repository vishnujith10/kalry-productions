import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PRIMARY = '#000000';
const SECONDARY = '#666666';
const BACKGROUND = '#ffffff';
const GRAY_LIGHT = '#f5f5f5';
const GRAY_MEDIUM = '#e0e0e0';

const workoutSpaces = [
  {
    label: 'Home',
    description: 'No equipment needed',
    icon: 'home',
  },
  {
    label: 'Gym',
    description: 'Full equipment access',
    icon: 'fitness-center',
  },
  {
    label: 'Outdoor',
    description: 'Open space workouts',
    icon: 'park',
  },
];

// Utility to save onboarding data
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

const WorkoutSpaceScreen = () => {
  const navigation = useNavigation();
  const [selected, setSelected] = useState([]);

  const toggleSelect = (idx) => {
    setSelected((prev) =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const handleContinue = async () => {
    // Save selected workout spaces (labels) to onboardingData
    const selectedLabels = selected.map(idx => workoutSpaces[idx].label);
    await saveOnboardingData('workoutSpaces', selectedLabels);
    navigation.navigate('GoalSummary');
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <MaterialIcons name="arrow-back" size={24} color={PRIMARY} />
      </TouchableOpacity>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.header, { fontFamily: 'Lexend-Bold' }]}>Workout Space</Text>
        <Text style={[styles.subheader, { fontFamily: 'Manrope-Regular' }]}>Where will you be working out?</Text>
        <View style={styles.cardsWrapper}>
          {workoutSpaces.map((item, idx) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.card, selected.includes(idx) && styles.cardSelected]}
              onPress={() => toggleSelect(idx)}
              activeOpacity={0.85}
            >
              <View style={styles.cardIconContainer}>
                <MaterialIcons name={item.icon} size={28} color={PRIMARY} />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, { fontFamily: 'Lexend-Bold' }]}>{item.label}</Text>
                <Text style={[styles.cardDescription, { fontFamily: 'Manrope-Regular' }]}>{item.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, selected.length === 0 && styles.buttonDisabled]}
          disabled={selected.length === 0}
          onPress={handleContinue}
        >
          <Text style={[styles.buttonText, { fontFamily: 'Lexend-Bold' }]}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    zIndex: 1,
  },
  scrollContent: {
    paddingTop: 120,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  header: {
    fontSize: 25,
    fontWeight: 'bold',
    color: PRIMARY,
    marginBottom: 4,
    textAlign: 'center',
  },
  subheader: {
    fontSize: 17,
    color: SECONDARY,
    marginBottom: 20,
    textAlign: 'center',
  },
  cardsWrapper: {
    width: '100%',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BACKGROUND,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GRAY_MEDIUM,
    padding: 16,
    marginBottom: 12,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardSelected: {
    backgroundColor: GRAY_LIGHT,
    borderColor: PRIMARY,
  },
  cardIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: GRAY_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: PRIMARY,
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: SECONDARY,
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  button: {
    backgroundColor: PRIMARY,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  buttonDisabled: {
    backgroundColor: GRAY_MEDIUM,
  },
  buttonText: {
    color: BACKGROUND,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default WorkoutSpaceScreen; 