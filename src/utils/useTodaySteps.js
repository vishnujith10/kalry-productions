// utils/useTodaySteps.js - FIXED IMPORTS
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pedometer } from 'expo-sensors';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

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

  // More lenient step protection for testing
  const STEP_COOLDOWN = 100;
  const MIN_STEP_COUNT = 1;
  const MAX_STEP_BURST = 20;

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

  const updateStepMetrics = useCallback((newSteps) => {
    const distance = (newSteps * 0.762) / 1000;
    const caloriesBurned = newSteps * 0.04;
    
    setDistanceKm(distance);
    setCalories(caloriesBurned);
    
    if (newSteps % 5 === 0 || newSteps === 0) {
      saveSteps(newSteps);
    }
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
              maxBurst: MAX_STEP_BURST,
              cooldown: STEP_COOLDOWN
            });

            // VERY LENIENT filtering for testing
            if (stepResult.steps < MIN_STEP_COUNT) {
              console.log('🚫 Filtered: too few steps:', stepResult.steps);
              return;
            }
            
            if (stepResult.steps > MAX_STEP_BURST) {
              console.log('🚫 Filtered: too many steps at once:', stepResult.steps);
              return;
            }
            
            if (timeSinceLastStep < STEP_COOLDOWN) {
              console.log('🚫 Filtered: too fast:', timeSinceLastStep, 'ms');
              return;
            }

            // VALID STEP DETECTED
            console.log('🎉🎉🎉 VALID STEP DETECTED:', stepResult.steps);
            lastStepTime = now;
            setDebugInfo(`🎉 STEP DETECTED! +${stepResult.steps}`);
            
            setStepsToday(prevSteps => {
              const newTotalSteps = prevSteps + stepResult.steps;
              console.log('📊📊📊 TOTAL STEPS UPDATED:', newTotalSteps);
              
              updateStepMetrics(newTotalSteps);
              setDebugInfo(`🚶‍♂️ ${newTotalSteps} steps detected`);
              
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
    runFullDiagnostic
  };
};

export default useTodaySteps;
