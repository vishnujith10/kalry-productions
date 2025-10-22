import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import supabase from '../lib/supabase';

const PreferencesScreen = () => {
  const navigation = useNavigation();
  
  // State for units
  const [weightUnit, setWeightUnit] = useState('kg');
  const [heightUnit, setHeightUnit] = useState('cm');
  
  // State for meal reminders
  const [breakfastReminder, setBreakfastReminder] = useState(true);
  const [lunchReminder, setLunchReminder] = useState(true);
  const [dinnerReminder, setDinnerReminder] = useState(true);
  
  // State for workout reminders
  const [workoutReminder, setWorkoutReminder] = useState(true);
  
  // State for theme
  const [appTheme, setAppTheme] = useState('Light');
  
  // State for sleep reminders
  const [sleepReminder, setSleepReminder] = useState(false);
  
  useEffect(() => {
    fetchUserPreferences();
  }, []);

  // Conversion functions
  const convertWeight = (value, fromUnit, toUnit) => {
    if (fromUnit === toUnit) return value;
    if (fromUnit === 'kg' && toUnit === 'lbs') return (value * 2.20462).toFixed(1);
    if (fromUnit === 'lbs' && toUnit === 'kg') return (value / 2.20462).toFixed(1);
    return value;
  };

  const convertHeight = (value, fromUnit, toUnit) => {
    if (fromUnit === toUnit) return value;
    if (fromUnit === 'cm' && toUnit === 'ft') return (value / 30.48).toFixed(1);
    if (fromUnit === 'ft' && toUnit === 'cm') return (value * 30.48).toFixed(1);
    return value;
  };

  // No need for AsyncStorage - units are now saved in database during signup

  const fetchUserPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_profile')
        .select('weight_unit, height_unit')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user preferences:', error);
        return;
      }

      if (data) {
        // Use database values with fallback defaults
        setWeightUnit(data.weight_unit || 'kg');
        setHeightUnit(data.height_unit || 'cm');
      } else {
        // No database data, use defaults
        setWeightUnit('kg');
        setHeightUnit('cm');
      }
    } catch (error) {
      console.error('Error fetching user preferences:', error);
    }
  };

  const saveUnitPreference = async (unitType, value) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const updateData = {};
      updateData[unitType] = value;

      const { error } = await supabase
        .from('user_profile')
        .update(updateData)
        .eq('id', user.id);

      if (error) {
        console.error('Error saving unit preference:', error);
        Alert.alert('Error', 'Failed to save preference. Please try again.');
        return;
      }

      console.log(`${unitType} preference saved successfully`);
    } catch (error) {
      console.error('Error saving unit preference:', error);
      Alert.alert('Error', 'Failed to save preference. Please try again.');
    }
  };

  const handleWeightUnitChange = async (unit) => {
    const oldUnit = weightUnit;
    console.log(`Weight unit changing from ${oldUnit} to ${unit}`);
    setWeightUnit(unit);
    saveUnitPreference('weight_unit', unit);
    
    // Convert weight values in database
    await convertUserWeightValues(oldUnit, unit);
  };

  const handleHeightUnitChange = async (unit) => {
    const oldUnit = heightUnit;
    console.log(`Height unit changing from ${oldUnit} to ${unit}`);
    setHeightUnit(unit);
    saveUnitPreference('height_unit', unit);
    
    // Convert height values in database
    await convertUserHeightValues(oldUnit, unit);
  };

  const convertUserWeightValues = async (fromUnit, toUnit) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get current user profile
      const { data: profile } = await supabase
        .from('user_profile')
        .select('weight, target_weight')
        .eq('id', user.id)
        .single();

      if (profile) {
        const updates = {};
        
        // Convert current weight
        if (profile.weight) {
          const convertedWeight = convertWeight(Number(profile.weight), fromUnit, toUnit);
          console.log(`Converting weight: ${profile.weight} ${fromUnit} → ${convertedWeight} ${toUnit}`);
          updates.weight = convertedWeight;
        }
        
        // Convert target weight
        if (profile.target_weight) {
          const convertedTargetWeight = convertWeight(Number(profile.target_weight), fromUnit, toUnit);
          console.log(`Converting target weight: ${profile.target_weight} ${fromUnit} → ${convertedTargetWeight} ${toUnit}`);
          updates.target_weight = convertedTargetWeight;
        }

        // Update database with converted values
        if (Object.keys(updates).length > 0) {
          await supabase
            .from('user_profile')
            .update(updates)
            .eq('id', user.id);
          
          console.log('Weight values converted successfully');
        }

        // Also convert weight logs
        await convertWeightLogs(fromUnit, toUnit);
      }
    } catch (error) {
      console.error('Error converting weight values:', error);
    }
  };

  const convertUserHeightValues = async (fromUnit, toUnit) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get current user profile
      const { data: profile } = await supabase
        .from('user_profile')
        .select('height')
        .eq('id', user.id)
        .single();

      if (profile && profile.height) {
        // Convert height
        const convertedHeight = convertHeight(Number(profile.height), fromUnit, toUnit);
        console.log(`Converting height: ${profile.height} ${fromUnit} → ${convertedHeight} ${toUnit}`);
        
        // Update database with converted value
        await supabase
          .from('user_profile')
          .update({ height: convertedHeight })
          .eq('id', user.id);
        
        console.log('Height value converted successfully');
      }
    } catch (error) {
      console.error('Error converting height values:', error);
    }
  };

  const convertWeightLogs = async (fromUnit, toUnit) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all weight logs for the user
      const { data: logs } = await supabase
        .from('weight_logs')
        .select('id, weight')
        .eq('user_id', user.id);

      if (logs && logs.length > 0) {
        // Convert each weight log
        for (const log of logs) {
          if (log.weight) {
            const convertedWeight = convertWeight(Number(log.weight), fromUnit, toUnit);
            await supabase
              .from('weight_logs')
              .update({ weight: convertedWeight })
              .eq('id', log.id);
          }
        }
        console.log('Weight logs converted successfully');
      }
    } catch (error) {
      console.error('Error converting weight logs:', error);
    }
  };
  
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#E8E9F0" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Preferences</Text>
          <Text style={styles.headerSubtitle}>Set your app experience to suit your routine.</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        
        {/* Units Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Units</Text>
          
          {/* Weight Units */}
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Weight Units</Text>
            <View style={styles.unitSelector}>
              <TouchableOpacity
                style={[styles.unitButton, weightUnit === 'kg' && styles.unitButtonActive]}
                onPress={() => handleWeightUnitChange('kg')}
              >
                <Text style={[styles.unitButtonText, weightUnit === 'kg' && styles.unitButtonTextActive]}>kg</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.unitButton, weightUnit === 'lbs' && styles.unitButtonActive]}
                onPress={() => handleWeightUnitChange('lbs')}
              >
                <Text style={[styles.unitButtonText, weightUnit === 'lbs' && styles.unitButtonTextActive]}>lbs</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Height Units */}
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Height Units</Text>
            <View style={styles.unitSelector}>
              <TouchableOpacity
                style={[styles.unitButton, heightUnit === 'cm' && styles.unitButtonActive]}
                onPress={() => handleHeightUnitChange('cm')}
              >
                <Text style={[styles.unitButtonText, heightUnit === 'cm' && styles.unitButtonTextActive]}>cm</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.unitButton, heightUnit === 'ft' && styles.unitButtonActive]}
                onPress={() => handleHeightUnitChange('ft')}
              >
                <Text style={[styles.unitButtonText, heightUnit === 'ft' && styles.unitButtonTextActive]}>ft</Text>
              </TouchableOpacity>
            </View>
          </View>
          
        </View>

        {/* Meal Reminders Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Meal Reminders</Text>
          
          <View style={styles.reminderRow}>
            <View style={styles.reminderInfo}>
              <Text style={styles.reminderLabel}>Breakfast</Text>
              <Text style={styles.reminderTime}>08:00 AM</Text>
            </View>
            <Switch
              value={breakfastReminder}
              onValueChange={setBreakfastReminder}
              trackColor={{ false: '#E5E5EA', true: '#7B61FF' }}
              thumbColor={breakfastReminder ? '#FFFFFF' : '#FFFFFF'}
            />
          </View>
          
          <View style={styles.reminderRow}>
            <View style={styles.reminderInfo}>
              <Text style={styles.reminderLabel}>Lunch</Text>
              <Text style={styles.reminderTime}>12:00 PM</Text>
            </View>
            <Switch
              value={lunchReminder}
              onValueChange={setLunchReminder}
              trackColor={{ false: '#E5E5EA', true: '#7B61FF' }}
              thumbColor={lunchReminder ? '#FFFFFF' : '#FFFFFF'}
            />
          </View>
          
          <View style={styles.reminderRow}>
            <View style={styles.reminderInfo}>
              <Text style={styles.reminderLabel}>Dinner</Text>
              <Text style={styles.reminderTime}>07:00 PM</Text>
            </View>
            <Switch
              value={dinnerReminder}
              onValueChange={setDinnerReminder}
              trackColor={{ false: '#E5E5EA', true: '#7B61FF' }}
              thumbColor={dinnerReminder ? '#FFFFFF' : '#FFFFFF'}
            />
          </View>
        </View>

        {/* Workout Reminders Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Workout Reminders</Text>
          
          <View style={styles.reminderRow}>
            <View style={styles.reminderInfo}>
              <Text style={styles.reminderText}>Next Workout Reminder: 7:00 AM</Text>
            </View>
            <Switch
              value={workoutReminder}
              onValueChange={setWorkoutReminder}
              trackColor={{ false: '#E5E5EA', true: '#7B61FF' }}
              thumbColor={workoutReminder ? '#FFFFFF' : '#FFFFFF'}
            />
          </View>
        </View>

        {/* Theme & Appearance Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Theme & Appearance</Text>
          
          {/* App Theme */}
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>App Theme</Text>
            <View style={styles.themeSelector}>
              <TouchableOpacity
                style={[styles.themeButton, appTheme === 'Light' && styles.themeButtonActive]}
                onPress={() => setAppTheme('Light')}
              >
                <Text style={[styles.themeButtonText, appTheme === 'Light' && styles.themeButtonTextActive]}>Light</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.themeButton, appTheme === 'Dark' && styles.themeButtonActive]}
                onPress={() => setAppTheme('Dark')}
              >
                <Text style={[styles.themeButtonText, appTheme === 'Dark' && styles.themeButtonTextActive]}>Dark</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          
        </View>

        {/* Sleep Reminders Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sleep Reminders</Text>
          
          <View style={styles.reminderRow}>
            <View style={styles.reminderInfo}>
              <Text style={styles.reminderLabel}>Bedtime: 10:00 PM</Text>
              <Text style={styles.reminderLabel}>Wake-up: 6:00 AM</Text>
            </View>
            <Switch
              value={sleepReminder}
              onValueChange={setSleepReminder}
              trackColor={{ false: '#E5E5EA', true: '#7B61FF' }}
              thumbColor={sleepReminder ? '#FFFFFF' : '#FFFFFF'}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8E9F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#E8E9F0',
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  settingRow: {
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  unitSelector: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 4,
  },
  unitButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  unitButtonActive: {
    backgroundColor: '#7B61FF',
  },
  unitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  unitButtonTextActive: {
    color: '#FFFFFF',
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  reminderInfo: {
    flex: 1,
  },
  reminderLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  reminderTime: {
    fontSize: 14,
    color: '#7B61FF',
    fontWeight: '500',
  },
  reminderText: {
    fontSize: 14,
    color: '#666',
  },
  themeSelector: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 4,
  },
  themeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  themeButtonActive: {
    backgroundColor: '#7B61FF',
  },
  themeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  themeButtonTextActive: {
    color: '#FFFFFF',
  },
});

export default PreferencesScreen;
