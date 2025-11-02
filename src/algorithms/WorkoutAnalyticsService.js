/**
 * Workout Analytics Service
 * 
 * Integrates all workout tracking engines:
 * - Progressive Overload Engine
 * - Rest & Recovery Engine
 * - Stagnation Detector
 * 
 * Provides unified interface for workout analytics and recommendations.
 */

import supabase from '../lib/supabase';
import { ProgressiveOverloadEngine } from './ProgressiveOverloadEngine';
import { RestRecoveryEngine } from './RestRecoveryEngine';
import { StagnationDetector } from './StagnationDetector';

class WorkoutAnalyticsService {
  constructor() {
    this.overloadEngine = new ProgressiveOverloadEngine();
    this.recoveryEngine = new RestRecoveryEngine();
    this.stagnationDetector = new StagnationDetector();
    this.initialized = false;
    this.userId = null;
  }

  /**
   * Initialize the service with user data
   * @param {string} userId - User ID
   */
  async initialize(userId) {
    if (this.userId === userId && this.initialized) {
      return; // Already initialized for this user
    }

    this.userId = userId;
    
    try {
      await Promise.all([
        this.loadWorkoutHistory(userId),
        this.loadCardioHistory(userId)
      ]);
      
      this.initialized = true;
      console.log('✅ Workout Analytics Service initialized');
    } catch (error) {
      console.error('Error initializing Workout Analytics Service:', error);
      throw error;
    }
  }

  /**
   * Load workout history from database (routine workouts)
   * @param {string} userId - User ID
   */
  async loadWorkoutHistory(userId) {
    try {
      // Fetch workouts first
      const { data: workouts, error: workoutsError } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (workoutsError) throw workoutsError;

      if (!workouts || workouts.length === 0) {
        console.log('✅ No routine workouts found');
        return;
      }

      // Fetch all workout exercises for these workouts
      const workoutIds = workouts.map(w => w.id);
      const { data: workoutExercises, error: exercisesError } = await supabase
        .from('daily_routine_exercises')
        .select('*')
        .in('workout_id', workoutIds);

      if (exercisesError) throw exercisesError;

      // Fetch all sets for these exercises
      const exerciseIds = workoutExercises?.map(e => e.id) || [];
      const { data: sets, error: setsError } = await supabase
        .from('sets')
        .select('*')
        .in('workout_exercise_id', exerciseIds);

      if (setsError) throw setsError;

      // Build a map of sets by workout_exercise_id
      const setsByExercise = {};
      sets?.forEach(set => {
        if (!setsByExercise[set.workout_exercise_id]) {
          setsByExercise[set.workout_exercise_id] = [];
        }
        setsByExercise[set.workout_exercise_id].push(set);
      });

      // Build a map of exercises by workout_id
      const exercisesByWorkout = {};
      workoutExercises?.forEach(exercise => {
        if (!exercisesByWorkout[exercise.workout_id]) {
          exercisesByWorkout[exercise.workout_id] = [];
        }
        exercisesByWorkout[exercise.workout_id].push({
          ...exercise,
          sets: setsByExercise[exercise.id] || []
        });
      });

      // Process each workout
      workouts.forEach(workout => {
        const workoutDate = workout.created_at;
        const muscleGroups = new Set();
        const exercises = exercisesByWorkout[workout.id] || [];

        // Process each exercise in the workout
        exercises.forEach(exercise => {
          const exerciseName = exercise.exercise_name || exercise.name || 'Unknown Exercise';
          
          // Extract muscle groups
          if (exercise.body_parts) {
            const parts = exercise.body_parts.split(',');
            parts.forEach(part => muscleGroups.add(part.trim().toLowerCase()));
          }

          // Process sets for progressive overload
          exercise.sets?.forEach(set => {
            if (set.weight && set.reps) {
              // Log to progressive overload engine
              this.overloadEngine.logSession(exerciseName, {
                weight: parseFloat(set.weight),
                reps: parseInt(set.reps),
                sets: 1, // Each set logged individually
                date: workoutDate
              });

              // Log to stagnation detector
              this.stagnationDetector.logExercise(
                exerciseName,
                parseFloat(set.weight),
                parseInt(set.reps),
                1,
                workoutDate
              );
            }
          });
        });

        // Log to recovery engine
        const primaryMuscleGroup = muscleGroups.size > 0 
          ? Array.from(muscleGroups)[0] 
          : 'full body';
        
        this.recoveryEngine.logSession(
          primaryMuscleGroup,
          workoutDate,
          workout.intensity || 'moderate',
          workout.duration || 45
        );
      });

      console.log(`✅ Loaded ${workouts.length} routine workouts`);
    } catch (error) {
      console.error('Error loading workout history:', error);
    }
  }

