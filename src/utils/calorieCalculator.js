/**
 * Real-world accurate calorie calculation utility
 * Based on scientific formulas and MET values
 */

// Metabolic Equivalent of Task (MET) values for different exercises
// Source: Compendium of Physical Activities
const EXERCISE_METS = {
  // Cardio exercises
  'running': 8.0,
  'jogging': 6.0,
  'walking': 3.5,
  'cycling': 6.0,
  'swimming': 7.0,
  'jumping jacks': 8.0,
  'burpees': 10.0,
  'mountain climbers': 8.0,
  'high knees': 8.0,
  'jump rope': 12.0,
  'squat jumps': 8.0,
  'lunge jumps': 8.0,
  'plank jacks': 6.0,
  'bear crawls': 8.0,
  'crab walks': 6.0,
  
  // HIIT exercises
  'hiit': 8.5,
  'tabata': 9.0,
  'circuit training': 7.0,
  
  // Strength exercises (for comparison)
  'weight lifting': 5.0,
  'bodyweight exercises': 6.0,
  'resistance training': 5.5,
  
  // Default fallback
  'default': 6.0
};

/**
 * Calculate calories burned for cardio exercise
 * @param {Object} params - Calculation parameters
 * @param {number} params.duration - Duration in minutes
 * @param {number} params.weight - User weight in kg
 * @param {string} params.exerciseName - Name of the exercise
 * @param {number} params.intensity - Intensity level (25-100)
 * @param {number} params.rounds - Number of rounds
 * @returns {number} Calories burned
 */
export const calculateCardioCalories = ({
  duration,
  weight,
  exerciseName,
  intensity = 50,
  rounds = 1
}) => {
  if (!duration || !weight) {
    return 0;
  }

  // Get MET value for the exercise
  const metValue = getMETValue(exerciseName);
  
  // Apply intensity multiplier (intensity is 25-100, convert to 0.5-2.0 multiplier)
  const intensityMultiplier = (intensity / 50);
  
  // Calculate calories using the standard formula:
  // Calories = MET × Weight(kg) × Time(hours) × Intensity
  const caloriesPerRound = metValue * weight * (duration / 60) * intensityMultiplier;
  
  // Multiply by number of rounds
  const totalCalories = caloriesPerRound * rounds;
  
  return Math.round(totalCalories);
};

/**
 * Calculate calories burned for HIIT workout
 * @param {Array} exercises - Array of exercise objects
 * @param {number} weight - User weight in kg
 * @param {number} intensity - Overall intensity level
 * @param {number} totalRounds - Total rounds of the workout
 * @returns {number} Total calories burned
 */
export const calculateHIITCalories = (exercises, weight, intensity = 50, totalRounds = 1) => {
  if (!exercises || exercises.length === 0 || !weight) {
    return 0;
  }

  let totalCalories = 0;
  
  exercises.forEach(exercise => {
    const duration = parseInt(exercise.duration) || 45; // seconds
    const rounds = parseInt(exercise.rounds) || 1;
    
    const exerciseCalories = calculateCardioCalories({
      duration: duration / 60, // convert to minutes
      weight,
      exerciseName: exercise.name,
      intensity,
      rounds: rounds * totalRounds
    });
    
    totalCalories += exerciseCalories;
  });
  
  return Math.round(totalCalories);
};

/**
 * Calculate calories burned for strength exercises
 * @param {Object} params - Calculation parameters
 * @param {number} params.duration - Duration in minutes
 * @param {number} params.weight - User weight in kg
 * @param {number} params.weightLifted - Total weight lifted in kg
 * @param {number} params.reps - Number of repetitions
 * @param {number} params.sets - Number of sets
 * @param {number} params.intensity - Intensity level
 * @returns {number} Calories burned
 */
export const calculateStrengthCalories = ({
  duration,
  weight,
  weightLifted = 0,
  reps = 0,
  sets = 1,
  intensity = 50
}) => {
  if (!duration || !weight) {
    return 0;
  }

  // Base MET for strength training
  const baseMET = 5.0;
  
  // Apply intensity multiplier
  const intensityMultiplier = (intensity / 50);
  
  // Calculate base calories
  const baseCalories = baseMET * weight * (duration / 60) * intensityMultiplier;
  
  // Add calories for weight lifted (0.05 calories per kg lifted)
  const weightCalories = weightLifted * 0.05;
  
  // Add calories for reps (0.1 calories per rep)
  const repCalories = reps * 0.1;
  
  const totalCalories = baseCalories + weightCalories + repCalories;
  
  return Math.round(Math.max(totalCalories, 3)); // minimum 3 calories
};

