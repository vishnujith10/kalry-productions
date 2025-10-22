import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { calculateCardioCalories } from '../utils/calorieCalculator';

const COLORS = {
  background: '#F9FAFB',
  card: '#FFFFFF',
  cardBorder: '#E5E7EB',
  text: '#181A20',
  textSecondary: '#6B7280',
  primary: '#22C55E',
  accent: '#F43F5E', // pink
  gray: '#B0B0B0',
};

const { width } = Dimensions.get('window');
const TIMER_SIZE = width * 0.7;
const STROKE_WIDTH = 12;
const RADIUS = (TIMER_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function CardioPlayerScreen({ route, navigation }) {
  const { session } = route.params;
  const exercises = session.exercises;
  const totalRounds = session.totalRounds || 1;
  const restBetweenRounds = session.restBetweenRounds || 0;
  const sessionName = session.name || 'Cardio Session';
  const [round, setRound] = useState(1);
  const [exerciseIdx, setExerciseIdx] = useState(0);
  const [timer, setTimer] = useState(parseInt(exercises[0]?.duration) || 0);
  const [isRest, setIsRest] = useState(false);
  const [running, setRunning] = useState(true);
  const [calories, setCalories] = useState(0);
  const [userWeight, setUserWeight] = useState(70); // Default 70kg
  const intervalRef = useRef();
  const [sound, setSound] = useState();

  // Preload sound
  useEffect(() => {
    if (!session.soundAlerts) return;
    let soundObj;
    async function loadSound() {
      // Use a dummy beep from a public domain CDN or fallback to no sound
      try {
        const { sound } = await Audio.Sound.createAsync({
          uri: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg'
        });
        setSound(sound);
        soundObj = sound;
      } catch (_e) {
        setSound(null);
      }
    }
    loadSound();
    return () => { try { soundObj && soundObj.unloadAsync && soundObj.unloadAsync(); } catch {} };
  }, [session.soundOption, session.soundAlerts]);

  // Fetch user weight for accurate calorie calculations
  useEffect(() => {
    fetchUserWeight();
  }, []);

  const fetchUserWeight = async () => {
    try {
      // Import supabase dynamically to avoid circular dependencies
      const supabase = require('../lib/supabase').default;
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
    } catch (error) {
      console.log('Could not fetch user weight, using default:', error);
    }
  };

  // Play sound and vibrate at transitions
  const playFeedback = async () => {
    if (session.soundAlerts && sound) {
      try { await sound.replayAsync(); } catch {}
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // Calculate total exercises per round
  const totalExercises = exercises.length;
  const currentExercise = exercises[exerciseIdx];
  const nextExercise = !isRest && exerciseIdx < exercises.length - 1
    ? exercises[exerciseIdx + 1]
    : (isRest && exerciseIdx < exercises.length ? exercises[exerciseIdx] : null);

  // Timer logic
  useEffect(() => {
    if (!running) return;
    if (!currentExercise) return;
    intervalRef.current = setInterval(() => {
      setTimer(t => {
        if (t <= 1) {
          clearInterval(intervalRef.current);
          handleNext();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line
  }, [exerciseIdx, round, isRest, running]);

  // Accurate calories calculation
  useEffect(() => {
    let total = 0;
    
    // Calculate calories for completed exercises in previous rounds
    for (let r = 1; r < round; r++) {
      exercises.forEach(exercise => {
        const duration = parseInt(exercise.duration) || 45;
        const rounds = parseInt(exercise.rounds) || 1;
        
        if (rounds >= r) {
          const exerciseCalories = calculateCardioCalories({
            duration: duration / 60, // convert to minutes
            weight: userWeight,
            exerciseName: exercise.name,
            intensity: 50, // Default intensity, could be passed from session
            rounds: 1
          });
          total += exerciseCalories;
        }
      });
    }
    
    // Calculate calories for current round (completed exercises only)
    for (let i = 0; i < exerciseIdx; i++) {
      const exercise = exercises[i];
      const duration = parseInt(exercise.duration) || 45;
      const rounds = parseInt(exercise.rounds) || 1;
      
      if (rounds >= round) {
        const exerciseCalories = calculateCardioCalories({
          duration: duration / 60, // convert to minutes
          weight: userWeight,
          exerciseName: exercise.name,
          intensity: 50, // Default intensity, could be passed from session
          rounds: 1
        });
        total += exerciseCalories;
      }
    }
    
    setCalories(Math.round(total));
  }, [exerciseIdx, round, userWeight, exercises]);

  const handleNext = async () => {
    await playFeedback();
    if (!isRest && exerciseIdx < exercises.length - 1) {
      setExerciseIdx(exerciseIdx + 1);
      setTimer(parseInt(exercises[exerciseIdx + 1]?.duration) || 0);
      setIsRest(false);
    } else if (!isRest && exerciseIdx === exercises.length - 1 && round < totalRounds) {
      // End of round, start rest between rounds
      if (restBetweenRounds > 0) {
        setIsRest(true);
        setTimer(restBetweenRounds);
      } else {
        setRound(round + 1);
        setExerciseIdx(0);
        setTimer(parseInt(exercises[0]?.duration) || 0);
        setIsRest(false);
      }
    } else if (isRest) {
      setRound(round + 1);
      setExerciseIdx(0);
      setTimer(parseInt(exercises[0]?.duration) || 0);
      setIsRest(false);
    } else {
      // End of session
      await playFeedback();
      navigation.goBack();
    }
  };

  // Timer ring progress
  const progress = timer / (isRest ? restBetweenRounds : parseInt(currentExercise?.duration) || 1);
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  return (
    <View style={styles.background}>
      {/* Header */}
      <View style={{ paddingTop: 32, paddingHorizontal: 24 }}>
        <Text style={styles.sessionName}>{sessionName}</Text>
        <Text style={styles.progressText}>
          Round {round} of {totalRounds} 7b7 Exercise {exerciseIdx + 1} of {totalExercises}
        </Text>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${((exerciseIdx + (round - 1) * totalExercises) / (totalExercises * totalRounds)) * 100}%` }]} />
        </View>
      </View>
      {/* Timer Ring */}
      <View style={styles.timerRingContainer}>
        <Svg width={TIMER_SIZE} height={TIMER_SIZE}>
          <Circle
            cx={TIMER_SIZE / 2}
            cy={TIMER_SIZE / 2}
            r={RADIUS}
            stroke={COLORS.cardBorder}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          <Circle
            cx={TIMER_SIZE / 2}
            cy={TIMER_SIZE / 2}
            r={RADIUS}
            stroke={COLORS.accent}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </Svg>
        <View style={styles.timerTextContainer}>
          <Text style={styles.timerText}>{String(timer).padStart(2, '0')}</Text>
        </View>
      </View>
      {/* Current Exercise Name and Image */}
      <Text style={styles.exerciseTitle}>{isRest ? 'Rest' : currentExercise?.name}</Text>
      {currentExercise?.img && !isRest && (
        <Image source={{ uri: currentExercise.img }} style={styles.exerciseImg} />
      )}
      {/* Next Exercise Preview */}
      {nextExercise && !isRest && (
        <View style={styles.nextExerciseCard}>
          {nextExercise.img ? (
            <Image source={{ uri: nextExercise.img }} style={styles.nextExerciseImg} />
          ) : (
            <View style={[styles.nextExerciseImg, { backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center' }]}> 
              <Ionicons name="image-outline" size={20} color={COLORS.gray} />
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.nextExerciseLabel}>Next Exercise</Text>
            <Text style={styles.nextExerciseName}>{nextExercise.name} - {nextExercise.duration}s</Text>
          </View>
        </View>
      )}
      {/* Controls */}
      <View style={styles.controlsRow}>
        <TouchableOpacity style={styles.controlBtn} onPress={() => setRunning(r => !r)}>
          <Ionicons name={running ? 'pause' : 'play'} size={20} color={COLORS.text} />
          <Text style={styles.controlBtnText}>{running ? 'Pause' : 'Resume'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn} onPress={handleNext}>
          <Ionicons name="play-skip-forward" size={20} color={COLORS.text} />
          <Text style={styles.controlBtnText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn} onPress={() => navigation.goBack()}>
          <Feather name="square" size={20} color={COLORS.text} />
          <Text style={styles.controlBtnText}>End</Text>
        </TouchableOpacity>
      </View>
      {/* Calories Burned */}
      <View style={styles.caloriesCard}>
        <MaterialCommunityIcons name="fire" size={20} color={COLORS.accent} style={{ marginRight: 8 }} />
        <Text style={styles.caloriesLabel}>Calories Burned</Text>
        <Text style={styles.caloriesValue}>~{calories} kcal</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: COLORS.background },
  sessionName: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginTop: 8 },
  progressText: { color: COLORS.textSecondary, fontSize: 15, marginTop: 2, marginBottom: 8 },
  progressBarBg: { height: 6, backgroundColor: COLORS.cardBorder, borderRadius: 3, marginVertical: 8, overflow: 'hidden' },
  progressBarFill: { height: 6, backgroundColor: COLORS.primary, borderRadius: 3 },
  timerRingContainer: { alignItems: 'center', justifyContent: 'center', marginVertical: 24 },
  timerTextContainer: { position: 'absolute', top: 0, left: 0, width: TIMER_SIZE, height: TIMER_SIZE, alignItems: 'center', justifyContent: 'center' },
  timerText: { fontSize: 56, fontWeight: '700', color: COLORS.text },
  exerciseTitle: { fontSize: 24, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginTop: 8, marginBottom: 8 },
  exerciseImg: { width: 180, height: 120, borderRadius: 16, alignSelf: 'center', marginBottom: 12, backgroundColor: COLORS.card },
  nextExerciseCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, padding: 12, marginHorizontal: 24, marginTop: 8, marginBottom: 16, borderWidth: 1, borderColor: COLORS.cardBorder },
  nextExerciseImg: { width: 48, height: 48, borderRadius: 8, backgroundColor: COLORS.card },
  nextExerciseLabel: { color: COLORS.textSecondary, fontSize: 13 },
  nextExerciseName: { color: COLORS.text, fontWeight: '600', fontSize: 15 },
  controlsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16, marginBottom: 16 },
  controlBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18, borderWidth: 1, borderColor: COLORS.cardBorder, marginHorizontal: 4 },
  controlBtnText: { color: COLORS.text, fontWeight: '600', fontSize: 16, marginLeft: 6 },
  caloriesCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginHorizontal: 24, marginTop: 8, borderWidth: 1, borderColor: COLORS.cardBorder, justifyContent: 'center' },
  caloriesLabel: { color: COLORS.textSecondary, fontSize: 15, marginRight: 8 },
  caloriesValue: { color: COLORS.text, fontWeight: '700', fontSize: 18 },
}); 