  /**
   * Load cardio workout history from database
   * @param {string} userId - User ID
   */
  async loadCardioHistory(userId) {
    try {
      const { data: cardioSessions, error } = await supabase
        .from('saved_cardio_sessions')
        .select(`
          *,
          saved_cardio_exercises (*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      cardioSessions?.forEach(session => {
        const sessionDate = session.created_at;
        const intensity = session.intensity || 'moderate';
        const duration = session.estimated_time || 45;

        // Extract muscle groups from exercises
        const muscleGroups = new Set();
        session.saved_cardio_exercises?.forEach(exercise => {
          if (exercise.body_parts) {
            const parts = exercise.body_parts.split(',');
            parts.forEach(part => muscleGroups.add(part.trim().toLowerCase()));
          }
        });

        const primaryMuscleGroup = muscleGroups.size > 0 
          ? Array.from(muscleGroups)[0] 
          : 'cardio';

        // Log to recovery engine
        this.recoveryEngine.logSession(
          primaryMuscleGroup,
          sessionDate,
          intensity,
          duration
        );
      });

      console.log(`✅ Loaded ${cardioSessions?.length || 0} cardio sessions`);
    } catch (error) {
      console.error('Error loading cardio history:', error);
    }
  }

  /**
   * Log a new workout session
   * @param {Object} workout - Workout data
   */
  async logWorkout(workout) {
    const { exercises, intensity, duration, date, muscleGroups } = workout;

    // Log to progressive overload engine
    exercises?.forEach(exercise => {
      if (exercise.sets) {
        exercise.sets.forEach(set => {
          if (set.weight && set.reps) {
            this.overloadEngine.logSession(exercise.name, {
              weight: parseFloat(set.weight),
              reps: parseInt(set.reps),
              sets: 1,
              date: date || new Date()
            });

            this.stagnationDetector.logExercise(
              exercise.name,
              parseFloat(set.weight),
              parseInt(set.reps),
              1,
              date || new Date()
            );
          }
        });
      }
    });

    // Log to recovery engine
    const primaryMuscleGroup = muscleGroups?.[0] || 'full body';
    this.recoveryEngine.logSession(
      primaryMuscleGroup,
      date || new Date(),
      intensity || 'moderate',
      duration || 45
    );
  }

  /**
   * Get comprehensive workout feedback
   * @param {string} exerciseName - Exercise name (optional, for exercise-specific feedback)
   * @returns {Object} - Comprehensive feedback
   */
  async getFeedback(exerciseName = null) {
    if (!this.initialized) {
      throw new Error('Service not initialized. Call initialize() first.');
    }

    const feedback = {
      timestamp: new Date(),
      userId: this.userId
    };

    // Get recovery advice
    feedback.recovery = this.recoveryEngine.getRestAdvice();
    feedback.recoveryScore = this.recoveryEngine.getRecoveryScore();
    feedback.shouldRest = this.recoveryEngine.shouldRestToday();

    // Get stagnation alerts
    feedback.stagnantExercises = this.stagnationDetector.getAllStagnantExercises();

    // Exercise-specific feedback
    if (exerciseName) {
      feedback.exercise = {
        name: exerciseName,
        progression: this.overloadEngine.suggestIncrease(exerciseName),
        stagnation: this.stagnationDetector.checkStagnation(exerciseName),
        plateauBreak: this.stagnationDetector.checkPlateauBreak(exerciseName),
        motivation: this.stagnationDetector.getMotivationMessage(exerciseName),
        streak: this.stagnationDetector.getProgressStreak(exerciseName),
        personalRecords: this.overloadEngine.getPersonalRecords(exerciseName),
        summary: this.overloadEngine.getProgressSummary(exerciseName)
      };
    }

    return feedback;
  }

  /**
   * Get post-workout summary
   * @param {Object} workout - Completed workout data
   * @returns {Object} - Post-workout summary with insights
   */
  async getPostWorkoutSummary(workout) {
    const { exercises, intensity, duration, muscleGroups } = workout;
    
    const summary = {
      workout: {
        exercises: exercises?.length || 0,
        intensity,
        duration,
        muscleGroups
      },
      achievements: [],
      warnings: [],
      suggestions: []
    };

    // Check for PRs in each exercise
    for (const exercise of exercises || []) {
      if (exercise.sets) {
        for (const set of exercise.sets) {
          if (set.weight && set.reps) {
            const pr = this.overloadEngine.checkForPR(exercise.name, {
              weight: parseFloat(set.weight),
              reps: parseInt(set.reps),
              sets: 1
            });

            if (pr && Array.isArray(pr)) {
              summary.achievements.push(...pr);
            } else if (pr && pr.type === 'first') {
              summary.achievements.push(pr);
            }
          }
        }

        // Check for plateau breaks
        const plateauBreak = this.stagnationDetector.checkPlateauBreak(exercise.name);
        if (plateauBreak) {
          summary.achievements.push(plateauBreak);
        }
      }
    }

    // Check recovery status - only show warnings relevant to THIS workout
    const recoveryAdvice = this.recoveryEngine.getRestAdvice();
    
    // Get muscle groups from current workout (normalize to lowercase for comparison)
    const currentWorkoutMuscleGroups = (muscleGroups || []).map(mg => mg.toLowerCase());
    
    // Debug logging (removed to reduce log spam - uncomment if needed for debugging)
    // console.log('📊 Post-workout summary - Muscle groups:', {
    //   currentWorkoutMuscleGroups,
    //   allWarnings: recoveryAdvice.advice.filter(a => 
    //     a.severity === 'critical' || a.severity === 'high' || a.severity === 'medium'
    //   ).map(w => ({ type: w.type, message: w.message }))
    // });
    
    // Filter advice to only get warnings (severity: critical, high, medium)
    const allWarnings = recoveryAdvice.advice.filter(a => 
      a.severity === 'critical' || a.severity === 'high' || a.severity === 'medium'
    );
    
    // Only show warnings if user has enough workout history (at least 3 total sessions)
    // This prevents false warnings for new users
    const totalSessions = recoveryAdvice.metrics?.totalSessions || 0;
    const hasEnoughHistory = totalSessions >= 3;
    
    // Filter warnings to only those relevant to current workout muscle groups
    // OR global warnings (like rest days, no_rest, etc.)
    const relevantWarnings = allWarnings.filter(warning => {
      // If not enough history, only show critical warnings
      if (!hasEnoughHistory && warning.severity !== 'critical') {
        return false;
      }
      
      // Include global warnings (rest days, etc.) - these are always relevant
      if (warning.type === 'no_rest' || warning.type === 'insufficient_rest') {
        // Only show if user has at least 2 workouts this week
        return totalSessions >= 2;
      }
      
      // Include high volume/intensity warnings only if they have enough workouts
      if (warning.type === 'high_volume' || warning.type === 'high_intensity') {
        return totalSessions >= 5;
      }
      
      // For muscle group-specific warnings, only include if it matches current workout
      if (warning.type === 'overtraining') {
        // Extract muscle group from warning message
        // Format: "⚠️ Too many {group} workouts" or "⚠️ High frequency: {frequency} {group} workouts"
        const message = warning.message || '';
        const match = message.match(/(?:Too many|High frequency.*?)(\w+) workouts/i);
        if (match) {
          const warnedGroup = match[1].toLowerCase();
          // Check if this muscle group is in the current workout
          return currentWorkoutMuscleGroups.some(mg => 
            mg.includes(warnedGroup) || warnedGroup.includes(mg) || mg === warnedGroup
          );
        }
      }
      
      return false;
    });
    
    if (relevantWarnings.length > 0) {
      summary.warnings.push(...relevantWarnings);
    }

    // Get progression suggestions for exercises
    for (const exercise of exercises || []) {
      const progression = this.overloadEngine.suggestIncrease(exercise.name);
      // Show suggestions for stagnation (6+ sessions) or 4-5 session maintenance reminders
      if (progression.type === 'stagnation' || progression.type === 'consistency') {
        summary.suggestions.push({
          exercise: exercise.name,
          ...progression
        });
      }
    }

    return summary;
  }

  /**
   * Get dashboard analytics
   * @returns {Object} - Dashboard data
   */
  async getDashboardAnalytics() {
    if (!this.initialized) {
      throw new Error('Service not initialized. Call initialize() first.');
    }

    const analytics = {
      recovery: this.recoveryEngine.getRecoveryScore(),
      stagnation: {
        total: this.stagnationDetector.getAllStagnantExercises().length,
        exercises: this.stagnationDetector.getAllStagnantExercises()
      },
      weeklyAdvice: this.recoveryEngine.getRestAdvice(),
      shouldRest: this.recoveryEngine.shouldRestToday()
    };

    return analytics;
  }

  /**
   * Reset the service (useful for testing or switching users)
   */
  reset() {
    this.overloadEngine = new ProgressiveOverloadEngine();
    this.recoveryEngine = new RestRecoveryEngine();
    this.stagnationDetector = new StagnationDetector();
    this.initialized = false;
    this.userId = null;
  }
}

// Export singleton instance
export const workoutAnalyticsService = new WorkoutAnalyticsService();

// Export class for testing
export { WorkoutAnalyticsService };

