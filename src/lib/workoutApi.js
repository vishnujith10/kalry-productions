import supabase from './supabase';
import { calculateStrengthCalories } from '../utils/calorieCalculator';

// Fetch all exercises, with comprehensive filtering options
export async function fetchExercises({ search, type, muscle, bodyPart, equipment } = {}) {
  console.log('fetchExercises called with:', { search, type, muscle, bodyPart, equipment });
  
  let query = supabase.from('exercise').select('*');
  
  // Apply filters only if they have values
  if (search && search.trim()) {
    console.log('Applying search filter:', search);
    query = query.ilike('name', `%${search}%`);
  }
  if (type && type.trim()) {
    console.log('Applying type filter:', type);
    query = query.ilike('type', `%${type}%`);
  }
  if (muscle && muscle.trim()) {
    console.log('Applying muscle filter:', muscle);
    query = query.or(`target_muscles.ilike.%${muscle}%,secondary_muscles.ilike.%${muscle}%`);
  }
  if (bodyPart && bodyPart.trim()) {
    console.log('Applying bodyPart filter:', bodyPart);
    query = query.ilike('body_parts', `%${bodyPart}%`);
  }
  if (equipment && equipment.trim()) {
    console.log('Applying equipment filter:', equipment);
    query = query.ilike('equipments', `%${equipment}%`);
  }
  
  console.log('Executing query...');
  const { data, error } = await query;
  
  if (error) {
    console.error('Database error:', error);
    throw error;
  }
  
  console.log('Query successful, returned:', data?.length || 0, 'exercises');
  if (data && data.length > 0) {
    console.log('First exercise sample:', data[0]);
  }
  
  return data;
}

// Save a workout, its exercises, and sets
export async function saveWorkout({ userId, date, duration, totalKcal, notes, exercises, isRoutine = false }) {
  console.log('Saving workout with data:', { userId, date, duration, totalKcal, exercises: exercises.length });
  
  // Fetch user profile for personalized calorie calculation
  let calculatedCalories = totalKcal;
  if (!totalKcal && duration) {
    try {
      const { data: profileData } = await supabase
        .from('user_profile')
        .select('weight')
        .eq('id', userId)
        .single();
      
      if (profileData?.weight) {
        const durationMinutes = duration / 60;
        calculatedCalories = calculateStrengthCalories(durationMinutes, profileData.weight, 'moderate');
        console.log('Calculated personalized workout calories:', calculatedCalories);
      }
    } catch (error) {
      console.error('Error fetching profile for calorie calculation:', error);
    }
  }
  
  // 1. Insert workout
  const { data: workout, error: workoutError } = await supabase
    .from('workouts')
    .insert({ 
      user_id: userId, 
      date, 
      duration, 
      total_kcal: calculatedCalories, 
      notes: isRoutine ? 'Saved Routine' : notes 
    })
    .select()
    .single();
  if (workoutError) {
    console.error('Workout insert error:', workoutError);
    throw workoutError;
  }

  console.log('Workout created:', workout.id);

  // 2. Insert workout_exercises and sets
  for (const [order, ex] of exercises.entries()) {
    console.log('Processing exercise:', ex.name || ex.workout, 'with', ex.sets.length, 'sets');
    
    // Calculate totals for the exercise
    const totalReps = ex.sets.reduce((sum, s) => sum + (parseInt(s.reps) || 0), 0);
    const totalWeight = ex.sets.reduce((sum, s) => sum + (parseFloat(s.weight) || 0), 0);
    
    const { data: workoutExercise, error: exError } = await supabase
      .from('daily_routine_exercises')
      .insert({
        workout_id: workout.id,
        exercise_id: ex.id || null, // Handle exercises without ID
        exercise_name: ex.name || ex.workout || 'Unknown Exercise',
        duration: ex.duration || 0, // Duration in seconds
        image_url: ex.gif_url || ex.image_url || null,
        body_parts: ex.body_parts || null, // Muscle groups worked
        date: date, // Date of workout
        order,
        total_sets: ex.sets.length,
        total_reps: totalReps,
        total_weight: totalWeight,
        total_kcal: ex.kcal || 0,
      })
      .select()
      .single();
    if (exError) {
      console.error('Workout exercise insert error:', exError);
      throw exError;
    }

    console.log('Workout exercise created:', workoutExercise.id);

    // Insert sets
    for (const [setNumber, set] of ex.sets.entries()) {
      console.log('Inserting set', setNumber + 1, 'for exercise:', ex.name || ex.workout);
      
      const setData = {
        workout_exercise_id: workoutExercise.id,
        set_number: setNumber + 1,
        reps: set.reps ? parseInt(set.reps) : null,
        weight: set.weight ? parseFloat(set.weight) : null,
        rpe: set.rpe || null,
        duration: set.duration || null,
        completed: set.completed || false,
        date: date, // Date of workout
      };

      // Add cardio-specific fields
      if (ex.type === 'Cardio') {
        setData.speed = set.speed ? parseFloat(set.speed) : null;
        setData.distance = set.distance ? parseFloat(set.distance) : null;
      }

      const { error: setError } = await supabase
        .from('sets')
        .insert(setData);
      if (setError) {
        console.error('Set insert error:', setError);
        throw setError;
      }
    }
  }
  
  console.log('Workout saved successfully:', workout.id);
  return workout;
}

