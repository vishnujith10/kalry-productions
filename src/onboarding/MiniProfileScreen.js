import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useContext, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
const SUCCESS_GREEN = '#10B981';
const ENERGY_ORANGE = '#F97316';
const WARNING_YELLOW = '#F59E0B';

const genders = ['Male', 'Female'];

const MiniProfileScreen = () => {
  const navigation = useNavigation();
  const { setOnboardingData } = useContext(OnboardingContext);
  const [selectedGender, setSelectedGender] = useState('Male');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
  const [isMetric, setIsMetric] = useState(true);
  const [editingHeight, setEditingHeight] = useState('');
  const [editingWeight, setEditingWeight] = useState('');

  const handleHeightCmChange = (val) => {
    setEditingHeight('cm');
    setHeightCm(val);
    if (val && !isNaN(Number(val))) {
      setHeightFt((Number(val) / 30.48).toFixed(2));
    } else {
      setHeightFt('');
    }
    setEditingHeight('');
  };

  const handleHeightFtChange = (val) => {
    setEditingHeight('ft');
    setHeightFt(val);
    if (val && !isNaN(Number(val))) {
      setHeightCm((Number(val) * 30.48).toFixed(0));
    } else {
      setHeightCm('');
    }
    setEditingHeight('');
  };

  const handleWeightKgChange = (val) => {
    setEditingWeight('kg');
    setWeightKg(val);
    if (val && !isNaN(Number(val))) {
      setWeightLbs((Number(val) * 2.20462).toFixed(1));
    } else {
      setWeightLbs('');
    }
    setEditingWeight('');
  };

  const handleWeightLbsChange = (val) => {
    setEditingWeight('lbs');
    setWeightLbs(val);
    if (val && !isNaN(Number(val))) {
      setWeightKg((Number(val) / 2.20462).toFixed(1));
    } else {
      setWeightKg('');
    }
    setEditingWeight('');
  };

  const minHeightCm = 100;
  const minHeightFt = 3.3;
  const minWeightKg = 30;
  const minWeightLbs = 66;

  const allFieldsFilled =
    name.trim().length > 0 &&
    age.trim().length > 0 &&
    selectedGender.trim().length > 0 &&
    heightCm.trim().length > 0 &&
    heightFt.trim().length > 0 &&
    weightKg.trim().length > 0 &&
    weightLbs.trim().length > 0 &&
    !isNaN(Number(age)) &&
    !isNaN(Number(heightCm)) &&
    !isNaN(Number(heightFt)) &&
    !isNaN(Number(weightKg)) &&
    !isNaN(Number(weightLbs));

  const validHeight =
    Number(heightCm) >= minHeightCm && Number(heightFt) >= minHeightFt;
  const validWeight =
    Number(weightKg) >= minWeightKg && Number(weightLbs) >= minWeightLbs;

  const canShowBMI = allFieldsFilled && validHeight && validWeight;
  const canContinue = canShowBMI;

  let bmi = '';
  let bmiStatus = '';
  let bmiColor = '';
  let bmiGradient = [];

  if (canShowBMI) {
    const h = Number(heightCm) / 100;
    const w = Number(weightKg);
    if (h > 0) {
      bmi = (w / (h * h)).toFixed(1);
      const bmiNum = Number(bmi);
      if (bmiNum < 18.5) {
        bmiStatus = 'Underweight';
        bmiColor = ENERGY_ORANGE;
        bmiGradient = ['#FEE2E2', '#FECACA'];
      } else if (bmiNum >= 18.5 && bmiNum < 25) {
        bmiStatus = 'Healthy';
        bmiColor = SUCCESS_GREEN;
        bmiGradient = ['#D1FAE5', '#A7F3D0'];
      } else if (bmiNum >= 25 && bmiNum < 30) {
        bmiStatus = 'Overweight';
        bmiColor = WARNING_YELLOW;
        bmiGradient = ['#FEF3C7', '#FDE68A'];
      } else {
        bmiStatus = 'Obese';
        bmiColor = ENERGY_ORANGE;
        bmiGradient = ['#FEE2E2', '#FECACA'];
      }
    }
  }

  const handleContinue = async () => {
    setOnboardingData({
      name,
      age,
      gender: selectedGender,
      heightCm,
      heightFt,
      weightKg,
      weightLbs,
      isMetric,
      bmi,
    });

    try {
      await AsyncStorage.setItem('kalry_onboarding_weight', isMetric ? weightKg : weightLbs);
      await AsyncStorage.setItem('kalry_onboarding_height', isMetric ? heightCm : heightFt);
      await AsyncStorage.setItem('kalry_onboarding_unit', isMetric ? 'kg' : 'lbs');
    } catch (e) {
      console.warn('Failed to save onboarding weight/height to storage', e);
    }
    navigation.navigate('ReferralSource');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <View style={styles.backButtonCircle}>
            <Ionicons name="chevron-back" size={24} color={TEXT_PRIMARY} />
          </View>
        </TouchableOpacity>
        <Text style={styles.heading}>Personal Setup</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formWrap}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Name</Text>
            <View style={styles.inputCard}>
              <MaterialCommunityIcons name="account" size={20} color={TEXT_SECONDARY} />
              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                placeholderTextColor={TEXT_SECONDARY}
                value={name}
                onChangeText={setName}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Age</Text>
            <View style={styles.inputCard}>
              <MaterialCommunityIcons name="calendar" size={20} color={TEXT_SECONDARY} />
              <TextInput
                style={styles.input}
                placeholder="Enter your age"
                placeholderTextColor={TEXT_SECONDARY}
                value={age}
                onChangeText={setAge}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Gender</Text>
            <View style={styles.genderRow}>
              {genders.map(gender => (
                <TouchableOpacity
                  key={gender}
                  style={[
                    styles.genderButton,
                    selectedGender === gender && styles.genderButtonSelected
                  ]}
                  onPress={() => setSelectedGender(gender)}
                  activeOpacity={0.7}
                >
                  {selectedGender === gender ? (
                    <LinearGradient
                      colors={[ELECTRIC_BLUE, BRIGHT_CYAN]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.genderGradient}
                    >
                      <MaterialCommunityIcons 
                        name={gender === 'Male' ? 'gender-male' : 'gender-female'} 
                        size={20} 
                        color="#FFFFFF" 
                      />
                      <Text style={styles.genderTextSelected}>{gender}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.genderContent}>
                      <MaterialCommunityIcons 
                        name={gender === 'Male' ? 'gender-male' : 'gender-female'} 
                        size={20} 
                        color={TEXT_SECONDARY} 
                      />
                      <Text style={styles.genderText}>{gender}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.unitToggleContainer}>
            <TouchableOpacity
              style={[styles.unitToggle, isMetric && styles.unitToggleActive]}
              onPress={() => setIsMetric(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.unitToggleText, isMetric && styles.unitToggleTextActive]}>
                Metric
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.unitToggle, !isMetric && styles.unitToggleActive]}
              onPress={() => setIsMetric(false)}
              activeOpacity={0.7}
            >
              <Text style={[styles.unitToggleText, !isMetric && styles.unitToggleTextActive]}>
                Imperial
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.measurementsRow}>
            <View style={styles.measurementCard}>
              <Text style={styles.measurementLabel}>Height</Text>
              <View style={styles.measurementInputWrapper}>
                <TextInput
                  style={styles.measurementInput}
                  placeholder={isMetric ? "170" : "5.6"}
                  placeholderTextColor={TEXT_SECONDARY}
                  value={isMetric ? heightCm : heightFt}
                  onChangeText={isMetric ? handleHeightCmChange : handleHeightFtChange}
                  keyboardType="numeric"
                />
                <Text style={styles.measurementUnit}>{isMetric ? 'cm' : 'ft'}</Text>
              </View>
            </View>

            <View style={styles.measurementCard}>
              <Text style={styles.measurementLabel}>Weight</Text>
              <View style={styles.measurementInputWrapper}>
                <TextInput
                  style={styles.measurementInput}
                  placeholder={isMetric ? "70" : "154"}
                  placeholderTextColor={TEXT_SECONDARY}
                  value={isMetric ? weightKg : weightLbs}
                  onChangeText={isMetric ? handleWeightKgChange : handleWeightLbsChange}
                  keyboardType="numeric"
                />
                <Text style={styles.measurementUnit}>{isMetric ? 'kg' : 'lbs'}</Text>
              </View>
            </View>
          </View>

          {canShowBMI && (
            <View style={styles.bmiCard}>
              <LinearGradient
                colors={bmiGradient}
                style={styles.bmiGradient}
              >
                <View style={styles.bmiContent}>
                  <MaterialCommunityIcons name="heart-pulse" size={24} color={bmiColor} />
                  <View style={styles.bmiTextContent}>
                    <Text style={styles.bmiLabel}>Your BMI</Text>
                    <View style={styles.bmiValueRow}>
                      <Text style={[styles.bmiValue, { color: bmiColor }]}>{bmi}</Text>
                      <Text style={[styles.bmiStatus, { color: bmiColor }]}>• {bmiStatus}</Text>
                    </View>
                  </View>
                </View>
              </LinearGradient>
            </View>
          )}
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
              <Text style={styles.buttonText}>Continue</Text>
              <MaterialIcons name="arrow-forward" size={22} color="#FFFFFF" />
            </LinearGradient>
          ) : (
            <View style={styles.buttonDisabled}>
              <Text style={styles.buttonTextDisabled}>Complete all fields</Text>
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
    paddingTop: Platform.OS === 'android' ? 3 : 0,
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
  formWrap: {
    paddingHorizontal: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    color: TEXT_PRIMARY,
    fontWeight: '600',
    marginBottom: 10,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Manrope-Regular',
    color: TEXT_PRIMARY,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 12,
  },
  genderButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: CARD_BG,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  genderButtonSelected: {
    borderColor: ELECTRIC_BLUE,
  },
  genderGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  genderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  genderText: {
    fontSize: 15,
    fontFamily: 'Manrope-Regular',
    color: TEXT_SECONDARY,
    fontWeight: '600',
  },
  genderTextSelected: {
    fontSize: 15,
    fontFamily: 'Lexend-Bold',
    color: '#FFFFFF',
  },
  unitToggleContainer: {
    flexDirection: 'row',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 4,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  unitToggle: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  unitToggleActive: {
    backgroundColor: '#EEF2FF',
  },
  unitToggleText: {
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    color: TEXT_SECONDARY,
    fontWeight: '600',
  },
  unitToggleTextActive: {
    color: ELECTRIC_BLUE,
    fontFamily: 'Lexend-Bold',
  },
  measurementsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  measurementCard: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  measurementLabel: {
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
    color: TEXT_SECONDARY,
    fontWeight: '500',
    marginBottom: 12,
  },
  measurementInputWrapper: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  measurementInput: {
    fontSize: 28,
    fontFamily: 'Lexend-Bold',
    color: TEXT_PRIMARY,
    flex: 1,
    padding: 0,
  },
  measurementUnit: {
    fontSize: 16,
    fontFamily: 'Manrope-Regular',
    color: TEXT_SECONDARY,
    fontWeight: '600',
  },
  bmiCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 4,
  },
  bmiGradient: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  bmiContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  bmiTextContent: {
    flex: 1,
  },
  bmiLabel: {
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
    color: TEXT_SECONDARY,
    fontWeight: '500',
    marginBottom: 6,
  },
  bmiValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bmiValue: {
    fontSize: 24,
    fontFamily: 'Lexend-Bold',
    fontWeight: '700',
  },
  bmiStatus: {
    fontSize: 16,
    fontFamily: 'Manrope-Regular',
    fontWeight: '600',
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

export default MiniProfileScreen;