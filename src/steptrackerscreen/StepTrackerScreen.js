// StepTrackerScreen.js - FIXED ICON NAME
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import supabase from '../lib/supabase';
import { getDailyGoal, setDailyGoal } from '../utils/goalStorage';
import useTodaySteps from '../utils/useTodaySteps';

const StepTrackerScreen = ({ navigation }) => {
  const [userId, setUserId] = useState(null);
  const [goal, setGoal] = useState(10000);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [newGoal, setNewGoal] = useState(10000);
  
  // Enhanced hook with diagnostics
  const { 
    stepsToday, 
    isPedometerAvailable, 
    distanceKm, 
    calories, 
    error, 
    debugInfo,
    diagnostics,
    addTestSteps, 
    resetSteps,
    runFullDiagnostic
  } = useTodaySteps();

  // Get user ID
  useEffect(() => {
    const getUserId = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUserId(session?.user?.id || null);
      } catch (error) {
        console.error('Error getting user ID:', error);
      }
    };
    getUserId();
  }, []);

  // Load user's daily goal
  useEffect(() => {
    if (!userId) return;
    
    const loadGoal = async () => {
      try {
        const savedGoal = await getDailyGoal(userId);
        if (savedGoal) {
          setGoal(savedGoal);
        }
      } catch (error) {
        console.error('Error loading goal:', error);
      }
    };
    
    loadGoal();
  }, [userId]);

  const handleSaveGoal = async () => {
    if (!userId) {
      Alert.alert('Error', 'No user ID found');
      return;
    }
    
    try {
      const success = await setDailyGoal(userId, newGoal);
      if (success) {
        setGoal(newGoal);
        setShowGoalModal(false);
        Alert.alert('Success', 'Goal updated successfully!');
      } else {
        Alert.alert('Error', 'Failed to save goal. Please try again.');
      }
    } catch (error) {
      console.error('Error saving goal:', error);
      Alert.alert('Error', 'Failed to save goal. Please try again.');
    }
  };

  const openGoalModal = () => {
    setNewGoal(goal);
    setShowGoalModal(true);
  };

  const percent = Math.min(Math.round((stepsToday / goal) * 100), 100);

  // Open device settings
  const openDeviceSettings = () => {
    if (Platform.OS === 'android') {
      Linking.openSettings();
    } else {
      Alert.alert('Settings', 'Please go to Settings > Privacy & Security > Motion & Fitness and enable for this app');
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header - FIXED ICON NAME */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Step Counter Diagnostic</Text>
          <TouchableOpacity onPress={runFullDiagnostic}>
            <MaterialCommunityIcons name="stethoscope" size={24} color="#7B61FF" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* SIMPLIFIED DIAGNOSTIC PANEL */}
          <View style={styles.diagnosticCard}>
            <Text style={styles.diagnosticTitle}>🔍 Step Counter Diagnostics</Text>
            
            <View style={styles.diagnosticGrid}>
              <View style={styles.diagnosticItem}>
                <Text style={styles.diagnosticLabel}>Platform</Text>
                <Text style={styles.diagnosticValue}>{Platform.OS}</Text>
              </View>
              
              <View style={styles.diagnosticItem}>
                <Text style={styles.diagnosticLabel}>Pedometer Support</Text>
                <Text style={[styles.diagnosticValue, {color: diagnostics.pedometerSupported ? '#22C55E' : '#DC2626'}]}>
                  {diagnostics.pedometerSupported ? '✅ Yes' : '❌ No'}
                </Text>
              </View>
              
              <View style={styles.diagnosticItem}>
                <Text style={styles.diagnosticLabel}>Permissions</Text>
                <Text style={[styles.diagnosticValue, {color: diagnostics.permissionsGranted ? '#22C55E' : '#DC2626'}]}>
                  {diagnostics.permissionsGranted ? '✅ Granted' : '❌ Denied'}
                </Text>
              </View>
              
              <View style={styles.diagnosticItem}>
                <Text style={styles.diagnosticLabel}>Sensor Active</Text>
                <Text style={[styles.diagnosticValue, {color: diagnostics.sensorActive ? '#22C55E' : '#F59E0B'}]}>
                  {diagnostics.sensorActive ? '🟢 Active' : '🟡 Inactive'}
                </Text>
              </View>
              
              <View style={styles.diagnosticItem}>
                <Text style={styles.diagnosticLabel}>Total Events</Text>
                <Text style={[styles.diagnosticValue, {color: diagnostics.totalEvents > 0 ? '#22C55E' : '#DC2626'}]}>
                  {diagnostics.totalEvents}
                </Text>
              </View>
              
              <View style={styles.diagnosticItem}>
                <Text style={styles.diagnosticLabel}>Last Event</Text>
                <Text style={styles.diagnosticValue}>{diagnostics.lastEventTime || 'None'}</Text>
              </View>
            </View>

            <Text style={styles.statusText}>Status: {debugInfo}</Text>
            
            {error && (
              <Text style={styles.errorText}>Error: {error}</Text>
            )}
          </View>

          {/* STEP COUNTER DISPLAY */}
          <View style={styles.overviewCard}>
            <View style={styles.progressSection}>
              <View style={styles.circularProgress}>
                <View style={styles.progressRing}>
                  <View 
                    style={[
                      styles.progressArc, 
                      { 
                        transform: [{ rotate: `${-90 + (percent / 100) * 270}deg` }],
                        opacity: percent > 0 ? 1 : 0 
                      }
                    ]} 
                  />
                </View>
                <View style={styles.progressContent}>
                  <Text style={styles.stepsNumber}>
                    {stepsToday.toLocaleString()}
                  </Text>
                  <Text style={styles.stepsLabel}>steps</Text>
                </View>
              </View>
              
              <View style={styles.overviewText}>
                <Text style={styles.overviewTitle}>Today's Steps</Text>
                <Text style={styles.progressText}>
                  Progress: {percent}% of goal
                </Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${percent}%` }]} />
                </View>
                
                <Text style={styles.liveStatus}>
                  📡 {debugInfo}
                </Text>
              </View>
            </View>

            <View style={styles.quickStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{distanceKm.toFixed(2)} km</Text>
                <Text style={styles.statLabel}>Distance</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{calories.toFixed(0)} kcal</Text>
                <Text style={styles.statLabel}>Calories</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{goal.toLocaleString()}</Text>
                <Text style={styles.statLabel}>Goal</Text>
              </View>
            </View>
          </View>

          {/* TESTING & TROUBLESHOOTING */}
          <View style={styles.testingCard}>
            <Text style={styles.testingTitle}>🧪 Testing & Troubleshooting</Text>
            
            <View style={styles.testingButtons}>
              <TouchableOpacity 
                style={styles.testButton} 
                onPress={() => addTestSteps(1)}
              >
                <Text style={styles.testButtonText}>+1</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.testButton} 
                onPress={() => addTestSteps(10)}
              >
                <Text style={styles.testButtonText}>+10</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.testButton} 
                onPress={() => addTestSteps(100)}
              >
                <Text style={styles.testButtonText}>+100</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.testButton, {backgroundColor: '#DC2626'}]} 
                onPress={resetSteps}
              >
                <Text style={styles.testButtonText}>Reset</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.troubleshootingSection}>
              <Text style={styles.troubleshootingTitle}>📋 Walking Test Instructions:</Text>
              <Text style={styles.troubleshootingText}>1. Keep this app open and screen on</Text>
              <Text style={styles.troubleshootingText}>2. Hold phone naturally in your hand</Text>
              <Text style={styles.troubleshootingText}>3. Walk continuously for 30+ steps</Text>
              <Text style={styles.troubleshootingText}>4. Walk at normal pace (not too slow/fast)</Text>
              <Text style={styles.troubleshootingText}>5. Check console for "🎉 VALID STEP DETECTED"</Text>
              <Text style={styles.troubleshootingText}>6. Watch "Total Events" counter above</Text>

              {!diagnostics.pedometerSupported && (
                <TouchableOpacity style={styles.settingsButton} onPress={openDeviceSettings}>
                  <Text style={styles.settingsButtonText}>📱 Open Device Settings</Text>
                </TouchableOpacity>
              )}

              {diagnostics.totalEvents === 0 && diagnostics.pedometerSupported && (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>
                    ⚠️ No sensor events detected. Try:
                    {'\n'}• Restarting the app
                    {'\n'}• Checking device settings
                    {'\n'}• Walking with phone in different positions
                    {'\n'}• Use test buttons to verify UI works
                  </Text>
                </View>
              )}

              {diagnostics.totalEvents > 0 && stepsToday === 0 && (
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>
                    ℹ️ Sensor is working (events: {diagnostics.totalEvents}) but steps are filtered.
                    {'\n'}This means the sensor detects movement but it's not qualifying as "steps".
                    {'\n'}Try walking more consistently or use test buttons.
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* GOAL SETTING */}
          <View style={styles.goalCard}>
            <Text style={styles.cardTitle}>Set Your Daily Goal</Text>
            <Text style={styles.goalCurrentText}>Current Goal: {goal.toLocaleString()} steps</Text>
            
            <TouchableOpacity style={styles.setGoalButton} onPress={openGoalModal}>
              <Text style={styles.setGoalButtonText}>Set New Goal</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>

        {/* Goal Modal */}
        <Modal visible={showGoalModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Set Daily Step Goal</Text>
              
              <View style={styles.goalOptions}>
                {[5000, 7500, 10000, 12500, 15000].map(opt => (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => setNewGoal(opt)}
                    style={[
                      styles.goalOption,
                      newGoal === opt && styles.goalOptionSelected
                    ]}
                  >
                    <Text style={[
                      styles.goalOptionText,
                      newGoal === opt && styles.goalOptionTextSelected
                    ]}>
                      {(opt / 1000).toFixed(0)}k
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.customGoalInput}
                keyboardType="numeric"
                value={String(newGoal)}
                onChangeText={text => {
                  const num = Number(text.replace(/[^0-9]/g, ''));
                  if (num >= 0 && num <= 50000) {
                    setNewGoal(num);
                  }
                }}
                placeholder="Enter custom goal"
              />
              
              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]} 
                  onPress={() => setShowGoalModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.saveButton]} 
                  onPress={handleSaveGoal}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#F5F5F7',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Lexend-Bold',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  diagnosticCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  diagnosticTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 16,
    textAlign: 'center',
  },
  diagnosticGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  diagnosticItem: {
    width: '48%',
    marginBottom: 12,
  },
  diagnosticLabel: {
    fontSize: 12,
    color: '#92400E',
    marginBottom: 4,
  },
  diagnosticValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  statusText: {
    fontSize: 14,
    color: '#92400E',
    marginBottom: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    textAlign: 'center',
    backgroundColor: '#FEE2E2',
    padding: 8,
    borderRadius: 8,
  },
  overviewCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  circularProgress: {
    position: 'relative',
    width: 100,
    height: 100,
    marginRight: 24,
  },
  progressRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 8,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  progressArc: {
    position: 'absolute',
    top: -8,
    left: -8,
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 8,
    borderColor: 'transparent',
    borderTopColor: '#7B61FF',
    borderRightColor: '#7B61FF',
    borderBottomColor: '#7B61FF',
  },
  progressContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepsNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    fontFamily: 'Lexend-Bold',
    textAlign: 'center',
  },
  stepsLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
  },
  overviewText: {
    flex: 1,
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
    fontFamily: 'Lexend-Bold',
  },
  progressText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    fontFamily: 'Manrope-Regular',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#7B61FF',
    borderRadius: 4,
  },
  liveStatus: {
    fontSize: 12,
    color: '#059669',
    marginTop: 8,
    fontStyle: 'italic',
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    fontFamily: 'Lexend-Bold',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontFamily: 'Manrope-Regular',
  },
  testingCard: {
    backgroundColor: '#E0F2FE',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#0EA5E9',
  },
  testingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0C4A6E',
    marginBottom: 12,
    textAlign: 'center',
  },
  testingButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  testButton: {
    backgroundColor: '#0EA5E9',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  testButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  troubleshootingSection: {
    marginTop: 8,
  },
  troubleshootingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0C4A6E',
    marginBottom: 8,
  },
  troubleshootingText: {
    fontSize: 12,
    color: '#0C4A6E',
    marginBottom: 4,
  },
  settingsButton: {
    backgroundColor: '#7B61FF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 12,
    alignItems: 'center',
  },
  settingsButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  warningBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  warningText: {
    fontSize: 12,
    color: '#92400E',
  },
  infoBox: {
    backgroundColor: '#DBEAFE',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  infoText: {
    fontSize: 12,
    color: '#1E40AF',
  },
  goalCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
    fontFamily: 'Lexend-Bold',
  },
  goalCurrentText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    fontFamily: 'Manrope-Regular',
  },
  setGoalButton: {
    backgroundColor: '#7B61FF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  setGoalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Lexend-SemiBold',
  },
  // ... (keep existing modal styles)
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
    color: '#1F2937',
    fontFamily: 'Lexend-Bold',
  },
  goalOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  goalOption: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginHorizontal: 2,
    marginVertical: 4,
    minWidth: 60,
    alignItems: 'center',
  },
  goalOptionSelected: {
    backgroundColor: '#7B61FF',
  },
  goalOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    fontFamily: 'Lexend-Medium',
  },
  goalOptionTextSelected: {
    color: 'white',
  },
  customGoalInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 24,
    fontFamily: 'Manrope-Regular',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  saveButton: {
    backgroundColor: '#7B61FF',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'Lexend-Medium',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'Lexend-Medium',
  },
});

export default StepTrackerScreen;
