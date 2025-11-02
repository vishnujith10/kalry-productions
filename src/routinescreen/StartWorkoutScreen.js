import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Dimensions,
    Image,
    Keyboard,
    Modal,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { workoutAnalyticsService } from '../algorithms/WorkoutAnalyticsService';
import WorkoutFeedbackModal from '../components/WorkoutFeedbackModal';
import supabase from '../lib/supabase';
import { saveWorkout } from '../lib/workoutApi';

const { width, height } = Dimensions.get('window');

// Generate unique ID
const generateUniqueId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// Format time in MM:SS format
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Mask arbitrary user input to MM:SS (00:00) while typing
const formatTimeInput = (raw) => {
  // Remove all non-digits
  const digitsRaw = String(raw || '').replace(/\D/g, '').slice(0, 4);
  
  // If empty, return empty string (not formatted yet)
  if (!digitsRaw) return '';
  
  const len = digitsRaw.length;
  let minutes = '00';
  let seconds = '00';
  
  if (len === 1) {
    // User typed 1 digit: show as "0:0X"
    seconds = '0' + digitsRaw;
  } else if (len === 2) {
    // User typed 2 digits: show as "0:XX"
    seconds = digitsRaw;
  } else if (len === 3) {
    // User typed 3 digits: show as "X:XX"
    minutes = '0' + digitsRaw[0];
    seconds = digitsRaw.slice(1);
  } else {
    // User typed 4 digits: show as "XX:XX"
    minutes = digitsRaw.slice(0, 2);
    seconds = digitsRaw.slice(2);
  }
  
  // Validate seconds (0-59)
  let secNum = parseInt(seconds || '0', 10);
  if (Number.isNaN(secNum)) secNum = 0;
  secNum = Math.max(0, Math.min(59, secNum));
  seconds = secNum.toString().padStart(2, '0');
  
  // Validate minutes (0-99)
  let minNum = parseInt(minutes || '0', 10);
  if (Number.isNaN(minNum)) minNum = 0;
  minNum = Math.max(0, Math.min(99, minNum));
  minutes = minNum.toString().padStart(2, '0');
  
  return `${minutes}:${seconds}`;
};

// Determine exercise type based on name and category
const getExerciseType = (exercise) => {
  const name = (exercise.workout || exercise.name || '').toLowerCase();
  const category = (exercise.category || exercise.type || '').toLowerCase();
  
  // Cardio exercises that need KM and TIME
  const cardioExercises = [
    'running', 'jogging', 'elliptical', 'treadmill', 'cycling', 'bike', 'bicycle',
    'walking', 'hiking', 'swimming', 'rowing', 'stair', 'climbing'
  ];
  
  // Timer exercises that need timer functionality
  const timerExercises = [
    'battle ropes', 'rope', 'plank', 'wall sit', 'hold', 'isometric', 'static',
    'meditation', 'breathing', 'stretch', 'yoga', 'balance'
  ];
  
  // Check if it's a cardio exercise
  if (cardioExercises.some(cardio => name.includes(cardio)) || category.includes('cardio')) {
    return 'cardio';
  }
  
  // Check if it's a timer exercise
  if (timerExercises.some(timer => name.includes(timer)) || category.includes('timer')) {
    return 'timer';
  }
  
  // Default to strength
  return 'strength';
};

const COLORS = {
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  accent: '#8B5CF6',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  bg: '#F8FAFC',
  white: '#FFFFFF',
  text: '#1F2937',
  textSecondary: '#6B7280',
  textLight: '#9CA3AF',
  border: '#E5E7EB',
  shadow: '#000000',
};

