// StepTrackerScreen.js
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import supabase from '../lib/supabase';
import { getDailyGoal, setDailyGoal } from '../utils/goalStorage';
import useTodaySteps from '../utils/useTodaySteps';

const StepTrackerScreen = ({ navigation }) => {
  const [userId, setUserId] = useState(null);
  const [goal, setGoal] = useState(10000);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [newGoal, setNewGoal] = useState(10000);
  
  // Step counter hook
  const { 
    stepsToday, 
    distanceKm, 
    calories,
    saveGoalToDatabase,
    loadGoalFromDatabase
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

  // Load user's daily goal from database
  useEffect(() => {
    if (!userId) return;
    
    const loadGoal = async () => {
      try {
        // Try loading from database first
        const dbGoal = await loadGoalFromDatabase();
        if (dbGoal) {
          console.log('Loaded goal from database:', dbGoal);
          setGoal(dbGoal);
        } else {
          // Fallback to AsyncStorage if not in database
          const savedGoal = await getDailyGoal(userId);
          if (savedGoal) {
            setGoal(savedGoal);
            // Save to database for future
            saveGoalToDatabase(savedGoal).catch(err => 
              console.log('Failed to save goal to DB:', err)
            );
          }
        }
      } catch (error) {
        console.error('Error loading goal:', error);
      }
    };
    
    loadGoal();
  }, [userId]); // Only depend on userId, not the functions

  const handleSaveGoal = async () => {
    if (!userId) {
      Alert.alert('Error', 'No user ID found');
      return;
    }
    
    // Save to AsyncStorage first (always works, immediate)
    try {
      const localSuccess = await setDailyGoal(userId, newGoal);
      
      if (localSuccess) {
        // Update UI state FIRST
        setGoal(newGoal);
        console.log('✅ Goal updated in UI:', newGoal);
        
        // Then close modal and show success
        setTimeout(() => {
          setShowGoalModal(false);
          Alert.alert('Success', `Goal updated to ${newGoal.toLocaleString()} steps!`);
        }, 100);
        
        console.log('✅ Goal saved locally:', newGoal);
      } else {
        Alert.alert('Error', 'Failed to save goal locally. Please try again.');
        return;
      }
    } catch (localError) {
      console.error('Error saving goal locally:', localError);
      Alert.alert('Error', 'Failed to save goal. Please try again.');
      return;
    }
    
    // Try to save to database in background (don't block UI)
    saveGoalToDatabase(newGoal)
      .then((success) => {
        if (success) {
          console.log('✅ Goal saved to database:', newGoal);
        } else {
          console.log('⚠️ Database save failed (local save succeeded)');
        }
      })
      .catch((dbError) => {
        console.log('⚠️ Database save error (ignoring):', dbError.message || dbError);
      });
  };

  const openGoalModal = () => {
    setNewGoal(goal);
    setShowGoalModal(true);
  };

  const percent = Math.min(Math.round((stepsToday / goal) * 100), 100);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header - FIXED ICON NAME */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Step Counter</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
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
                {[5000, 7500, 10000, 13000, 15000].map(opt => (
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