// Update a workout, its exercises, and sets
export async function updateWorkout({ workoutId, userId, date, duration, totalKcal, notes, exercises, isRoutine = false }) {
  console.log('Updating workout with data:', { workoutId, userId, date, duration, totalKcal, exercises: exercises.length });

  // 1. Update workout main record
  const { error: workoutError } = await supabase
    .from('workouts')
    .update({
      user_id: userId,
      date,
      duration,
      total_kcal: totalKcal,
      notes: isRoutine ? 'Saved Routine' : notes
    })
    .eq('id', workoutId);
  if (workoutError) {
    console.error('Workout update error:', workoutError);
    throw workoutError;
  }

  // 2. Delete old routine exercises (and sets via cascade)
  const { error: deleteError } = await supabase
    .from('daily_routine_exercises')
    .delete()
    .eq('workout_id', workoutId);
  if (deleteError) {
    console.error('Workout exercises delete error:', deleteError);
    throw deleteError;
  }

  // 3. Insert new workout_exercises and sets
  for (const [order, ex] of exercises.entries()) {
    console.log('Processing exercise:', ex.name || ex.workout, 'with', ex.sets.length, 'sets');
    const totalReps = ex.sets.reduce((sum, s) => sum + (parseInt(s.reps) || 0), 0);
    const totalWeight = ex.sets.reduce((sum, s) => sum + (parseFloat(s.weight) || 0), 0);
    const { data: workoutExercise, error: exError } = await supabase
      .from('daily_routine_exercises')
      .insert({
        workout_id: workoutId,
        exercise_id: ex.id || null,
        exercise_name: ex.name || ex.workout || 'Unknown Exercise',
        duration: ex.duration || 0, // Duration in seconds
        image_url: ex.gif_url || ex.image_url || null,
        body_parts: ex.body_parts || null, // Muscle groups worked
        date: date, // Date of workout
        order,
        total_sets: ex.sets.length,
        total_reps: totalReps,
        total_weight: totalWeight,
        total_kcal: ex.kcal || 0,
      })
      .select()
      .single();
    if (exError) {
      console.error('Workout exercise insert error:', exError);
      throw exError;
    }
    for (const [setNumber, set] of ex.sets.entries()) {
      const setData = {
        workout_exercise_id: workoutExercise.id,
        set_number: setNumber + 1,
        reps: set.reps ? parseInt(set.reps) : null,
        weight: set.weight ? parseFloat(set.weight) : null,
        rpe: set.rpe || null,
        duration: set.duration || null,
        completed: set.completed || false,
        date: date, // Date of workout
      };
      if (ex.type === 'Cardio') {
        setData.speed = set.speed ? parseFloat(set.speed) : null;
        setData.distance = set.distance ? parseFloat(set.distance) : null;
      }
      const { error: setError } = await supabase
        .from('sets')
        .insert(setData);
      if (setError) {
        console.error('Set insert error:', setError);
        throw setError;
      }
    }
  }
  console.log('Workout updated successfully:', workoutId);
  return { id: workoutId };
}

// Fetch workout history for a user
export async function fetchWorkoutHistory(userId) {
  const { data, error } = await supabase
    .from('workouts')
    .select('*, daily_routine_exercises(*, sets(*), exercise(*))')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (error) throw error;
  return data;
}

// Fetch recent workouts for a user (last 10)
export async function fetchRecentWorkouts(userId) {
  const { data, error } = await supabase
    .from('workouts')
    .select(`
      *,
      daily_routine_exercises(
        *,
        sets(*),
        exercise(*)
      )
    `)
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(10);
  if (error) throw error;
  return data;
}

// Fetch saved routines for a user
export async function fetchSavedRoutines(userId) {
  const { data, error } = await supabase
    .from('workouts')
    .select(`
      *,
      daily_routine_exercises(
        *,
        sets(*),
        exercise(*)
      )
    `)
    .eq('user_id', userId)
    .eq('notes', 'Saved Routine')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
} 

// Delete a workout and its related data
export async function deleteWorkout(workoutId) {
  const { error } = await supabase
    .from('workouts')
    .delete()
    .eq('id', workoutId);
  if (error) {
    console.error('Workout delete error:', error);
    throw error;
  }
  return { id: workoutId };
} 