/**
 * Get MET value for exercise name
 * @param {string} exerciseName - Name of the exercise
 * @returns {number} MET value
 */
const getMETValue = (exerciseName) => {
  if (!exerciseName) return EXERCISE_METS.default;
  
  const name = exerciseName.toLowerCase();
  
  // Check for exact matches first
  if (EXERCISE_METS[name]) {
    return EXERCISE_METS[name];
  }
  
  // Check for partial matches
  for (const [key, value] of Object.entries(EXERCISE_METS)) {
    if (name.includes(key) || key.includes(name)) {
      return value;
    }
  }
  
  // Check for common exercise patterns
  if (name.includes('jump') || name.includes('burpee') || name.includes('mountain')) {
    return EXERCISE_METS['jumping jacks'];
  }
  
  if (name.includes('run') || name.includes('jog')) {
    return EXERCISE_METS.running;
  }
  
  if (name.includes('walk')) {
    return EXERCISE_METS.walking;
  }
  
  if (name.includes('cycle') || name.includes('bike')) {
    return EXERCISE_METS.cycling;
  }
  
  if (name.includes('swim')) {
    return EXERCISE_METS.swimming;
  }
  
  if (name.includes('hiit') || name.includes('tabata')) {
    return EXERCISE_METS.hiit;
  }
  
  // Default to moderate cardio
  return EXERCISE_METS.default;
};

/**
 * Calculate calories burned per minute for a given exercise
 * @param {string} exerciseName - Name of the exercise
 * @param {number} weight - User weight in kg
 * @param {number} intensity - Intensity level (25-100)
 * @returns {number} Calories per minute
 */
export const getCaloriesPerMinute = (exerciseName, weight, intensity = 50) => {
  const metValue = getMETValue(exerciseName);
  const intensityMultiplier = (intensity / 50);
  
  return Math.round(metValue * weight * (1/60) * intensityMultiplier * 10) / 10; // Round to 1 decimal
};

/**
 * Calculate total workout calories with rest periods
 * @param {Array} exercises - Array of exercise objects
 * @param {number} weight - User weight in kg
 * @param {number} intensity - Overall intensity level
 * @param {number} totalRounds - Total rounds
 * @param {number} restBetweenRounds - Rest time between rounds in seconds
 * @returns {Object} {totalCalories, exerciseCalories, restCalories}
 */
export const calculateTotalWorkoutCalories = (exercises, weight, intensity, totalRounds, restBetweenRounds = 0) => {
  if (!exercises || exercises.length === 0 || !weight) {
    return { totalCalories: 0, exerciseCalories: 0, restCalories: 0 };
  }

  let exerciseCalories = 0;
  let totalDuration = 0;
  
  exercises.forEach(exercise => {
    const duration = parseInt(exercise.duration) || 45;
    const rounds = parseInt(exercise.rounds) || 1;
    const exerciseTime = (duration / 60) * rounds * totalRounds; // minutes
    
    const calories = calculateCardioCalories({
      duration: exerciseTime,
      weight,
      exerciseName: exercise.name,
      intensity,
      rounds: 1
    });
    
    exerciseCalories += calories;
    totalDuration += exerciseTime;
  });
  
  // Calculate rest calories (very low MET value)
  const restTime = (restBetweenRounds / 60) * Math.max(0, totalRounds - 1);
  const restCalories = restTime > 0 ? Math.round(1.5 * weight * restTime) : 0; // 1.5 MET for light rest
  
  const totalCalories = exerciseCalories + restCalories;
  
  return {
    totalCalories: Math.round(totalCalories),
    exerciseCalories: Math.round(exerciseCalories),
    restCalories: Math.round(restCalories)
  };
};

export default {
  calculateCardioCalories,
  calculateHIITCalories,
  calculateStrengthCalories,
  getCaloriesPerMinute,
  calculateTotalWorkoutCalories,
  EXERCISE_METS
};