export default function StartWorkoutScreen({ navigation, route }) {
  const [exercises, setExercises] = useState([]);
  const [workoutTime, setWorkoutTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [savingWorkout, setSavingWorkout] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [editingExerciseId, setEditingExerciseId] = useState(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [showMenuForExercise, setShowMenuForExercise] = useState(null); // Track which exercise menu is open
  const [activeTimers, setActiveTimers] = useState({}); // Track active timers for each set
  const [showTimerModal, setShowTimerModal] = useState(false); // Show timer modal
  const [isWorkoutPaused, setIsWorkoutPaused] = useState(false); // Track if workout is paused
  const [pausedTime, setPausedTime] = useState(0); // Track paused duration
  const [showFeedbackModal, setShowFeedbackModal] = useState(false); // Workout feedback modal
  const [workoutFeedback, setWorkoutFeedback] = useState(null); // Feedback data
  const [timeInputValues, setTimeInputValues] = useState({}); // Track raw time input values
  const timeInputRefs = useRef({}); // Refs for time inputs to manage cursor position
  const timeInputSelections = useRef({}); // Track cursor selection for time inputs
  const [timeInputSelectionsState, setTimeInputSelectionsState] = useState({}); // State for cursor positions
  
  const timerStartedRef = useRef(false);
  const workoutTimeRef = useRef(0);
  const previousExercisesRef = useRef([]);
  const intentionallyClearingRef = useRef(false);
  const setTimersRef = useRef({}); // Store timer intervals for each set

  // Get exercises from route params if available
  useEffect(() => {
    if (route.params?.exercises) {
      const routeExercises = route.params.exercises.map(ex => ({
        ...ex,
        id: generateUniqueId(),
        sets: [{ 
          id: generateUniqueId(), 
          weight: '', 
          reps: '', 
          distance: '',
          time: '00:00',
          completed: false 
        }]
      }));
      setExercises(routeExercises);
    }
  }, [route.params]);



  // Parse time from MM:SS format
  const parseTime = (timeString) => {
    if (!timeString || timeString === '00:00') return 0;
    const [mins, secs] = timeString.split(':').map(Number);
    return (mins * 60) + secs;
  };

  // Start timer for a specific set
  const startSetTimer = (exerciseId, setId) => {
    const timerKey = `${exerciseId}-${setId}`;
    
    // Clear existing timer if any
    if (setTimersRef.current[timerKey]) {
      clearInterval(setTimersRef.current[timerKey]);
    }
    
    // Start new timer
    setTimersRef.current[timerKey] = setInterval(() => {
      setActiveTimers(prev => ({
        ...prev,
        [timerKey]: (prev[timerKey] || 0) + 1
      }));
    }, 1000);
    
    setActiveTimers(prev => ({
      ...prev,
      [timerKey]: prev[timerKey] || 0
    }));
  };

  // Stop timer for a specific set
  const stopSetTimer = (exerciseId, setId) => {
    const timerKey = `${exerciseId}-${setId}`;
    
    if (setTimersRef.current[timerKey]) {
      clearInterval(setTimersRef.current[timerKey]);
      delete setTimersRef.current[timerKey];
    }
  };

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      Object.values(setTimersRef.current).forEach(clearInterval);
    };
  }, []);

  // Handle workout pause
  const pauseWorkout = () => {
    setIsWorkoutPaused(true);
    setIsRunning(false);
    setShowTimerModal(false);
  };

  // Handle workout resume
  const resumeWorkout = () => {
    setIsWorkoutPaused(false);
    setIsRunning(true);
    setShowTimerModal(false);
  };

  // Get formatted start time
  const getFormattedStartTime = () => {
    const now = new Date();
    return now.toLocaleDateString('en-US', { 
      year: 'numeric',
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true 
    });
  };


  // Timer functionality
  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        setWorkoutTime(time => {
          const newTime = time + 1;
          workoutTimeRef.current = newTime;
          return newTime;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  // Start workout timer only once
  useEffect(() => {
    if (!timerStartedRef.current) {
      setIsRunning(true);
      timerStartedRef.current = true;
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
    }
  }, []);

  // Keyboard event listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  const formatDate = () => {
    const today = new Date();
    const options = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    };
    return today.toLocaleDateString('en-US', options);
  };

  const formatStartTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getTotalStats = useMemo(() => {
    // Calculate calories based on exercise type, weight, and reps
    const totalKcal = exercises.reduce((sum, ex) => {
      const exerciseType = getExerciseType(ex);
      
      let exerciseCalories = 0;
      
      if (exerciseType === 'strength') {
        // For strength exercises, calculate based on weight and reps
        const totalWeightLifted = ex.sets.reduce((setSum, set) => {
          const weight = parseFloat(set.weight) || 0;
          const reps = parseInt(set.reps) || 0;
          return setSum + (weight * reps);
        }, 0);
        
        // More accurate calculation: 0.05 calories per kg lifted
        exerciseCalories = Math.round(totalWeightLifted * 0.05);
        
        // Minimum calories for any strength exercise (at least 2-3 calories)
        exerciseCalories = Math.max(exerciseCalories, 3);
        
      } else if (exerciseType === 'cardio') {
        // For cardio, use time-based calculation
        const durationMinutes = (workoutTime / exercises.length) / 60;
        exerciseCalories = Math.round(durationMinutes * 8);
        
      } else if (exerciseType === 'timer') {
        // For timer exercises, use time-based calculation
        const durationMinutes = (workoutTime / exercises.length) / 60;
        exerciseCalories = Math.round(durationMinutes * 3);
        
      } else {
        // Default calculation
        const durationMinutes = (workoutTime / exercises.length) / 60;
        exerciseCalories = Math.round(durationMinutes * 4);
      }
      
      return sum + exerciseCalories;
    }, 0);
    
    const totalWeight = exercises.reduce((sum, ex) => {
      if (getExerciseType(ex) === 'strength') {
        return sum + ex.sets.reduce((setSum, set) => setSum + ((set.weight || 0) * (set.reps || 0)), 0);
      }
      return sum;
    }, 0);
    const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
    
    return { totalKcal, totalWeight, totalSets };
  }, [exercises, workoutTime]);

  const addSet = (exerciseId) => {
    const exercise = exercises.find(ex => ex.id === exerciseId);
    const exerciseType = getExerciseType(exercise);
    
    const newSet = {
      id: generateUniqueId(),
      weight: '',
      reps: '',
      distance: '', // For cardio exercises (KM)
      time: '00:00', // For cardio and timer exercises
      completed: false,
    };
    
    setExercises(exercises.map(ex => 
      ex.id === exerciseId 
        ? { ...ex, sets: [...ex.sets, newSet] }
        : ex
    ));
  };

  const updateSet = (exerciseId, setId, field, value) => {
    setExercises(exercises.map(ex => 
      ex.id === exerciseId 
        ? { 
            ...ex, 
            sets: ex.sets.map(set => 
              set.id === setId ? { ...set, [field]: value } : set
            )
          }
        : ex
    ));
  };

  const toggleSetCompletion = (exerciseId, setId) => {
    setExercises(exercises.map(ex => 
      ex.id === exerciseId 
        ? { 
            ...ex, 
            sets: ex.sets.map(set => 
              set.id === setId ? { ...set, completed: !set.completed } : set
            )
          }
        : ex
    ));
  };

  const deleteSet = (exerciseId, setId) => {
    setExercises(exercises.map(ex => 
      ex.id === exerciseId 
        ? { 
            ...ex, 
            sets: ex.sets.length > 1 
              ? ex.sets.filter(set => set.id !== setId)
              : ex.sets // Keep at least one set
          }
        : ex
    ));
  };

  const removeExercise = (exerciseId) => {
    Alert.alert(
      'Remove Exercise',
      'Are you sure you want to remove this exercise from your workout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: () => {
            setExercises(exercises.filter(ex => ex.id !== exerciseId));
            setShowMenuForExercise(null);
          }
        }
      ]
    );
  };

  const handleEditExercise = (exerciseId) => {
    setEditingExerciseId(exerciseId);
    setShowMenuForExercise(null);
  };

  const deleteExercise = (exerciseId) => {
    Alert.alert(
      'Delete Exercise',
      'Are you sure you want to delete this exercise?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: () => {
            setExercises(exercises.filter(ex => ex.id !== exerciseId));
          }
        },
      ]
    );
  };

  async function handleFinishWorkout() {
    // Validation: Check if there are any exercises
    if (exercises.length === 0) {
      Alert.alert(
        'No Exercises Added',
        'Please add at least one exercise before finishing the workout.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Validation: Check if all exercises have at least one set with some data
    const hasIncompleteExercises = exercises.some(exercise => {
      if (exercise.sets.length === 0) return true;
      
      // Check if all sets are empty (no weight, reps, distance, or time filled)
      return exercise.sets.every(set => {
        const timerKey = `${exercise.id}-${set.id}`;
        const hasActiveTimer = activeTimers[timerKey] && activeTimers[timerKey] > 0;
        
        // Consider set complete if it has weight, reps, distance, time, or an active timer
        return !set.weight && !set.reps && !set.distance && (!set.time || set.time === '00:00') && !hasActiveTimer;
      });
    });

    if (hasIncompleteExercises) {
      Alert.alert(
        'Incomplete Exercise Details',
        'Please fill in at least one set with weight, reps, distance, or time for each exercise before finishing the workout.',
        [{ text: 'OK' }]
      );
      return;
    }

    setSavingWorkout(true);
    setSaveError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error('User not logged in');
      
      const preparedExercises = exercises.map(exercise => {
        const exerciseType = getExerciseType(exercise);
        
        // Calculate duration and calories for this specific exercise
        const durationSeconds = Math.round(workoutTime / exercises.length) || 0;
        let exerciseCalories = 0;
        
        if (exerciseType === 'strength') {
          // For strength exercises, calculate based on weight and reps
          const totalWeightLifted = exercise.sets.reduce((setSum, set) => {
            const weight = parseFloat(set.weight) || 0;
            const reps = parseInt(set.reps) || 0;
            return setSum + (weight * reps);
          }, 0);
          
          // More accurate calculation: 0.05 calories per kg lifted
          exerciseCalories = Math.round(totalWeightLifted * 0.05);
          
          // Minimum calories for any strength exercise (at least 2-3 calories)
          exerciseCalories = Math.max(exerciseCalories, 3);
          
        } else if (exerciseType === 'cardio') {
          // For cardio, use time-based calculation
          exerciseCalories = Math.round((durationSeconds / 60) * 8);
          
        } else if (exerciseType === 'timer') {
          // For timer exercises, use time-based calculation
          exerciseCalories = Math.round((durationSeconds / 60) * 3);
          
        } else {
          // Default calculation
          exerciseCalories = Math.round((durationSeconds / 60) * 4);
        }
        
        return {
          ...exercise,
          // Use original exercise ID if available, otherwise null
          id: typeof exercise.id === 'string' && exercise.id.length > 10 ? null : exercise.id,
          // Use calculated duration
          duration: durationSeconds,
          // Add calculated calories
          kcal: exerciseCalories,
          // Ensure we have exercise name and image URL
          name: exercise.name || exercise.workout || 'Unknown Exercise',
          gif_url: exercise.gif_url || exercise.image_url || null,
          sets: exercise.sets.map(set => {
            const timerKey = `${exercise.id}-${set.id}`;
            const timerValue = activeTimers[timerKey];
            
            // If there's an active timer value, use it for the time field
            const finalTime = timerValue && timerValue > 0 
              ? formatTime(timerValue) 
              : set.time;
            
            return {
              ...set,
              reps: set.reps ? parseInt(set.reps) || 0 : null,
              weight: set.weight ? parseFloat(set.weight) || 0 : null,
              time: finalTime !== '00:00' ? finalTime : null,
            };
          })
        };
      });
      
      const workout = await saveWorkout({
        userId,
        date: new Date().toISOString().slice(0,10),
        duration: workoutTime,
        totalKcal: getTotalStats.totalKcal,
        notes: 'Saved Routine',
        exercises: preparedExercises,
        isRoutine: true,
      });
      
      // Optimistic update - update MainDashboard cache immediately
      try {
        const { updateMainDashboardWorkoutCache } = require('../utils/cacheManager');
        updateMainDashboardWorkoutCache();
      } catch (error) {
        // Silent - cacheManager might not exist yet
      }
      
      // Update exercise streak (after completing workout)
      try {
        const { updateExerciseStreak } = require('../utils/streakService');
        await updateExerciseStreak(userId);
        console.log('✅ Exercise streak updated after completing routine workout');
      } catch (error) {
        console.error('Error updating exercise streak:', error);
      }
      
      // Generate workout analytics feedback
      try {
        await workoutAnalyticsService.initialize(userId);
        
        // Log the workout to analytics
        const muscleGroups = [...new Set(preparedExercises.map(ex => 
          ex.body_parts ? ex.body_parts.split(',')[0].trim() : 'full body'
        ))];
        
        await workoutAnalyticsService.logWorkout({
          exercises: preparedExercises,
          intensity: 'moderate', // Can be enhanced based on actual intensity
          duration: workoutTime / 60, // Convert to minutes
          date: new Date(),
          muscleGroups
        });
        
        // Get post-workout summary
        const feedback = await workoutAnalyticsService.getPostWorkoutSummary({
          exercises: preparedExercises,
          intensity: 'moderate',
          duration: workoutTime / 60,
          muscleGroups
        });
        
        // Debug logging (commented out to reduce log spam - uncomment if needed for debugging)
        // console.log('📊 Workout feedback:', {
        //   achievements: feedback?.achievements?.length || 0,
        //   warnings: feedback?.warnings?.length || 0,
        //   suggestions: feedback?.suggestions?.length || 0,
        //   hasContent: (feedback?.achievements?.length || 0) + (feedback?.warnings?.length || 0) + (feedback?.suggestions?.length || 0) > 0
        // });
        
        setWorkoutFeedback(feedback || {
          achievements: [],
          warnings: [],
          suggestions: [],
          workout: {
            exercises: preparedExercises.length,
            duration: workoutTime / 60,
            intensity: 'moderate'
          }
        });
        
        console.log('✅ Workout analytics generated');
      } catch (error) {
        console.error('Error generating workout analytics:', error);
        // Don't block the user if analytics fail
      }
      
      // Show alert first, then show summary modal after alert is dismissed
      Alert.alert(
        'Workout Completed!',
        `Great job! Your workout has been saved.\nDuration: ${formatTime(workoutTime)}\nCalories: ${getTotalStats.totalKcal} kcal`,
        [
          { 
            text: 'Ok', 
            onPress: () => {
              // Show summary modal after alert is dismissed
              setShowFeedbackModal(true);
            }
          },
        ]
      );
      
      intentionallyClearingRef.current = true;
      setExercises([]);
    } catch (e) {
      console.error('Error saving workout:', e);
      setSaveError(e.message || 'Failed to save workout.');
    } finally {
      setSavingWorkout(false);
    }
  }

  const handleDiscardWorkout = () => {
    Alert.alert(
      'Discard Workout',
      'Are you sure you want to discard this workout? All progress will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Discard', 
          style: 'destructive', 
          onPress: () => {
            intentionallyClearingRef.current = true;
            setExercises([]);
            setWorkoutTime(0);
            setIsRunning(false);
            timerStartedRef.current = false;
            workoutTimeRef.current = 0;
            navigation.navigate('Exercise');
          }
        },
      ]
    );
  };

  const { totalKcal, totalWeight, totalSets } = getTotalStats;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleDiscardWorkout}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Workout Session</Text>
          
          <TouchableOpacity 
            style={styles.endButton}
            onPress={handleFinishWorkout}
          >
            <Text style={styles.endButtonText}>Finish</Text>
          </TouchableOpacity>
        </View>
        
        <Text style={styles.dateText}>{formatDate()}</Text>
        
        <View style={styles.timerRow}>
          <View style={styles.timerIndicator}>
            <View style={styles.timerDot} />
            <Text style={styles.timerText}>Started {formatStartTime()}</Text>
          </View>
          <TouchableOpacity 
            style={styles.timerButton}
            onPress={() => setShowTimerModal(true)}
          >
            <Text style={styles.timerButtonText}>{formatTime(workoutTime)}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
          <Text style={styles.statLabel}>Today</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="flame-outline" size={20} color={COLORS.warning} />
          <Text style={styles.statLabel}>{totalKcal} kcal</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="time-outline" size={20} color={COLORS.success} />
          <Text style={styles.statLabel}>{formatTime(workoutTime)}</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="weight-kilogram" size={20} color={COLORS.accent} />
          <Text style={styles.statLabel}>{totalWeight} kg</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{totalSets}</Text>
        </View>
      </View>

      {/* Exercises List */}
      <TouchableWithoutFeedback onPress={() => setShowMenuForExercise(null)}>
      <ScrollView 
        style={styles.exercisesList}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.exercisesContent}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => Keyboard.dismiss()}
          scrollEventThrottle={16}
          bounces={true}
          alwaysBounceVertical={false}
        >
        {exercises.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons 
              name="dumbbell" 
              size={64} 
              color={COLORS.textLight} 
            />
            <Text style={styles.emptyStateTitle}>No Exercises Added</Text>
            <Text style={styles.emptyStateSubtitle}>
              Tap &quot;Add Exercise&quot; below to start building your workout
            </Text>
            
            {/* Add Exercise Button for Empty State */}
            <TouchableOpacity 
              style={styles.addExerciseButtonInline}
              onPress={() => {
                navigation.navigate('AllExercisesScreen', {
                  onExercisesSelected: (selectedExercises) => {
                    setExercises(prev => [
                      ...prev,
                      ...selectedExercises.map(ex => ({
                        ...ex,
                        id: generateUniqueId(),
                        sets: [{ 
                          id: generateUniqueId(), 
                          weight: '', 
                          reps: '', 
                          distance: '',
                          time: '00:00',
                          completed: false 
                        }]
                      }))
                    ]);
                  },
                  onSelect: (selectedExercise) => {
                    setExercises(prev => [
                      ...prev,
                      {
                        ...selectedExercise,
                        id: generateUniqueId(),
                        sets: [{ 
                          id: generateUniqueId(), 
                          weight: '', 
                          reps: '', 
                          distance: '',
                          time: '00:00',
                          completed: false 
                        }]
                      }
                    ]);
                  }
                });
              }}
            >
              <Ionicons name="add" size={20} color={COLORS.white} />
              <Text style={styles.addExerciseText}>Add Exercise</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
        {exercises.map((exercise) => (
          <View key={exercise.id} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <View style={styles.exerciseIconContainer}>
                  {exercise.gif_url ? (
                    <Image
                      source={{ uri: exercise.gif_url }}
                      style={styles.exerciseGifIcon}
                      resizeMode="cover"
                    />
                  ) : (
                <MaterialCommunityIcons 
                  name="dumbbell" 
                  size={24} 
                  color={COLORS.primary} 
                />
                  )}
              </View>
              <View style={styles.exerciseInfo}>
                  <Text style={styles.exerciseName}>{exercise.workout || exercise.name || 'Unnamed Exercise'}</Text>
                  <Text style={styles.exerciseMuscle}>{exercise.muscle || exercise.body_part || 'Exercise'}</Text>
              </View>
              <TouchableOpacity 
                  style={styles.moreButton}
                  onPress={() => setShowMenuForExercise(showMenuForExercise === exercise.id ? null : exercise.id)}
              >
                  <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

              {/* Three-dots menu */}
              {showMenuForExercise === exercise.id && (
                <View style={styles.menuOverlay}>
                  <View style={styles.menuContainer}>
                    {/* <TouchableOpacity 
                      style={styles.menuItem}
                      onPress={() => handleEditExercise(exercise.id)}
                    >
                      <Ionicons name="pencil" size={18} color={COLORS.primary} />
                      <Text style={styles.menuItemText}>Edit</Text>
                    </TouchableOpacity> */}
                    <TouchableOpacity 
                      style={styles.menuItem}
                      onPress={() => removeExercise(exercise.id)}
                    >
                      <Ionicons name="trash" size={18} color={COLORS.error} />
                      <Text style={[styles.menuItemText, { color: COLORS.error }]}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}


            {/* Sets */}
              {exercise.sets.map((set, index) => {
                const exerciseType = getExerciseType(exercise);
                const timerKey = `${exercise.id}-${set.id}`;
                const currentTime = activeTimers[timerKey] || 0;
                const displayTime = set.time === '00:00' && currentTime > 0 ? formatTime(currentTime) : set.time;
                
                return (
              <View key={set.id} style={styles.setRow}>
                <Text style={styles.setLabel}>Set {index + 1}</Text>
                <View style={styles.setInputs}>
                      {exerciseType === 'cardio' ? (
                        // Cardio: KM and TIME
                        <>
                          <TextInput
                            style={styles.setInput}
                            value={set.distance}
                            onChangeText={(text) => updateSet(exercise.id, set.id, 'distance', text)}
                            placeholder="0"
                            keyboardType="numeric"
                          />
                          <Text style={styles.setUnit}>KM</Text>
                          <Text style={styles.setSeparator}>•</Text>
                          <TextInput
                            ref={(ref) => {
                              const inputKey = `${exercise.id}-${set.id}`;
                              if (ref) timeInputRefs.current[inputKey] = ref;
                            }}
                            style={styles.setInput}
                            value={timeInputValues[`${exercise.id}-${set.id}`] !== undefined 
                              ? (() => {
                                  // Show raw digits WITHOUT colon while typing
                                  const digitsOnly = timeInputValues[`${exercise.id}-${set.id}`];
                                  return digitsOnly || '';
                                })()
                              : displayTime.replace(':', '')}
                            selection={timeInputSelectionsState[`${exercise.id}-${set.id}`]}
                            onChangeText={(text) => {
                              const inputKey = `${exercise.id}-${set.id}`;
                              // Remove all non-digits
                              const digitsOnly = text.replace(/\D/g, '').slice(0, 4); // Max 4 digits (MMSS)
                              
                              // Store raw input (digits only) - show raw digits while typing
                              setTimeInputValues(prev => ({
                                ...prev,
                                [inputKey]: digitsOnly
                              }));
                              
                              // Format and update the actual value (this is what gets saved)
                              if (digitsOnly.length >= 2) {
                                const formatted = formatTimeInput(digitsOnly);
                                updateSet(exercise.id, set.id, 'time', formatted);
                                
                                // Set cursor position to end of raw digits
                                const cursorPos = digitsOnly.length;
                                setTimeInputSelectionsState(prev => ({
                                  ...prev,
                                  [inputKey]: { start: cursorPos, end: cursorPos }
                                }));
                              } else if (digitsOnly.length === 0) {
                                updateSet(exercise.id, set.id, 'time', '');
                                setTimeInputSelectionsState(prev => {
                                  const newValues = { ...prev };
                                  delete newValues[inputKey];
                                  return newValues;
                                });
                              } else {
                                // For single digit, set cursor after it
                                setTimeInputSelectionsState(prev => ({
                                  ...prev,
                                  [inputKey]: { start: digitsOnly.length, end: digitsOnly.length }
                                }));
                              }
                            }}
                            onSelectionChange={(e) => {
                              // Extract selection immediately before event is released
                              const selection = e.nativeEvent?.selection;
                              if (!selection) return;
                              
                              const inputKey = `${exercise.id}-${set.id}`;
                              // Only update selection state if user manually changed it
                              if (timeInputValues[inputKey] !== undefined) {
                                const digitsOnly = timeInputValues[inputKey];
                                const cursorPos = selection.start;
                                // Only update if cursor is at a reasonable position
                                if (cursorPos <= digitsOnly.length) {
                                  setTimeInputSelectionsState(prev => ({
                                    ...prev,
                                    [inputKey]: { start: selection.start, end: selection.end }
                                  }));
                                }
                              }
                            }}
                            placeholder="0000"
                            keyboardType="number-pad"
                            onFocus={() => {
                              const inputKey = `${exercise.id}-${set.id}`;
                              if (set.time === '00:00' || set.time === '0:00') {
                                setTimeInputValues(prev => ({
                                  ...prev,
                                  [inputKey]: ''
                                }));
                                updateSet(exercise.id, set.id, 'time', '');
                                setTimeInputSelectionsState(prev => ({
                                  ...prev,
                                  [inputKey]: { start: 0, end: 0 }
                                }));
                              } else {
                                // Extract digits from current time
                                const digits = set.time.replace(/\D/g, '');
                                setTimeInputValues(prev => ({
                                  ...prev,
                                  [inputKey]: digits
                                }));
                                // Set cursor to end of raw digits
                                setTimeInputSelectionsState(prev => ({
                                  ...prev,
                                  [inputKey]: { start: digits.length, end: digits.length }
                                }));
                              }
                            }}
                            onBlur={() => {
                              const inputKey = `${exercise.id}-${set.id}`;
                              const digits = timeInputValues[inputKey] || set.time.replace(/\D/g, '');
                              
                              // Format and save the final value
                              if (!digits || digits === '') {
                                updateSet(exercise.id, set.id, 'time', '00:00');
                              } else {
                                const formatted = formatTimeInput(digits);
                                updateSet(exercise.id, set.id, 'time', formatted);
                              }
                              
                              // Clear raw input on blur (will show raw digits without colon)
                              setTimeInputValues(prev => {
                                const newValues = { ...prev };
                                delete newValues[inputKey];
                                return newValues;
                              });
                              
                              // Clear selection state
                              setTimeInputSelectionsState(prev => {
                                const newValues = { ...prev };
                                delete newValues[inputKey];
                                return newValues;
                              });
                              
                              // Clear selection tracking
                              delete timeInputSelections.current[inputKey];
                            }}
                            maxLength={4}
                          />
                          <Text style={styles.setUnit}>mm:ss</Text>
                        </>
                      ) : exerciseType === 'timer' ? (
                        // Timer: Timer icon and TIME
                        <>
                          <TouchableOpacity
                            style={styles.timerIconButton}
                            onPress={() => {
                              if (setTimersRef.current[timerKey]) {
                                stopSetTimer(exercise.id, set.id);
                              } else {
                                startSetTimer(exercise.id, set.id);
                              }
                            }}
                          >
                            <Ionicons 
                              name={setTimersRef.current[timerKey] ? "pause" : "play"} 
                              size={16} 
                              color={COLORS.primary} 
                            />
                          </TouchableOpacity>
                          <TextInput
                            ref={(ref) => {
                              const inputKey = `${exercise.id}-${set.id}`;
                              if (ref) timeInputRefs.current[inputKey] = ref;
                            }}
                            style={styles.setInput}
                            value={timeInputValues[`${exercise.id}-${set.id}`] !== undefined 
                              ? (() => {
                                  // Show raw digits WITHOUT colon while typing
                                  const digitsOnly = timeInputValues[`${exercise.id}-${set.id}`];
                                  return digitsOnly || '';
                                })()
                              : displayTime.replace(':', '')}
                            selection={timeInputSelectionsState[`${exercise.id}-${set.id}`]}
                            onChangeText={(text) => {
                              const inputKey = `${exercise.id}-${set.id}`;
                              // Remove all non-digits
                              const digitsOnly = text.replace(/\D/g, '').slice(0, 4); // Max 4 digits (MMSS)
                              
                              // Store raw input (digits only) - show raw digits while typing
                              setTimeInputValues(prev => ({
                                ...prev,
                                [inputKey]: digitsOnly
                              }));
                              
                              // Format and update the actual value (this is what gets saved)
                              if (digitsOnly.length >= 2) {
                                const formatted = formatTimeInput(digitsOnly);
                                updateSet(exercise.id, set.id, 'time', formatted);
                                
                                // Set cursor position to end of raw digits
                                const cursorPos = digitsOnly.length;
                                setTimeInputSelectionsState(prev => ({
                                  ...prev,
                                  [inputKey]: { start: cursorPos, end: cursorPos }
                                }));
                              } else if (digitsOnly.length === 0) {
                                updateSet(exercise.id, set.id, 'time', '');
                                setTimeInputSelectionsState(prev => {
                                  const newValues = { ...prev };
                                  delete newValues[inputKey];
                                  return newValues;
                                });
                              } else {
                                // For single digit, set cursor after it
                                setTimeInputSelectionsState(prev => ({
                                  ...prev,
                                  [inputKey]: { start: digitsOnly.length, end: digitsOnly.length }
                                }));
                              }
                            }}
                            onSelectionChange={(e) => {
                              // Extract selection immediately before event is released
                              const selection = e.nativeEvent?.selection;
                              if (!selection) return;
                              
                              const inputKey = `${exercise.id}-${set.id}`;
                              // Only update selection state if user manually changed it
                              if (timeInputValues[inputKey] !== undefined) {
                                const digitsOnly = timeInputValues[inputKey];
                                const cursorPos = selection.start;
                                // Only update if cursor is at a reasonable position
                                if (cursorPos <= digitsOnly.length) {
                                  setTimeInputSelectionsState(prev => ({
                                    ...prev,
                                    [inputKey]: { start: selection.start, end: selection.end }
                                  }));
                                }
                              }
                            }}
                            placeholder="0000"
                            keyboardType="number-pad"
                            onFocus={() => {
                              const inputKey = `${exercise.id}-${set.id}`;
                              if (set.time === '00:00' || set.time === '0:00') {
                                setTimeInputValues(prev => ({
                                  ...prev,
                                  [inputKey]: ''
                                }));
                                updateSet(exercise.id, set.id, 'time', '');
                                setTimeInputSelectionsState(prev => ({
                                  ...prev,
                                  [inputKey]: { start: 0, end: 0 }
                                }));
                              } else {
                                // Extract digits from current time
                                const digits = set.time.replace(/\D/g, '');
                                setTimeInputValues(prev => ({
                                  ...prev,
                                  [inputKey]: digits
                                }));
                                // Set cursor to end of raw digits
                                setTimeInputSelectionsState(prev => ({
                                  ...prev,
                                  [inputKey]: { start: digits.length, end: digits.length }
                                }));
                              }
                            }}
                            onBlur={() => {
                              const inputKey = `${exercise.id}-${set.id}`;
                              const digits = timeInputValues[inputKey] || set.time.replace(/\D/g, '');
                              
                              // Format and save the final value
                              if (!digits || digits === '') {
                                updateSet(exercise.id, set.id, 'time', '00:00');
                              } else {
                                const formatted = formatTimeInput(digits);
                                updateSet(exercise.id, set.id, 'time', formatted);
                              }
                              
                              // Clear raw input on blur (will show raw digits without colon)
                              setTimeInputValues(prev => {
                                const newValues = { ...prev };
                                delete newValues[inputKey];
                                return newValues;
                              });
                              
                              // Clear selection state
                              setTimeInputSelectionsState(prev => {
                                const newValues = { ...prev };
                                delete newValues[inputKey];
                                return newValues;
                              });
                              
                              // Clear selection tracking
                              delete timeInputSelections.current[inputKey];
                            }}
                            maxLength={4}
                          />
                        </>
                      ) : (
                        // Strength: KG and REPS
                        <>
                  <TextInput
                    style={styles.setInput}
                    value={set.weight}
                    onChangeText={(text) => updateSet(exercise.id, set.id, 'weight', text)}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                  <Text style={styles.setUnit}>kg</Text>
                  <Text style={styles.setSeparator}>•</Text>
                  <TextInput
                    style={styles.setInput}
                    value={set.reps}
                    onChangeText={(text) => updateSet(exercise.id, set.id, 'reps', text)}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                  <Text style={styles.setUnit}>reps</Text>
                        </>
                      )}
                </View>
                <TouchableOpacity
                  style={[styles.checkBox, set.completed && styles.checkBoxCompleted]}
                  onPress={() => toggleSetCompletion(exercise.id, set.id)}
                >
                  {set.completed && (
                    <Ionicons name="checkmark" size={16} color={COLORS.white} />
                  )}
                </TouchableOpacity>
                    
                    {editingExerciseId === exercise.id && (
                      <TouchableOpacity
                        style={styles.deleteSetButton}
                        onPress={() => {
                          stopSetTimer(exercise.id, set.id);
                          deleteSet(exercise.id, set.id);
                        }}
                      >
                        <Ionicons name="trash-outline" size={16} color={COLORS.error} />
                      </TouchableOpacity>
                    )}
              </View>
                );
              })}

            {/* Add Set Button */}
            <TouchableOpacity 
              style={styles.addSetButton}
              onPress={() => addSet(exercise.id)}
            >
              <Ionicons name="add" size={16} color={COLORS.primary} />
              <Text style={styles.addSetText}>Add Set</Text>
            </TouchableOpacity>
          </View>
        ))}

            {/* Add Exercise Button after exercises */}
      <TouchableOpacity 
              style={styles.addExerciseButtonInline}
        onPress={() => {
          navigation.navigate('AllExercisesScreen', {
            onExercisesSelected: (selectedExercises) => {
              setExercises(prev => [
                ...prev,
                ...selectedExercises.map(ex => ({
                  ...ex,
                  id: generateUniqueId(),
                        sets: [{ 
                          id: generateUniqueId(), 
                          weight: '', 
                          reps: '', 
                          distance: '',
                          time: '00:00',
                          completed: false 
                        }]
                }))
              ]);
                  },
                  onSelect: (selectedExercise) => {
                    setExercises(prev => [
                      ...prev,
                      {
                        ...selectedExercise,
                        id: generateUniqueId(),
                        sets: [{ 
                          id: generateUniqueId(), 
                          weight: '', 
                          reps: '', 
                          distance: '',
                          time: '00:00',
                          completed: false 
                        }]
                      }
                    ]);
            }
          });
        }}
      >
        <Ionicons name="add" size={20} color={COLORS.white} />
        <Text style={styles.addExerciseText}>Add Exercise</Text>
      </TouchableOpacity>
          </>
        )}
        </ScrollView>
      </TouchableWithoutFeedback>


      {saveError && (
        <Text style={styles.errorText}>{saveError}</Text>
      )}

      {/* Timer Modal */}
      <Modal
        visible={showTimerModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTimerModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowTimerModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.timerModal}>
            {/* Modal Handle */}
            <View style={styles.modalHandle} />
            
            {/* Modal Title */}
            <Text style={styles.modalTitle}>Duration</Text>
            
            {/* Duration Info */}
            <View style={styles.modalContent}>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Duration</Text>
                <Text style={styles.modalValue}>{formatTime(workoutTime)}</Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Start time</Text>
                <Text style={styles.modalValue}>{getFormattedStartTime()}</Text>
              </View>
            </View>
            
            {/* Action Button */}
            <TouchableOpacity 
              style={styles.modalButton}
              onPress={isWorkoutPaused ? resumeWorkout : pauseWorkout}
            >
              <Ionicons 
                name={isWorkoutPaused ? "play" : "pause"} 
                size={20} 
                color={COLORS.white} 
              />
              <Text style={styles.modalButtonText}>
                {isWorkoutPaused ? "Resume Workout Timer" : "Pause Workout Timer"}
              </Text>
            </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Workout Feedback Modal */}
      <WorkoutFeedbackModal
        visible={showFeedbackModal}
        onClose={() => {
          setShowFeedbackModal(false);
          navigation.navigate('Workouts');
        }}
        feedback={workoutFeedback}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    backgroundColor: COLORS.white,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
  },
  endButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  endButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  dateText: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 12,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
    marginRight: 8,
  },
  timerText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingVertical: 16,
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  exercisesList: {
    flex: 1,
  },
  exercisesContent: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 100,
  },
  exerciseCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  exerciseIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  exerciseGifIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  exerciseMuscle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  exerciseActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  editButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  moreButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
  },
  menuOverlay: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1000,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  menuContainer: {
    paddingVertical: 8,
    minWidth: 120,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  
  
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  setLabel: {
    fontSize: 16,
    color: COLORS.textSecondary,
    width: 50,
  },
  setInputs: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  setInput: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
    minWidth: 30,
    textAlign: 'center',
  },
  setUnit: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 4,
    marginRight: 12,
  },
  setSeparator: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginRight: 12,
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  checkBoxCompleted: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  deleteSetButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  addSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  addSetText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 6,
  },
  addExerciseButtonInline: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 82,
    marginTop: 24,
    marginHorizontal: 20,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  addExerciseText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  errorText: {
    color: COLORS.error,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  timerIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginRight: 8,
  },

  timerButtonText: {
    marginLeft: 10,
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  timerModal: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 32,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalContent: {
    marginBottom: 24,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  modalValue: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
});
