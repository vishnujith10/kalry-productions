import supabase from './supabase';

// Save a cardio session and its exercises
export async function saveCardioSession({
  userId,
  name,
  totalRounds,
  restBetweenRounds,
  soundAlerts,
  soundOption,
  autoRepeat,
  notes,
  estimatedTime,
  estimatedCalories,
  exercises // [{exercise_id, exercise_name, duration, rest, image_url, order_index}]
}) {
  // 1. Insert session
  const { data: session, error: sessionError } = await supabase
    .from('saved_cardio_sessions')
    .insert([{
      user_id: userId,
      name,
      total_rounds: totalRounds,
      rest_between_rounds: restBetweenRounds,
      sound_alerts: soundAlerts,
      sound_option: soundOption,
      auto_repeat: autoRepeat,
      notes,
      estimated_time: estimatedTime,
      estimated_calories: estimatedCalories,
    }])
    .select()
    .single();

  if (sessionError) throw sessionError;

  // 2. Insert exercises
  const exercisesWithSessionId = exercises.map((ex, idx) => ({
    session_id: session.id,
    exercise_id: ex.exercise_id || null,
    exercise_name: ex.exercise_name,
    duration: ex.duration,
    rest: ex.rest,
    order_index: idx + 1,
    image_url: ex.image_url || null,
  }));

  const { error: exError } = await supabase
    .from('saved_cardio_exercises')
    .insert(exercisesWithSessionId);

  if (exError) throw exError;

  return session;
}

// Load all cardio sessions for a user (with exercises)
export async function loadCardioSessions(userId) {
  // 1. Get sessions
  const { data: sessions, error } = await supabase
    .from('saved_cardio_sessions')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;

  // 2. For each session, get exercises
  for (const session of sessions) {
    const { data: exercises } = await supabase
      .from('saved_cardio_exercises')
      .select('*')
      .eq('session_id', session.id)
      .order('order_index', { ascending: true });
    session.exercises = exercises;
  }

  return sessions;
}

export async function deleteCardioSession(sessionId) {
  const { error } = await supabase
    .from('saved_cardio_sessions')
    .delete()
    .eq('id', sessionId);
  if (error) throw error;
}

// Update a cardio session and its exercises
export async function updateCardioSession({
  sessionId,
  name,
  totalRounds,
  restBetweenRounds,
  soundAlerts,
  soundOption,
  autoRepeat,
  notes,
  estimatedTime,
  estimatedCalories,
  exercises // [{exercise_id, exercise_name, duration, rest, image_url, order_index}]
}) {
  // 1. Update session
  const { error: sessionError } = await supabase
    .from('saved_cardio_sessions')
    .update({
      name,
      total_rounds: totalRounds,
      rest_between_rounds: restBetweenRounds,
      sound_alerts: soundAlerts,
      sound_option: soundOption,
      auto_repeat: autoRepeat,
      notes,
      estimated_time: estimatedTime,
      estimated_calories: estimatedCalories,
    })
    .eq('id', sessionId);
  if (sessionError) throw sessionError;

  // 2. Delete old exercises
  await supabase
    .from('saved_cardio_exercises')
    .delete()
    .eq('session_id', sessionId);

  // 3. Insert new exercises
  const exercisesWithSessionId = exercises.map((ex, idx) => ({
    session_id: sessionId,
    exercise_id: ex.exercise_id || null,
    exercise_name: ex.exercise_name,
    duration: ex.duration,
    rest: ex.rest,
    order_index: idx + 1,
    image_url: ex.image_url || null,
  }));
  const { error: exError } = await supabase
    .from('saved_cardio_exercises')
    .insert(exercisesWithSessionId);
  if (exError) throw exError;
} 