import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import supabase from '../lib/supabase';
import { calculateCardioCalories, calculateTotalWorkoutCalories } from '../utils/calorieCalculator';
import { workoutAnalyticsService } from '../algorithms/WorkoutAnalyticsService';
import WorkoutFeedbackModal from '../components/WorkoutFeedbackModal';

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#7c3aed',
  secondary: '#a855f7',
  accent: '#c084fc',
  white: '#ffffff',
  gray: '#64748b',
  grayLight: '#94a3b8',
  dark: '#0f172a',
  background: '#1A0B3D', // Dark purple background
  card: '#F5F0E6', // Light beige for exercise card
  darkPurple: '#2D1B69',
  mediumPurple: '#5C3A7A',
  lightPurple: '#A05EEA',
  success: '#2ed573',
  warning: '#ffa502',
  error: '#ff4757',
  lightGray: '#f1f5f9',
  textSecondary: 'rgba(255,255,255,0.8)',
};

export default function WorkoutStartScreen({ route, navigation }) {
  const { exercises, sessionType, intensity, restBetweenRounds, sessionData } = route.params;
  
  // State management
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [workoutCompleted, setWorkoutCompleted] = useState(false);
  
  // Actual workout tracking
  const [workoutStartTime, setWorkoutStartTime] = useState(null);
  const [actualWorkoutTime, setActualWorkoutTime] = useState(0);
  const [totalExercisesCompleted, setTotalExercisesCompleted] = useState(0);
  const [totalRoundsCompleted, setTotalRoundsCompleted] = useState(0);
  
  // User weight for accurate calorie calculations
  const [userWeight, setUserWeight] = useState(70); // Default 70kg
  
  // Workout feedback modal
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [workoutFeedback, setWorkoutFeedback] = useState(null);
  
  // Timer refs
  const timerRef = useRef(null);
  const workoutTimerRef = useRef(null);
  
  // Animation for timer
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Initialize first exercise and start timer automatically
  useEffect(() => {
    if (exercises.length > 0) {
      const firstExercise = exercises[0];
      setTimeRemaining(parseInt(firstExercise.duration) || 45);
      setIsPlaying(true); // Start timer automatically
      setWorkoutStartTime(Date.now()); // Start tracking actual workout time
    }
  }, [exercises]);

  // Fetch user weight for accurate calorie calculations
  useEffect(() => {
    fetchUserWeight();
  }, []);

  const fetchUserWeight = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      
      if (userId) {
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('weight')
          .eq('user_id', userId)
          .single();
        
        if (!error && profile?.weight) {
          setUserWeight(profile.weight);
        }
      }
    } catch (_error) {
      console.log('Could not fetch user weight, using default:', _error);
    }
  };

  // Track actual workout time
  useEffect(() => {
    if (workoutStartTime && !workoutCompleted) {
      workoutTimerRef.current = setInterval(() => {
        setActualWorkoutTime(Math.floor((Date.now() - workoutStartTime) / 1000));
      }, 1000);
    }
    
    return () => {
      if (workoutTimerRef.current) {
        clearInterval(workoutTimerRef.current);
      }
    };
  }, [workoutStartTime]);

  // Stop workout timer when completed
  useEffect(() => {
    if (workoutCompleted && workoutTimerRef.current) {
      clearInterval(workoutTimerRef.current);
    }
  }, [workoutCompleted]);

  // Timer logic
  useEffect(() => {
    if (isPlaying && timeRemaining > 0) {
      timerRef.current = setTimeout(() => {
        setTimeRemaining(time => time - 1);
      }, 1000);
    } else if (isPlaying && timeRemaining === 0) {
      handleTimerComplete();
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isPlaying, timeRemaining, handleTimerComplete]);

  // Pulse animation for timer
  useEffect(() => {
    if (isPlaying && timeRemaining <= 10) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isPlaying, timeRemaining, pulseAnim]);

  // Progress animation for circular timer
  useEffect(() => {
    const currentExercise = getCurrentExercise();
    const totalDuration = parseInt(currentExercise.duration) || 45;
    const progress = (totalDuration - timeRemaining) / totalDuration;
    
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [timeRemaining, getCurrentExercise, progressAnim]);

  const handleTimerComplete = useCallback(() => {
    if (isResting) {
      // Rest complete, move to next exercise or round
      let nextExerciseIndex = currentExerciseIndex + 1;
      
      // Find next exercise that should be included in current round
      while (nextExerciseIndex < exercises.length) {
        const nextExercise = exercises[nextExerciseIndex];
        const nextExerciseRounds = nextExercise.rounds || 1;
        
        // Include exercise if it has rounds remaining for current round
        if (nextExerciseRounds >= currentRound) {
          break;
        }
        nextExerciseIndex++;
      }
      
      if (nextExerciseIndex < exercises.length) {
        // Move to next exercise in current round
        setCurrentExerciseIndex(nextExerciseIndex);
        setTotalExercisesCompleted(prev => prev + 1);
        setIsResting(false);
        const nextExercise = exercises[nextExerciseIndex];
        setTimeRemaining(parseInt(nextExercise.duration) || 45);
        setIsPlaying(true);
      } else {
        // All exercises in current round completed, check if we need to start next round
        const maxRounds = Math.max(...exercises.map(ex => ex.rounds || 1));
        
        if (currentRound < maxRounds) {
          // Complete current round and start next round
          setTotalRoundsCompleted(prev => prev + 1); // Increment when completing a round
          
          // Start next round, find first exercise that has more rounds
          let firstExerciseIndex = 0;
          while (firstExerciseIndex < exercises.length) {
            const exercise = exercises[firstExerciseIndex];
            const exerciseRounds = exercise.rounds || 1;
            
            if (exerciseRounds > currentRound) {
              // This exercise has more rounds, start with it
              break;
            }
            firstExerciseIndex++;
          }
          
          if (firstExerciseIndex < exercises.length) {
            setCurrentExerciseIndex(firstExerciseIndex);
            setCurrentRound(currentRound + 1);
            setIsResting(false);
            const firstExercise = exercises[firstExerciseIndex];
            setTimeRemaining(parseInt(firstExercise.duration) || 45);
            setIsPlaying(true);
          } else {
            // No exercises have more rounds
            completeWorkout();
          }
        } else {
          // All rounds completed
          setTotalRoundsCompleted(prev => prev + 1); // Increment when completing final round
          completeWorkout();
        }
      }
    } else {
      // Exercise complete, start rest
      const currentExercise = exercises[currentExerciseIndex];
      setIsResting(true);
      setTimeRemaining(parseInt(currentExercise.rest) || 15);
      setIsPlaying(true);
    }
  }, [isResting, currentExerciseIndex, exercises, currentRound, completeWorkout]);

  const completeWorkout = useCallback(() => {
    setIsPlaying(false);
    setTotalExercisesCompleted(prev => prev + 1); // Track final exercise completion
    setWorkoutCompleted(true);
  }, []);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSkip = () => {
    setIsPlaying(false);
    handleTimerComplete();
  };

  const handleStop = () => {
    Alert.alert(
      'Stop Workout',
      'Are you sure you want to stop the workout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Stop', style: 'destructive', onPress: () => navigation.goBack() }
      ]
    );
  };


  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getCurrentExercise = useCallback(() => {
    return exercises[currentExerciseIndex] || {};
  }, [exercises, currentExerciseIndex]);

  const getNextExercise = () => {
    if (isResting) {
      // Find next exercise that should be included in current round
      let nextExerciseIndex = currentExerciseIndex + 1;
      
      while (nextExerciseIndex < exercises.length) {
        const nextExercise = exercises[nextExerciseIndex];
        const nextExerciseRounds = nextExercise.rounds || 1;
        
        // Include exercise if it has rounds remaining for current round
        if (nextExerciseRounds >= currentRound) {
          return nextExercise;
        }
        nextExerciseIndex++;
      }
      
      // If no more exercises in current round, check if we need to start next round
      const maxRounds = Math.max(...exercises.map(ex => ex.rounds || 1));
      
      if (currentRound < maxRounds) {
        // Find first exercise that has more rounds
        let firstExerciseIndex = 0;
        while (firstExerciseIndex < exercises.length) {
          const exercise = exercises[firstExerciseIndex];
          const exerciseRounds = exercise.rounds || 1;
          
          if (exerciseRounds > currentRound) {
            return exercise;
          }
          firstExerciseIndex++;
        }
      }
    }
    return null;
  };

  // Helper functions for formatting actual workout data

  const formatActualTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    }
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Calculate actual workout stats
  
  // Use session data from database if available, otherwise calculate
  const plannedWorkoutDuration = sessionData?.estimated_time || exercises.reduce((total, ex) => {
    const exerciseDuration = parseInt(ex.duration) || 45;
    const restDuration = parseInt(ex.rest) || 15;
    const exerciseRounds = ex.rounds || 1;
    
    // Calculate total time for this exercise: (duration + rest) * rounds
    const exerciseTotalTime = (exerciseDuration + restDuration) * exerciseRounds;
    return total + exerciseTotalTime;
  }, 0);

  // Calculate accurate calories using the new utility
  const actualCalories = (() => {
    if (sessionData?.estimated_calories) {
      return sessionData.estimated_calories;
    }
    
    const safeIntensity = intensity && !isNaN(intensity) ? intensity : 50;
    const maxRounds = Math.max(...exercises.map(ex => ex.rounds || 1));
    
    const { totalCalories } = calculateTotalWorkoutCalories(
      exercises,
      userWeight,
      safeIntensity,
      maxRounds,
      restBetweenRounds
    );
    
    return totalCalories;
  })();
  
  
  // Calculate workout score based on actual performance
  const calculateWorkoutScore = () => {
    const maxRounds = Math.max(...exercises.map(ex => ex.rounds || 1));
    const completionRate = (totalRoundsCompleted / maxRounds) * 100;
    const timeEfficiency = Math.min(100, (actualWorkoutTime / (actualWorkoutTime + 300)) * 100); // Bonus for efficiency
    const safeIntensity = intensity && !isNaN(intensity) ? intensity : 50;
    const intensityBonus = Math.min(20, safeIntensity - 30); // Bonus for higher intensity
    
    return Math.min(100, Math.round(completionRate * 0.6 + timeEfficiency * 0.3 + intensityBonus));
  };

  const workoutScore = calculateWorkoutScore();
  const maxRounds = Math.max(...exercises.map(ex => ex.rounds || 1));

  const saveCardioDetails = async () => {
    console.log('saveCardioDetails function called');
    console.log('Current exercises:', exercises);
    console.log('Current sessionType:', sessionType);
    console.log('Current intensity:', intensity);
    try {
      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      
      if (!userId) {
        Alert.alert('Error', 'User not logged in');
        return;
      }

      // Validate exercises data
      if (!exercises || exercises.length === 0) {
        Alert.alert('Error', 'No exercises to save');
        return;
      }


      // Save each exercise as a separate row in saved_cardio_sessions
      const exercisePromises = exercises.map(async (exercise, index) => {
        const exerciseData = {
          user_id: userId,
          name: exercise.name || exercise.workout || `Exercise ${index + 1}`,
          total_rounds: parseInt(exercise.rounds) || 1,
          rest_between_rounds: parseInt(exercise.rest) || 15,
          sound_alerts: true,
          sound_option: 'ding',
          auto_repeat: false,
          notes: 'Completed Workout',
          estimated_time: parseInt(exercise.duration) || 45, // Individual exercise duration
          estimated_calories: calculateCardioCalories(
            exercise.name || 'cardio',
            (parseInt(exercise.duration) || 45) / 60, // convert to minutes
            userWeight,
            intensity <= 33 ? 'light' : intensity <= 66 ? 'moderate' : 'vigorous'
          ) * (parseInt(exercise.rounds) || 1)
        };


        const { error: exerciseError } = await supabase
          .from('saved_cardio_sessions')
          .insert(exerciseData);

        if (exerciseError) {
          console.error(`Exercise ${index + 1} save error:`, exerciseError);
          throw new Error(`Failed to save exercise ${index + 1}: ${exerciseError.message}`);
        }

        return exerciseData;
      });

      // Wait for all exercises to be saved
      await Promise.all(exercisePromises);

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
        console.log('✅ Exercise streak updated after completing cardio workout');
      } catch (error) {
        console.error('Error updating exercise streak:', error);
      }

      // Generate workout analytics feedback
      try {
        await workoutAnalyticsService.initialize(userId);
        
        // Log the cardio workout to analytics
        const muscleGroups = [...new Set(exercises.map(ex => {
          // Extract muscle groups from exercise name or default to 'cardio'
          const name = (ex.name || '').toLowerCase();
          if (name.includes('leg') || name.includes('squat') || name.includes('lunge')) return 'legs';
          if (name.includes('arm') || name.includes('bicep') || name.includes('tricep')) return 'arms';
          if (name.includes('chest') || name.includes('push')) return 'chest';
          if (name.includes('back') || name.includes('pull')) return 'back';
          if (name.includes('shoulder')) return 'shoulders';
          if (name.includes('core') || name.includes('ab')) return 'core';
          return 'cardio';
        }))];
        
        // Calculate total duration
        const totalDuration = exercises.reduce((sum, ex) => {
          const duration = parseInt(ex.duration) || 45;
          const rounds = parseInt(ex.rounds) || 1;
          return sum + (duration * rounds);
        }, 0);
        
        await workoutAnalyticsService.logWorkout({
          exercises: exercises.map(ex => ({
            name: ex.name || 'Cardio Exercise',
            duration: parseInt(ex.duration) || 45,
            rounds: parseInt(ex.rounds) || 1,
            type: 'cardio'
          })),
          intensity: intensity <= 33 ? 'light' : intensity <= 66 ? 'moderate' : 'vigorous',
          duration: totalDuration / 60, // Convert to minutes
          date: new Date(),
          muscleGroups
        });
        
        // Get post-workout summary
        const feedback = await workoutAnalyticsService.getPostWorkoutSummary({
          exercises: exercises.map(ex => ({
            name: ex.name || 'Cardio Exercise',
            duration: parseInt(ex.duration) || 45,
            rounds: parseInt(ex.rounds) || 1
          })),
          intensity: intensity <= 33 ? 'light' : intensity <= 66 ? 'moderate' : 'vigorous',
          duration: totalDuration / 60,
          muscleGroups
        });
        
        setWorkoutFeedback(feedback);
        setShowFeedbackModal(true);
        
        console.log('✅ Cardio workout analytics generated');
      } catch (error) {
        console.error('Error generating cardio workout analytics:', error);
        // Don't block the user if analytics fail
      }

      Alert.alert(
        'Success',
        'Workout details saved successfully!',
        [{ text: 'OK', onPress: () => navigation.navigate('Create') }]
      );
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', `An unexpected error occurred while saving: ${error.message}`);
    }
  };

  if (workoutCompleted) {
    return (
      <ScrollView style={styles.completedContainer} contentContainerStyle={styles.scrollContent}>
        {/* Check mark icon */}
        <View style={styles.checkMarkContainer}>
          <View style={styles.checkMarkCircle}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
        </View>

        {/* Header Section */}
        <View style={styles.completedHeader}>
          <Text style={styles.completedTitle}>Workout Completed!</Text>
          <Text style={styles.workoutType}>
            {sessionType || 'HIIT'}
          </Text>
          <Text style={styles.completedDate}>
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric' 
            })} • {new Date().toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            })}
          </Text>
        </View>

        {/* Workout Statistics */}
        <View style={styles.statsContainer}>
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Text style={styles.clockIcon}>🕐</Text>
              </View>
              <Text style={styles.statLabel}>Duration</Text>
              <Text style={styles.statValue}>{formatActualTime(plannedWorkoutDuration)}</Text>
            </View>
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Text style={styles.fireIcon}>🔥</Text>
              </View>
              <Text style={styles.statLabel}>Calories Burned</Text>
              <Text style={styles.statValue}>{actualCalories} kcal</Text>
            </View>
          </View>
          
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Text style={styles.lightningIcon}>⚡</Text>
              </View>
              <Text style={styles.statLabel}>Avg. Intensity</Text>
              <Text style={styles.statValue}>{intensity >= 75 ? 'High' : intensity >= 50 ? 'Medium' : 'Low'}</Text>
            </View>
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Text style={styles.exerciseIcon}>💪</Text>
              </View>
              <Text style={styles.statLabel}>Exercises</Text>
              <Text style={styles.statValue}>{totalExercisesCompleted} completed</Text>
            </View>
          </View>
        </View>

        {/* Workout Score */}
        <View style={styles.scoreSection}>
          <View style={styles.scoreHeader}>
            <Text style={styles.scoreLabel}>Workout Score</Text>
            <Text style={styles.scoreValue}>{workoutScore}/100</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${workoutScore}%` }]} />
          </View>
        </View>

        {/* Workout Summary */}
        <View style={styles.energySection}>
          <Text style={styles.sectionTitle}>Workout Summary</Text>
          
          {/* Exercise Cards */}
          {exercises.map((exercise, index) => (
            <View key={index} style={styles.exerciseSummaryCard}>
              <View style={styles.exerciseSummaryInfo}>
                {exercise.gif_url ? (
                  <Image
                    source={{ uri: exercise.gif_url }}
                    style={styles.exerciseSummaryGif}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.exerciseSummaryIcon}>💪</Text>
                )}
                <View style={styles.exerciseSummaryDetails}>
                  <Text style={styles.exerciseSummaryName}>{exercise.name}</Text>
                  <View style={styles.exerciseSummaryStats}>
                    <Text style={styles.exerciseSummaryStat}>
                      {exercise.duration}s
                    </Text>
                    <Text style={styles.exerciseSummaryStat}>
                      Rest: {exercise.rest}s
                    </Text>
                    <Text style={styles.exerciseSummaryStat}>
                      Rounds: {exercise.rounds || 1}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
          
          {/* Overall Stats */}
          <View style={styles.overallStats}>
            <View style={styles.overallStatItem}>
              <Text style={styles.overallStatIcon}>⏱️</Text>
              <Text style={styles.overallStatValue}>{formatActualTime(plannedWorkoutDuration)}</Text>
              <Text style={styles.overallStatLabel}>Total Time</Text>
            </View>
            <View style={styles.overallStatItem}>
              <Text style={styles.overallStatIcon}>🔥</Text>
              <Text style={styles.overallStatValue}>{Math.round(actualCalories)}</Text>
              <Text style={styles.overallStatLabel}>Calories</Text>
            </View>
            <View style={styles.overallStatItem}>
              <Text style={styles.overallStatIcon}>💪</Text>
              <Text style={styles.overallStatValue}>{totalExercisesCompleted}</Text>
              <Text style={styles.overallStatLabel}>Exercises</Text>
            </View>
          </View>
        </View>


        {/* How did you feel */}
        <View style={styles.feelingsSection}>
          <Text style={styles.sectionTitle}>How did you feel?</Text>
          <View style={styles.feelingsInput}>
            <Text style={styles.inputPlaceholder}>Optional notes about your workout...</Text>
          </View>
          <View style={styles.emojiOptions}>
            <TouchableOpacity style={styles.emojiButton}>
              <Text style={styles.emoji}>😊</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.emojiButton}>
              <Text style={styles.emoji}>😅</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.emojiButton}>
              <Text style={styles.emoji}>😫</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Achievement Badges */}
        <View style={styles.achievementsSection}>
          <View style={styles.achievementBadge}>
            <Text style={styles.achievementIcon}>🔥</Text>
            <Text style={styles.achievementText}>Streak Day 3</Text>
          </View>
          <View style={styles.achievementBadge}>
            <Text style={styles.achievementIcon}>🏆</Text>
            <Text style={styles.achievementText}>1000 kcal burned total</Text>
          </View>
        </View>


        {/* Bottom Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.planNextButton, { backgroundColor: COLORS.primary }]} 
            onPress={() => {
              saveCardioDetails();
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.planNextButtonText, { color: COLORS.white }]}>Done</Text>
          </TouchableOpacity>
          
        </View>
      </ScrollView>
    );
  }


  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Segmented Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.segmentedProgressBar}>
            {exercises.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressSegment,
                  {
                    backgroundColor: index < currentExerciseIndex 
                      ? COLORS.darkPurple // Completed exercises
                      : index === currentExerciseIndex 
                      ? COLORS.darkPurple // Current exercise
                      : COLORS.lightPurple, // Upcoming exercises
                  }
                ]}
              />
            ))}
          </View>
        </View>

      {/* Rest Header - Only show during rest */}
      {isResting && (
        <View style={styles.restHeader}>
          <Text style={styles.restTitle}>REST</Text>
          <Text style={styles.restSubtitle}>Rest Time</Text>
        </View>
      )}

      {/* Exercise Demonstration Area - Only show during active exercise */}
      {!isResting && (
        <>
          <View style={styles.exerciseDemoContainer}>
            <View style={styles.exerciseCard}>
              {getCurrentExercise().gif_url ? (
                <Image
                  source={{ uri: getCurrentExercise().gif_url }}
                  style={styles.exerciseImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.exercisePlaceholder}>
                  <Ionicons name="fitness" size={80} color={COLORS.primary} />
                </View>
              )}
            </View>
          </View>

          {/* Exercise Info */}
          <View style={styles.exerciseInfo}>
            <Text style={styles.exerciseName}>{getCurrentExercise().name}</Text>
            <View style={styles.intensityPill}>
              <Text style={styles.intensityText}>
                {`${intensity >= 75 ? 'High' : intensity >= 50 ? 'Medium' : 'Low'} Intensity`}
              </Text>
            </View>
          </View>
        </>
      )}

      {/* Timer Section - Centered */}
      <View style={[styles.timerSection, isResting && styles.timerSectionRest]}>
        <Animated.View style={[styles.timerContainer, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.timerCircle}>
            <Text style={styles.timerText}>{formatTime(timeRemaining)}</Text>
            <Text style={styles.timerLabel}>REMAINING</Text>
          </View>
        </Animated.View>
        
        <Text style={styles.roundText}>Round {currentRound} of {getCurrentExercise().rounds || 1}</Text>
      </View>

      {/* Next Exercise Preview - Only show if there's a next exercise */}
      {getNextExercise() && (
        <View style={styles.nextExerciseContainer}>
          <View style={styles.nextExerciseCard}>
            <View style={styles.nextExerciseImage}>
              {getNextExercise().gif_url ? (
                <Image
                  source={{ uri: getNextExercise().gif_url }}
                  style={styles.nextExerciseThumbnail}
                  resizeMode="cover"
                />
              ) : (
                <Ionicons name="fitness" size={24} color={COLORS.primary} />
              )}
            </View>
            <View style={styles.nextExerciseInfo}>
              <Text style={styles.nextExerciseLabel}>Next Up</Text>
              <Text style={styles.nextExerciseName}>{getNextExercise().name}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Bottom Controls - Only 3 buttons: Stop, Pause, Skip */}
      <View style={styles.bottomControls}>
        <TouchableOpacity style={styles.controlButton} onPress={handleStop}>
          <Ionicons name="close" size={24} color={COLORS.white} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.controlButton} onPress={handlePlayPause}>
          <Ionicons 
            name={isPlaying ? "pause" : "play"} 
            size={24} 
            color={COLORS.white} 
          />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.controlButton} onPress={handleSkip}>
          <Ionicons name="play-skip-forward" size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Workout Feedback Modal */}
      <WorkoutFeedbackModal
        visible={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        feedback={workoutFeedback}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  segmentedProgressBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
  },
  progressSegment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  exerciseDemoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 20,
  },
  exerciseCard: {
    width: width * 0.9,
    height: width * 0.5,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  exerciseImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    resizeMode: 'contain',
  },
  exercisePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  exerciseInfo: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
    marginTop: 5,
  },
  exerciseName: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.lightPurple,
    textAlign: 'center',
    marginBottom: 12,
  },
  intensityPill: {
    // backgroundColor: COLORS.mediumPurple,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  intensityText: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.darkPurple,
  },
  timerSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  timerSectionRest: {
    flex: 1,
    justifyContent: 'center',
    marginTop: 0,
    marginBottom: -20,
  },
  restHeader: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  restTitle: {
    fontSize: 48,
    fontWeight: '800',
    color: COLORS.darkPurple,
    marginBottom: 8,
  },
  restSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.gray,
  },
  timerContainer: {
    marginBottom: 20,
  },
  timerCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth:16,
    borderColor: COLORS.mediumPurple,
  },
  timerText: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.darkPurple,
    marginBottom: 4,
  },
  timerLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  roundText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.darkPurple,
  },
  nextExerciseContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
    marginTop: 0,
  },
  nextExerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.mediumPurple,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  nextExerciseImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.darkPurple,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  nextExerciseThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  nextExerciseInfo: {
    flex: 1,
  },
  nextExerciseLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  nextExerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
    flex: 1,
    flexWrap: 'wrap',
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
    paddingTop: 10,
    gap: 40,
    marginBottom: 5,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  
  // Completion screen styles
  completedContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  checkMarkContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  checkMarkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkMark: {
    fontSize: 32,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  completedHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  completedTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  workoutType: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 5,
  },
  completedDate: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  statsContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 15,
    padding: 20,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'flex-start',
  },
  statIconContainer: {
    marginBottom: 8,
  },
  clockIcon: {
    fontSize: 20,
  },
  fireIcon: {
    fontSize: 20,
  },
  lightningIcon: {
    fontSize: 20,
  },
  heartIcon: {
    fontSize: 20,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  bpmText: {
    fontSize: 14,
    fontWeight: 'normal',
    color: COLORS.grayLight,
  },
  scoreSection: {
    marginBottom: 25,
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  scoreLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  scoreValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  energySection: {
    marginBottom: 25,
  },
  summaryContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 15,
  },
  feelingsSection: {
    marginBottom: 25,
  },
  feelingsInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 80,
  },
  inputPlaceholder: {
    color: '#6B7280',
    fontSize: 14,
  },
  emojiOptions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 30,
  },
  emojiButton: {
    padding: 10,
  },
  emoji: {
    fontSize: 28,
  },
  achievementsSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 15,
    marginBottom: 25,
  },
  achievementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  achievementIcon: {
    fontSize: 16,
  },
  achievementText: {
    fontSize: 12,
    color: '#92400e',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 20,
  },
  planNextButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.lightPurple,
  },
  planNextButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Exercise Summary Card Styles
  exerciseSummaryCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  exerciseSummaryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  exerciseSummaryGif: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 16,
  },
  exerciseSummaryIcon: {
    fontSize: 28,
    marginRight: 16,
  },
  exerciseSummaryDetails: {
    flex: 1,
  },
  exerciseSummaryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  exerciseSummaryStats: {
    flexDirection: 'row',
    gap: 16,
  },
  exerciseSummaryStat: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  
  // Overall Stats Styles
  overallStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  overallStatItem: {
    alignItems: 'center',
  },
  overallStatIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  overallStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  overallStatLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
});