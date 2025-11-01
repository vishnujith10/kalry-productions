// utils/useTodaySteps.js - FIXED IMPORTS
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pedometer } from 'expo-sensors';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import supabase from '../lib/supabase';
import { calculateStepCalories } from './calorieCalculator';

const useTodaySteps = () => {
  const [stepsToday, setStepsToday] = useState(0);
  const [isPedometerAvailable, setIsPedometerAvailable] = useState(false);
  const [distanceKm, setDistanceKm] = useState(0);
  const [calories, setCalories] = useState(0);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState('Initializing...');
  const [diagnostics, setDiagnostics] = useState({
    pedometerSupported: false,
    permissionsGranted: false,
    sensorActive: false,
    lastEventTime: null,
    totalEvents: 0
  });
  const [userId, setUserId] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  // Step validation parameters - STRICTER to prevent false positives
  const STEP_COOLDOWN = 500; // 500ms between events (prevents small movements)
  const MIN_STEP_COUNT = 2; // Require at least 2 steps to filter out noise
  const MAX_STEPS_PER_EVENT = 3; // Cap at 3 steps per event (normal walking pace)

  const getTodayDateString = () => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  };

  const loadSavedSteps = async () => {
    try {
      const todayKey = `steps_${getTodayDateString()}`;
      const savedSteps = await AsyncStorage.getItem(todayKey);
      return savedSteps ? parseInt(savedSteps, 10) : 0;
    } catch (error) {
      console.log('Error loading saved steps:', error);
      return 0;
    }
  };

  const saveSteps = async (steps) => {
    try {
      const todayKey = `steps_${getTodayDateString()}`;
      await AsyncStorage.setItem(todayKey, steps.toString());
    } catch (error) {
      console.log('Error saving steps:', error);
    }
  };

  const saveStepsToDatabase = async (steps, distance, caloriesBurned, goalValue = null) => {
    if (!userId) return;
    
    try {
      const today = getTodayDateString();
      
      // Check if entry exists for today (use maybeSingle to avoid errors)
      const { data: existing } = await supabase
        .from('steps')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle();
      
      const upsertData = {
        user_id: userId,
        date: today,
        steps: steps,
        distance: distance,
        calories: caloriesBurned,
        updated_at: new Date().toISOString()
      };
      
      // Include goal if provided, or preserve existing goal
      if (goalValue !== null) {
        upsertData.goal = goalValue;
      } else if (existing?.goal) {
        upsertData.goal = existing.goal;
      }
      
      // Use UPSERT to avoid duplicate key errors
      const { error } = await supabase
        .from('steps')
        .upsert(upsertData, {
          onConflict: 'user_id,date'
        });
      
      if (error) {
        console.error('Error upserting steps:', error);
      }
    } catch (error) {
      console.error('Error saving steps to database:', error);
    }
  };

  const saveGoalToDatabase = async (goalValue) => {
    if (!userId) {
      console.log('No userId available, skipping database save');
      return false;
    }
    
    try {
      // Verify session is still valid
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('No active session, skipping database save');
        return false;
      }
      
      const today = getTodayDateString();
      
      // Check if entry exists for today
      const { data: existing, error: fetchError } = await supabase
        .from('steps')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle(); // Use maybeSingle instead of single to avoid error when not found
      
      if (fetchError) {
        console.error('Error fetching existing goal:', fetchError);
        // Continue anyway, try to insert
      }
      
      // Use UPSERT to avoid race condition and duplicate key errors
      const { error } = await supabase
        .from('steps')
        .upsert({
          user_id: userId,
          date: today,
          goal: goalValue,
          steps: existing?.steps || 0,
          distance: existing?.distance || 0,
          calories: existing?.calories || 0,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,date'
        });
      
      if (error) {
        console.error('Error upserting goal:', error);
        return false;
      }
      console.log('✅ Goal saved to database:', goalValue);
      
      return true;
    } catch (error) {
      console.error('Error saving goal to database:', error);
      // Don't return false immediately, the local save might still work
      return false;
    }
  };

  const loadGoalFromDatabase = async () => {
    if (!userId) return null;
    
    try {
      const today = getTodayDateString();
      const { data, error } = await supabase
        .from('steps')
        .select('goal')
        .eq('user_id', userId)
        .eq('date', today)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error loading goal from database:', error);
        return null;
      }
      
      return data?.goal || null;
    } catch (error) {
      console.error('Error loading goal from database:', error);
      return null;
    }
  };

  const loadStepsFromDatabase = async () => {
    if (!userId) return null;
    
    try {
      const today = getTodayDateString();
      const { data, error } = await supabase
        .from('steps')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('Error loading steps from database:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error loading steps from database:', error);
      return null;
    }
  };

  const updateStepMetrics = useCallback((newSteps) => {
    const distance = (newSteps * 0.762) / 1000;
    
    // Use personalized calorie calculation if profile available
    let caloriesBurned;
    if (userProfile?.weight && userProfile?.height) {
      caloriesBurned = calculateStepCalories(
        newSteps,
        userProfile.weight,
        userProfile.height,
        userProfile.age || 30,
        userProfile.gender || 'female'
      );
    } else {
      // Fallback to basic calculation
      caloriesBurned = newSteps * 0.04;
    }
    
    setDistanceKm(distance);
    setCalories(caloriesBurned);
    
    // Save to AsyncStorage on every update
    saveSteps(newSteps);
    
    // Save to database every step (to ensure data isn't lost on navigation)
    saveStepsToDatabase(newSteps, distance, caloriesBurned);
  }, [userId, userProfile]);

  // Get user ID and load initial data
  useEffect(() => {
    const initializeUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session?.user?.id;
        setUserId(currentUserId);
        
        if (currentUserId) {
          // Fetch user profile for personalized calorie calculation
          const { data: profileData } = await supabase
            .from('user_profile')
            .select('weight, height, age, gender')
            .eq('id', currentUserId)
            .single();
          
          if (profileData) {
            setUserProfile(profileData);
          }
          
          // Try to load from database first
          const today = getTodayDateString();
          const { data, error } = await supabase
            .from('steps')
            .select('*')
            .eq('user_id', currentUserId)
            .eq('date', today)
            .single();
          
          if (data && !error) {
            console.log('Loaded steps from database:', data.steps);
            setStepsToday(data.steps || 0);
            setDistanceKm(Number(data.distance) || 0);
            setCalories(Number(data.calories) || 0);
          }
        }
      } catch (error) {
        console.error('Error initializing user:', error);
      }
    };
    
    initializeUser();
  }, []);

  // FIXED: Simplified diagnostics (removed DeviceMotion and Accelerometer)
  const runDiagnostics = useCallback(async () => {
    console.log('🔍 Running pedometer diagnostics...');
    
    try {
      // Test only Pedometer (the main sensor we need)
      const pedometerAvailable = await Pedometer.isAvailableAsync();
      console.log('📱 Pedometer available:', pedometerAvailable);

      // Test permissions (Android)
      let permissionsGranted = true;
      if (Platform.OS === 'android') {
        try {
          const permissions = await Pedometer.getPermissionsAsync();
          permissionsGranted = permissions.granted;
          console.log('🔐 Permissions:', permissions);
        } catch (permError) {
          console.log('❌ Permission error:', permError);
          permissionsGranted = false;
        }
      }

      setDiagnostics({
        pedometerSupported: pedometerAvailable,
        permissionsGranted,
        sensorActive: false,
        lastEventTime: null,
        totalEvents: 0
      });

      return {
        pedometerAvailable,
        permissionsGranted
      };

    } catch (error) {
      console.error('💥 Diagnostics error:', error);
      setError(`Diagnostics failed: ${error.message}`);
      return null;
    }
  }, []);

  useEffect(() => {
    let subscription = null;
    let isComponentMounted = true;
    let isAppActive = true;
    let lastStepTime = 0;

    const initializePedometer = async () => {
      try {
        console.log('🚀 Initializing Simple Pedometer with Diagnostics');
        setDebugInfo('Running diagnostics...');
        
        // Run diagnostics
        const diagnosticResults = await runDiagnostics();
        if (!diagnosticResults) return;

        const { pedometerAvailable, permissionsGranted } = diagnosticResults;

        if (!isComponentMounted) return;
        
        setIsPedometerAvailable(pedometerAvailable);

        if (!pedometerAvailable) {
          setError(`Pedometer not supported on this ${Platform.OS} device`);
          setDebugInfo(`❌ Not supported on ${Platform.OS}`);
          
          // Load saved steps
          const savedSteps = await loadSavedSteps();
          setStepsToday(savedSteps);
          updateStepMetrics(savedSteps);
          return;
        }

        if (!permissionsGranted && Platform.OS === 'android') {
          setDebugInfo('Requesting permissions...');
          try {
            const requestResult = await Pedometer.requestPermissionsAsync();
            console.log('📝 Permission request result:', requestResult);
            
            if (!requestResult.granted) {
              setError('Motion tracking permission denied');
              setDebugInfo('❌ Permission denied');
              return;
            }
            
            // Update diagnostics
            setDiagnostics(prev => ({
              ...prev,
              permissionsGranted: true
            }));
          } catch (permError) {
            setError(`Permission error: ${permError.message}`);
            setDebugInfo('❌ Permission error');
            return;
          }
        }

        // Load saved steps
        const savedSteps = await loadSavedSteps();
        console.log('💾 Loaded saved steps:', savedSteps);
        setDebugInfo(`Loaded: ${savedSteps} steps`);
        
        if (isComponentMounted) {
          setStepsToday(savedSteps);
          updateStepMetrics(savedSteps);
        }

        // Setup step counter with ENHANCED LOGGING
        console.log('👂 Setting up ENHANCED step counter...');
        setDebugInfo('Starting step detection...');

        subscription = Pedometer.watchStepCount(stepResult => {
          const now = Date.now();
          console.log('🔥 RAW STEP EVENT RECEIVED:', {
            stepResult,
            timestamp: new Date().toLocaleTimeString(),
            timeSinceLastEvent: now - lastStepTime
          });
          
          // Update diagnostics
          setDiagnostics(prev => ({
            ...prev,
            sensorActive: true,
            lastEventTime: new Date().toLocaleTimeString(),
            totalEvents: prev.totalEvents + 1
          }));

          if (!isComponentMounted || !isAppActive) {
            console.log('🚫 Ignored - component unmounted or app inactive');
            return;
          }
          
          if (stepResult && typeof stepResult.steps === 'number') {
            const timeSinceLastStep = now - lastStepTime;
            
            console.log('🔍 Step validation:', {
              steps: stepResult.steps,
              timeSinceLastStep,
              minCount: MIN_STEP_COUNT,
              maxPerEvent: MAX_STEPS_PER_EVENT,
              cooldown: STEP_COOLDOWN
            });

            // Validation: minimum steps (filter noise)
            if (stepResult.steps < MIN_STEP_COUNT) {
              console.log('🚫 Filtered: too few steps (noise):', stepResult.steps);
              return;
            }
            
            // Validation: prevent duplicate/rapid-fire events and small movements
            if (timeSinceLastStep < STEP_COOLDOWN) {
              console.log('🚫 Filtered: too fast (small movement/noise):', timeSinceLastStep, 'ms');
              return;
            }

            // Use the actual step count from the sensor, but cap it
            // Normal walking pace: ~2 steps/second = 1 step per 500ms
            // This prevents both sensor errors and false positives from small movements
            let stepsToAdd = Math.min(stepResult.steps, MAX_STEPS_PER_EVENT);
            
            if (stepResult.steps > MAX_STEPS_PER_EVENT) {
              console.log('⚠️ Capping excessive steps:', stepResult.steps, '→', stepsToAdd);
            }
            
            // Extra validation: reject if steps seem unrealistic
            if (stepsToAdd > 3 && timeSinceLastStep < 1000) {
              console.log('🚫 Filtered: unrealistic step rate');
              return;
            }

            // VALID STEP DETECTED
            console.log('✅ VALID STEPS:', stepsToAdd, '(from sensor:', stepResult.steps, ')');
            lastStepTime = now;
            setDebugInfo(`✅ +${stepsToAdd} steps`);
            
            setStepsToday(prevSteps => {
              const newTotalSteps = prevSteps + stepsToAdd;
              console.log('📊 Total steps:', newTotalSteps);
              
              updateStepMetrics(newTotalSteps);
              setDebugInfo(`🚶‍♂️ ${newTotalSteps} steps`);
              
              return newTotalSteps;
            });
          } else {
            console.log('⚠️ Invalid step result format:', stepResult);
          }
        });

        // App state handling
        const handleAppStateChange = (nextAppState) => {
          console.log('📱 App state changed to:', nextAppState);
          isAppActive = nextAppState === 'active';
          
          if (nextAppState === 'active') {
            setDebugInfo('📱 App active - listening for steps');
          } else if (nextAppState === 'background') {
            setDebugInfo('📱 App background - may miss steps');
          }
        };

        const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

        console.log('✅ Enhanced pedometer initialized successfully');
        setDebugInfo('✅ Waiting for steps... Try walking!');

        return () => {
          if (subscription && typeof subscription.remove === 'function') {
            subscription.remove();
            console.log('🧹 Pedometer subscription removed');
          }
          if (appStateSubscription && typeof appStateSubscription.remove === 'function') {
            appStateSubscription.remove();
            console.log('🧹 App state subscription removed');
          }
        };

      } catch (err) {
        if (!isComponentMounted) return;
        
        console.error('💥 Pedometer initialization error:', err);
        setError(`Initialization failed: ${err.message}`);
        setDebugInfo(`💥 Error: ${err.message}`);
        
        try {
          const savedSteps = await loadSavedSteps();
          if (isComponentMounted) {
            setStepsToday(savedSteps);
            updateStepMetrics(savedSteps);
          }
        } catch (loadError) {
          console.error('Failed to load saved steps:', loadError);
        }
      }
    };

    initializePedometer();

    return () => {
      isComponentMounted = false;
    };
  }, [updateStepMetrics, runDiagnostics]);

  // Reset at midnight
  useEffect(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const timeUntilMidnight = tomorrow.getTime() - now.getTime();
    
    const resetTimer = setTimeout(() => {
      console.log('🌅 New day - resetting steps');
      setStepsToday(0);
      setDistanceKm(0);
      setCalories(0);
      saveSteps(0);
      setDebugInfo('🌅 New day - reset complete');
    }, timeUntilMidnight);

    return () => clearTimeout(resetTimer);
  }, []);

  const addTestSteps = useCallback((count = 1) => {
    console.log('🧪 MANUALLY ADDING TEST STEPS:', count);
    
    setStepsToday(prevSteps => {
      const newSteps = prevSteps + count;
      console.log('🧪 Test steps added:', count, '→ Total:', newSteps);
      
      updateStepMetrics(newSteps);
      setDebugInfo(`🧪 Test: ${newSteps} steps (manual)`);
      
      return newSteps;
    });
  }, [updateStepMetrics]);

  const resetSteps = useCallback(() => {
    console.log('🔄 RESETTING ALL STEPS');
    setStepsToday(0);
    setDistanceKm(0);
    setCalories(0);
    saveSteps(0);
    setDebugInfo('🔄 Reset complete - ready for new steps');
  }, []);

  const reloadStepsFromDatabase = useCallback(async () => {
    if (!userId) return;
    
    try {
      console.log('🔄 Reloading steps from database...');
      const today = getTodayDateString();
      const { data, error } = await supabase
        .from('steps')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .single();
      
      if (data && !error) {
        console.log('✅ Loaded steps from database:', data.steps);
        setStepsToday(data.steps || 0);
        setDistanceKm(Number(data.distance) || 0);
        setCalories(Number(data.calories) || 0);
      } else if (error && error.code === 'PGRST116') {
        // No record found - reset to 0
        console.log('ℹ️ No record found in database, resetting to 0');
        setStepsToday(0);
        setDistanceKm(0);
        setCalories(0);
      }
    } catch (error) {
      console.error('Error reloading steps:', error);
    }
  }, [userId]);

  const runFullDiagnostic = useCallback(() => {
    runDiagnostics();
    setDebugInfo('🔍 Running diagnostic check...');
  }, [runDiagnostics]);

  return { 
    stepsToday, 
    isPedometerAvailable, 
    distanceKm, 
    calories, 
    error,
    debugInfo,
    diagnostics,
    addTestSteps,
    resetSteps,
    reloadStepsFromDatabase,
    runFullDiagnostic,
    saveGoalToDatabase,
    loadGoalFromDatabase
  };
};

export default useTodaySteps;