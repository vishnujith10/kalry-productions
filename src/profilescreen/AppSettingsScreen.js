import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import supabase from '../lib/supabase';

const COLORS = {
  primary: '#7C3AED',
  primaryLight: '#A084E8',
  background: '#E8E9F0',
  surface: '#FFFFFF',
  text: '#181A20',
  textSecondary: '#666666',
  textMuted: '#999999',
  border: '#E5E7EB',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
};

const AppSettingsScreen = () => {
  const navigation = useNavigation();
  
  // Notifications State
  const [dailyReminders, setDailyReminders] = useState(true);
  const [mealReminders, setMealReminders] = useState(true);
  const [workoutReminders, setWorkoutReminders] = useState(true);
  const [sleepReminders, setSleepReminders] = useState(false);
  
  // AI Insights State
  const [aiInsights, setAiInsights] = useState(true);
  const [insightFrequency, setInsightFrequency] = useState('Weekly');
  const [focusAreas, setFocusAreas] = useState({
    calories: true,
    sleep: true,
    workout: true,
    Hydration: false,
  });
  
  // Privacy & Data State
  const [anonymousDataSharing, setAnonymousDataSharing] = useState(true);
  
  // General State
  const [language, setLanguage] = useState('English');

  const handleFocusAreaToggle = (area) => {
    setFocusAreas(prev => ({
      ...prev,
      [area]: !prev[area]
    }));
  };

  const handleDataExport = () => {
    // TODO: Implement data export functionality
    console.log('Exporting data...');
  };

  const handleClearHistory = () => {
    // TODO: Implement clear history functionality
    console.log('Clearing history...');
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.auth.signOut();
              if (error) {
                Alert.alert('Error', 'Failed to logout. Please try again.');
                console.error('Logout error:', error);
              } else {
                // Navigate to login screen
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                });
              }
            } catch (error) {
              Alert.alert('Error', 'An unexpected error occurred.');
              console.error('Logout error:', error);
            }
          },
        },
      ]
    );
  };

  const renderSection = (title, children) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );

  const renderToggleItem = (label, value, onValueChange, subtitle = null) => (
    <View style={styles.settingItem}>
      <View style={styles.settingLeft}>
        <Text style={styles.settingLabel}>{label}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#E5E7EB', true: COLORS.primaryLight }}
        thumbColor={value ? COLORS.primary : '#FFFFFF'}
        ios_backgroundColor="#E5E7EB"
      />
    </View>
  );

  const renderPillButton = (label, isSelected, onPress) => (
    <TouchableOpacity
      style={[
        styles.pillButton,
        isSelected ? styles.pillButtonSelected : styles.pillButtonUnselected
      ]}
      onPress={onPress}
    >
      <Text style={[
        styles.pillButtonText,
        isSelected ? styles.pillButtonTextSelected : styles.pillButtonTextUnselected
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderPillGroup = (options, selectedValue, onSelect) => (
    <View style={styles.pillGroup}>
      {options.map((option) => (
        <TouchableOpacity
          key={option}
          style={[
            styles.pillButton,
            selectedValue === option ? styles.pillButtonSelected : styles.pillButtonUnselected
          ]}
          onPress={() => onSelect(option)}
        >
          <Text style={[
            styles.pillButtonText,
            selectedValue === option ? styles.pillButtonTextSelected : styles.pillButtonTextUnselected
          ]}>
            {option}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>App Settings</Text>
            <View style={styles.headerSpacer} />
          </View>
          
          {/* Notifications Section */}
          {renderSection('Notifications', (
            <View style={styles.sectionContent}>
              {renderToggleItem('Daily Reminders', dailyReminders, setDailyReminders)}
              {renderToggleItem('Meal Reminders', mealReminders, setMealReminders, '08:00 AM')}
              {renderToggleItem('Workout Reminders', workoutReminders, setWorkoutReminders, '05:30 PM')}
              {renderToggleItem('Sleep Reminders', sleepReminders, setSleepReminders, '10:00 PM')}
            </View>
          ))}

          {/* AI Insights Section */}
          {renderSection('AI Insights', (
            <View style={styles.sectionContent}>
              {renderToggleItem('Enable AI Insights', aiInsights, setAiInsights)}
              
              <View style={styles.infoRow}>
                <Ionicons name="information-circle-outline" size={16} color={COLORS.textMuted} />
                <Text style={styles.infoText}>AI insights help you reflect and optimize your routine.</Text>
              </View>

              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>Insight Frequency</Text>
                {renderPillGroup(['Daily', 'Weekly', 'On Request'], insightFrequency, setInsightFrequency)}
              </View>

              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>Focus Areas</Text>
                <View style={styles.pillGroup}>
                  {Object.entries(focusAreas).map(([area, isSelected]) => (
                    <TouchableOpacity
                      key={area}
                      style={[
                        styles.pillButton,
                        isSelected ? styles.pillButtonSelected : styles.pillButtonUnselected
                      ]}
                      onPress={() => handleFocusAreaToggle(area)}
                    >
                      <Text style={[
                        styles.pillButtonText,
                        isSelected ? styles.pillButtonTextSelected : styles.pillButtonTextUnselected
                      ]}>
                        {area.charAt(0).toUpperCase() + area.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          ))}

          {/* Privacy & Data Section */}
          {renderSection('Privacy & Data', (
            <View style={styles.sectionContent}>
              {renderToggleItem('Anonymous Data Sharing', anonymousDataSharing, setAnonymousDataSharing)}
              
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <Text style={styles.settingLabel}>Data Export</Text>
                  <Text style={styles.settingSubtitle}>Last export: 2 days ago</Text>
                </View>
                <TouchableOpacity style={styles.exportButton} onPress={handleDataExport}>
                  <Text style={styles.exportButtonText}>Export CSV</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <Text style={styles.settingLabel}>Clear History</Text>
                </View>
                <TouchableOpacity style={styles.clearButton} onPress={handleClearHistory}>
                  <Text style={styles.clearButtonText}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* General Section */}
          {renderSection('General', (
            <View style={styles.sectionContent}>
              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>Language</Text>
                {renderPillGroup(['English', 'Español'], language, setLanguage)}
              </View>
              
              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
                <Text style={styles.logoutButtonText}>Logout</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Kalry App v2.1.0</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: 0,
    paddingHorizontal: 0,
    paddingBottom: 20,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  sectionContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingLeft: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  settingSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginLeft: 8,
    flex: 1,
  },
  subsection: {
    marginTop: 16,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 12,
  },
  pillGroup: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pillButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pillButtonUnselected: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
  },
  pillButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  pillButtonTextSelected: {
    color: COLORS.surface,
  },
  pillButtonTextUnselected: {
    color: COLORS.textSecondary,
  },
  exportButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  exportButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  clearButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.error,
  },
  logoutButton: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.error,
    marginVertical: 8,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.error,
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 20,
  },
  footerText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
});

export default AppSettingsScreen;
