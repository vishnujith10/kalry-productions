// StepTrackerScreen.js
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Animated, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import supabase from '../lib/supabase';
import { getDailyGoal, setDailyGoal } from '../utils/goalStorage';
import useTodaySteps from '../utils/useTodaySteps';

// Global cache for StepTrackerScreen
const globalStepCache = {
  cachedWeeklyData: null,
  cachedStats: null,
  timestamp: null,
  isStale: false,
  CACHE_DURATION: 5000, // 5 seconds
};

const StepTrackerScreen = ({ navigation }) => {
  const [userId, setUserId] = useState(null);
  const [goal, setGoal] = useState(10000);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [newGoal, setNewGoal] = useState(10000);
  const [weeklyStepsData, setWeeklyStepsData] = useState(() => globalStepCache.cachedWeeklyData?.weeklySteps || {});
  const [weeklyGoalsData, setWeeklyGoalsData] = useState(() => globalStepCache.cachedWeeklyData?.weeklyGoals || {});
  const [lastWeekAverage, setLastWeekAverage] = useState(() => globalStepCache.cachedStats?.lastWeekAvg || 0);
  const [thisWeekAverage, setThisWeekAverage] = useState(() => globalStepCache.cachedStats?.thisWeekAvg || 0);
  const [goalConsistency, setGoalConsistency] = useState(() => globalStepCache.cachedStats?.consistency || 0);
  const [isFetching, setIsFetching] = useState(false);
  
  // Step counter hook
  const { 
    stepsToday, 
    distanceKm, 
    calories, 
    saveGoalToDatabase,
    loadGoalFromDatabase
  } = useTodaySteps();

  // Helper functions for week management
  const getTodayIndex = () => {
    const day = new Date().getDay();
    return day === 0 ? 6 : day - 1; // Convert Sunday (0) to index 6, others to index-1
  };

  const getWeekStartDate = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    return monday.toISOString().split('T')[0];
  };

  const getCurrentWeekDates = () => {
    const weekStart = new Date(getWeekStartDate());
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  };

  const todayIndex = getTodayIndex();

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

  // Get last week dates
  const getLastWeekDates = () => {
    const weekStart = new Date(getWeekStartDate());
    weekStart.setDate(weekStart.getDate() - 7); // Go back 7 days
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  };

  // Load weekly data from database with caching
  const loadWeeklyData = useCallback(async (userId) => {
    if (!userId || isFetching) return;
    
    setIsFetching(true);
    
    try {

      const thisWeekDates = getCurrentWeekDates();
      const lastWeekDates = getLastWeekDates();
      
      // Fetch both this week and last week data
      const { data, error } = await supabase
        .from('steps')
        .select('date, steps, goal')
        .eq('user_id', userId)
        .or(`date.in.(${[...thisWeekDates, ...lastWeekDates].join(',')})`);

      if (error) throw error;

      // Convert data to our weekly format
      const weeklySteps = {};
      const weeklyGoals = {};
      const lastWeekSteps = [];
      const thisWeekSteps = [];
      let daysMetGoal = 0;
      let totalDaysWithData = 0;
      
      data?.forEach(record => {
        // This week data
        const thisWeekIndex = thisWeekDates.indexOf(record.date);
        if (thisWeekIndex !== -1) {
          weeklySteps[thisWeekIndex] = record.steps || 0;
          weeklyGoals[thisWeekIndex] = record.goal || 10000;
          thisWeekSteps.push(record.steps || 0);
          
          // Check if goal was met
          if ((record.steps || 0) >= (record.goal || 10000)) {
            daysMetGoal++;
          }
          if (record.steps > 0 || record.goal) {
            totalDaysWithData++;
          }
        }
        
        // Last week data
        const lastWeekIndex = lastWeekDates.indexOf(record.date);
        if (lastWeekIndex !== -1) {
          lastWeekSteps.push(record.steps || 0);
        }
      });

      // Calculate averages
      const thisWeekSum = thisWeekSteps.reduce((sum, steps) => sum + steps, 0);
      const lastWeekSum = lastWeekSteps.reduce((sum, steps) => sum + steps, 0);
      
      const thisWeekAvg = thisWeekSteps.length > 0 ? Math.round(thisWeekSum / Math.max(thisWeekSteps.length, 1)) : 0;
      const lastWeekAvg = lastWeekSteps.length > 0 ? Math.round(lastWeekSum / Math.max(lastWeekSteps.length, 1)) : 0;
      
      // Calculate goal consistency (percentage of days goal was met)
      const consistency = totalDaysWithData > 0 ? Math.round((daysMetGoal / totalDaysWithData) * 100) : 0;

      // Update cache
      globalStepCache.cachedWeeklyData = { weeklySteps, weeklyGoals };
      globalStepCache.cachedStats = { lastWeekAvg, thisWeekAvg, consistency };
      globalStepCache.timestamp = Date.now();
      globalStepCache.isStale = false;

      setWeeklyStepsData(weeklySteps);
      setWeeklyGoalsData(weeklyGoals);
      setLastWeekAverage(lastWeekAvg);
      setThisWeekAverage(thisWeekAvg);
      setGoalConsistency(consistency);
    } catch (error) {
      console.error('Error loading weekly data:', error);
    } finally {
      setIsFetching(false);
    }
  }, [isFetching]);

  // FIXED: useFocusEffect for cache-aware data loading (like SleepTrackerScreen)
  useFocusEffect(
    useCallback(() => {
    if (!userId) return;
    
      const now = Date.now();
      const isCacheValid = globalStepCache.timestamp && 
        (now - globalStepCache.timestamp) < globalStepCache.CACHE_DURATION;

      // If cache is valid, use it and skip fetch
      if (isCacheValid && globalStepCache.cachedWeeklyData) {
        setWeeklyStepsData(globalStepCache.cachedWeeklyData.weeklySteps);
        setWeeklyGoalsData(globalStepCache.cachedWeeklyData.weeklyGoals);
        setLastWeekAverage(globalStepCache.cachedStats.lastWeekAvg);
        setThisWeekAverage(globalStepCache.cachedStats.thisWeekAvg);
        setGoalConsistency(globalStepCache.cachedStats.consistency);
        return;
      }

      // If stale cache exists, show it while fetching
      if (globalStepCache.isStale && globalStepCache.cachedWeeklyData) {
        setWeeklyStepsData(globalStepCache.cachedWeeklyData.weeklySteps);
        setWeeklyGoalsData(globalStepCache.cachedWeeklyData.weeklyGoals);
        setLastWeekAverage(globalStepCache.cachedStats.lastWeekAvg);
        setThisWeekAverage(globalStepCache.cachedStats.thisWeekAvg);
        setGoalConsistency(globalStepCache.cachedStats.consistency);
      }

      const loadData = async () => {
        try {
          // Load goal
          const dbGoal = await loadGoalFromDatabase();
          if (dbGoal) {
            setGoal(dbGoal);
          } else {
        const savedGoal = await getDailyGoal(userId);
        if (savedGoal) {
          setGoal(savedGoal);
              saveGoalToDatabase(savedGoal).catch(err => 
                console.log('Failed to save goal to DB:', err)
              );
            }
          }
          
          // Load weekly data
          await loadWeeklyData(userId);
        } catch (error) {
          console.error('Error loading data:', error);
        }
      };

      loadData();
    }, [userId])
  );

  const handleSaveGoal = useCallback(async () => {
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
        
        // Invalidate cache
        globalStepCache.isStale = true;
        
        // Then close modal and show success
        setTimeout(() => {
        setShowGoalModal(false);
          Alert.alert('Success', `Goal updated to ${newGoal.toLocaleString()} steps!`);
        }, 100);
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
      .catch((dbError) => {
        console.log('⚠️ Database save error (ignoring):', dbError.message || dbError);
      });
  }, [userId, newGoal, saveGoalToDatabase]);

  const openGoalModal = useCallback(() => {
    setNewGoal(goal);
    setShowGoalModal(true);
  }, [goal]);

  const percent = Math.min(Math.round((stepsToday / goal) * 100), 100);

  // Weekly data with dynamic today's progress - Memoized to prevent re-renders
  const weeklyData = useMemo(() => [
    { 
      day: 'M', 
      steps: todayIndex === 0 ? stepsToday : (weeklyStepsData[0] || 0), 
      isToday: todayIndex === 0,
      goalAchieved: todayIndex === 0 ? stepsToday >= goal : (weeklyStepsData[0] || 0) >= (weeklyGoalsData[0] || goal),
      dayGoal: todayIndex === 0 ? goal : (weeklyGoalsData[0] || goal)
    },
    { 
      day: 'T', 
      steps: todayIndex === 1 ? stepsToday : (weeklyStepsData[1] || 0), 
      isToday: todayIndex === 1,
      goalAchieved: todayIndex === 1 ? stepsToday >= goal : (weeklyStepsData[1] || 0) >= (weeklyGoalsData[1] || goal),
      dayGoal: todayIndex === 1 ? goal : (weeklyGoalsData[1] || goal)
    },
    { 
      day: 'W', 
      steps: todayIndex === 2 ? stepsToday : (weeklyStepsData[2] || 0), 
      isToday: todayIndex === 2,
      goalAchieved: todayIndex === 2 ? stepsToday >= goal : (weeklyStepsData[2] || 0) >= (weeklyGoalsData[2] || goal),
      dayGoal: todayIndex === 2 ? goal : (weeklyGoalsData[2] || goal)
    },
    { 
      day: 'T', 
      steps: todayIndex === 3 ? stepsToday : (weeklyStepsData[3] || 0), 
      isToday: todayIndex === 3,
      goalAchieved: todayIndex === 3 ? stepsToday >= goal : (weeklyStepsData[3] || 0) >= (weeklyGoalsData[3] || goal),
      dayGoal: todayIndex === 3 ? goal : (weeklyGoalsData[3] || goal)
    },
    { 
      day: 'F', 
      steps: todayIndex === 4 ? stepsToday : (weeklyStepsData[4] || 0), 
      isToday: todayIndex === 4,
      goalAchieved: todayIndex === 4 ? stepsToday >= goal : (weeklyStepsData[4] || 0) >= (weeklyGoalsData[4] || goal),
      dayGoal: todayIndex === 4 ? goal : (weeklyGoalsData[4] || goal)
    },
    { 
      day: 'S', 
      steps: todayIndex === 5 ? stepsToday : (weeklyStepsData[5] || 0), 
      isToday: todayIndex === 5,
      goalAchieved: todayIndex === 5 ? stepsToday >= goal : (weeklyStepsData[5] || 0) >= (weeklyGoalsData[5] || goal),
      dayGoal: todayIndex === 5 ? goal : (weeklyGoalsData[5] || goal)
    },
    { 
      day: 'S', 
      steps: todayIndex === 6 ? stepsToday : (weeklyStepsData[6] || 0), 
      isToday: todayIndex === 6,
      goalAchieved: todayIndex === 6 ? stepsToday >= goal : (weeklyStepsData[6] || 0) >= (weeklyGoalsData[6] || goal),
      dayGoal: todayIndex === 6 ? goal : (weeklyGoalsData[6] || goal)
    }
  ], [todayIndex, stepsToday, weeklyStepsData, weeklyGoalsData, goal]);

  const getBarHeight = useCallback((steps, dayGoal) => {
    const maxHeight = 120;
    const minHeight = 4; // Very small minimum
    
    if (steps === 0) {
      return minHeight;
    }
    
    const percentage = Math.min((steps / dayGoal) * 100, 100);
    // Add a multiplier to make small progress more visible
    const baseHeight = (percentage / 100) * maxHeight;
    // For small percentages, add extra height to make progress visible
    const boostedHeight = baseHeight < 20 ? baseHeight + (steps / dayGoal) * 30 : baseHeight;
    const calculatedHeight = Math.max(boostedHeight, minHeight);
    
    return calculatedHeight;
  }, []);

  // Animated Bar Component - Memoized for performance
  const AnimatedBar = React.memo(({ data }) => {
    const targetHeight = getBarHeight(data.steps, data.dayGoal);
    const targetColor = data.steps === 0 ? 0 : (data.goalAchieved ? 2 : 1);
    
    const [animatedHeight] = useState(new Animated.Value(targetHeight));
    const [animatedColor] = useState(new Animated.Value(targetColor));

    useEffect(() => {
      // Always animate to the target values
      Animated.timing(animatedHeight, {
        toValue: targetHeight,
        duration: 300,
        useNativeDriver: false,
      }).start();

      Animated.timing(animatedColor, {
        toValue: targetColor,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }, [data.steps, data.goalAchieved, data.dayGoal, targetHeight, targetColor, animatedHeight, animatedColor]);

    const backgroundColor = animatedColor.interpolate({
      inputRange: [0, 1, 2],
      outputRange: ['#e5e7eb', '#7B61FF', '#10b981']
    });

    return (
      <View style={styles.barColumn}>
        <Animated.View
          style={[
            styles.bar,
            {
              height: animatedHeight,
              backgroundColor: backgroundColor,
              borderRadius: 15,
            }
          ]}
        />
        <Text style={[
          styles.dayLabel, 
          { 
            fontWeight: data.isToday ? 'bold' : 'normal',
            color: data.isToday ? '#7B61FF' : '#6b7280'
          }
        ]}>
          {data.day}
        </Text>
      </View>
    );
  });
  
  AnimatedBar.displayName = 'AnimatedBar';

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
                <Text style={styles.overviewTitle}>Today&apos;s Steps</Text>
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

          {/* WEEKLY PROGRESS */}
          <View style={styles.weeklyCard}>
            <Text style={styles.weekTitle}>Weekly Progress</Text>
            <View style={styles.barChart}>
              {weeklyData.map((data, index) => (
                <AnimatedBar key={index} data={data} index={index} />
              ))}
            </View>
          </View>

          {/* HISTORY & COMPARISON */}
          <View style={styles.historyCard}>
            <Text style={styles.cardTitle}>History &amp; Comparison</Text>
            
            <View style={styles.historyRow}>
              <Text style={styles.historyLabel}>Last Week Average</Text>
              <Text style={styles.historyValue}>
                {lastWeekAverage.toLocaleString()} steps
              </Text>
            </View>

            <View style={styles.historyRow}>
              <Text style={styles.historyLabel}>This Week Average</Text>
              <Text style={styles.historyValue}>
                {thisWeekAverage.toLocaleString()} steps
                  </Text>
                </View>
            
            <View style={styles.historyRow}>
              <Text style={styles.historyLabel}>Goal Consistency</Text>
              <Text style={[styles.historyValue, styles.consistencyValue]}>
                {goalConsistency}%
                  </Text>
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
  weeklyCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  weekTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
    fontFamily: 'Lexend-Bold',
  },
  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginHorizontal: 2,
  },
  bar: {
    width: '100%',
    maxWidth: 36,
    marginBottom: 8,
    minHeight: 4, // Ensure minimum visibility
  },
  dayLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: 'Manrope-Regular',
    marginTop: 4,
  },
  historyCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  historyLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Manrope-Regular',
  },
  historyValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Lexend-SemiBold',
  },
  consistencyValue: {
    color: '#10b981',
  },
});

export default StepTrackerScreen;