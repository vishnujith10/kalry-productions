import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useContext, useEffect, useState } from 'react';
import { Alert, BackHandler, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KalryAlgorithmManager } from '../algorithms/KalryAlgorithmManager';
import { DailyCheckInModal } from '../components/DailyCheckInModal';
import { OnboardingContext } from '../context/OnboardingContext';
import supabase from '../lib/supabase';
import { deleteFoodLog, getFoodLogs } from '../utils/api';
import { getMainDashboardCache, invalidateMainDashboardCache, updateMainDashboardCacheOptimistic } from '../utils/cacheManager';
import useTodaySteps from '../utils/useTodaySteps';
import RecentMeals from './RecentMeals';

// Use centralized cache
const globalCache = getMainDashboardCache();

// Export for backward compatibility
export { invalidateMainDashboardCache, updateMainDashboardCacheOptimistic as updateMainDashboardCache };

const COLORS = {
  primary: '#7B61FF',
  primaryLight: '#F3F0FF',
  text: '#6B4EFF',
  secondary: '#4B5563',
  muted: '#9CA3AF',
  placeholder: '#D1D5DB',
  background: '#F9FAFB',
  card: '#FFFFFF',
  border: '#E5E7EB',
  streak: '#7B61FF',
  streakBg: '#F3F0FF',
  water: '#7B61FF',
  weight: '#7B61FF',
  coins: '#7B61FF',
  rituals: '#7B61FF',
};
const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
const RADIUS = { sm: 6, md: 12, lg: 24, xl: 32, full: 9999 };
const SHADOW = { md: { shadowColor: '#7B61FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 4 } };

// --- Kalry Calorie Calculation System ---
function calculateBMR(gender, weight_kg, height_cm, age) {
  return gender === 'male'
    ? 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
    : 10 * weight_kg + 6.25 * height_cm - 5 * age - 161;
}
function calculateTDEE(bmr, activity_level) {
  const multiplier = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    very: 1.725,
    extra: 1.9
  };
  return bmr * (multiplier[activity_level] || 1.2);
}
function adjustForGoal(tdee, goal) {
  switch (goal) {
    case 'lose': return tdee * 0.85;
    case 'gain': return tdee * 1.10;
    default: return tdee;
  }
}
function getMacroTargets(calories) {
  return {
    protein_g: Math.round((calories * 0.3) / 4),
    fat_g: Math.round((calories * 0.3) / 9),
    carbs_g: Math.round((calories * 0.4) / 4)
  };
}
function getMinCalories(gender) {
  return gender === 'male' ? 1500 : 1200;
}
// --- End Calorie Calculation System ---

// Add a list of quotes for daily rotation
const QUOTES = [
  'Discipline is remembering what you want.',
  'Small steps every day.',
  'Progress, not perfection.',
  'You are stronger than you think.',
  'Consistency is key.',
  'Your only limit is you.',
  'Stay positive, work hard, make it happen.',
  'Every day is a fresh start.',
  'Believe in yourself.',
  'Success is the sum of small efforts.'
];

const getTodaysQuote = () => {
  const day = new Date().getDate();
  return QUOTES[day % QUOTES.length];
};

// Add FooterBar component before MainDashboardScreen
const FooterBar = ({ navigation, activeTab }) => {
  const tabs = [
    {
      key: 'Home',
      label: 'Home',
      icon: <Ionicons name="home-outline" size={24} color={activeTab === 'Home' ? '#7B61FF' : '#232B3A'} />,
      route: 'MainDashboard',
    },
    
    {
      key: 'Meals',
      label: 'Meals',
      icon: <Ionicons name="restaurant-outline" size={24} color={activeTab === 'Meals' ? '#232B3A' : '#232B3A'} />, // icon size 24
      route: 'Home',
    },
    {
      key: 'Workout',
      label: 'Workout',
      icon: <Ionicons name="barbell-outline" size={24} color={activeTab === 'Workout' ? '#7B61FF' : '#232B3A'} />,
      route: 'Exercise',
    },
    {
      key: 'Profile',
      label: 'Profile',
      icon: <Ionicons name="person-outline" size={24} color={activeTab === 'Profile' ? '#7B61FF' : '#232B3A'} />,
      route: 'Profile',
    },
  ];

  return (
    <View style={footerStyles.container}>
      <View style={footerStyles.ovalFooter}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[
              footerStyles.tab,
              tab.key === activeTab && footerStyles.activeTab
            ]}
            onPress={() => {
              // Don't navigate if already on active tab
              if (tab.key === activeTab) return;
              
              navigation.navigate(tab.route);
            }}
            activeOpacity={0.7}
          >
            {React.cloneElement(tab.icon, {
              color: tab.key === activeTab ? '#7B61FF' : '#232B3A',
            })}
            <Text
              style={[
                footerStyles.label,
                tab.key === activeTab && footerStyles.activeLabel
              ]}
            >
              {tab.label}
            </Text>
            {tab.key === activeTab && <View style={footerStyles.activeIndicator} />}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const footerStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: Platform.OS === 'ios' ? 20 : 16,
    backgroundColor: 'transparent',
    alignItems: 'center',
    zIndex: 100,
  },
  ovalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 35,
    paddingVertical: 16,
    paddingHorizontal: 20,
    shadowColor: '#7B61FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 16,
    // Add backdrop filter effect for iOS
    ...(Platform.OS === 'ios' && {
      backgroundColor: 'rgba(255, 255, 255, 0.85)',
    }),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    position: 'relative',
  },
  activeTab: {
    // Additional styling for active tab if needed
  },
  label: {
    fontSize: 12,
    marginTop: 4,
    color: '#232B3A',
    letterSpacing: 0.1,
    fontWeight: '500',
  },
  activeLabel: {
    color: '#7B61FF',
    fontWeight: '600',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -12,
    width: 30,
    height: 3,
    backgroundColor: '#7B61FF',
    borderRadius: 2,
  },
});

const MainDashboardScreen = ({ route }) => {
  const navigation = useNavigation();
  const { onboardingData, setOnboardingData } = useContext(OnboardingContext);
  const userName = onboardingData?.name || 'Aanya';
  const { stepsToday, distanceKm, calories: stepCalories, isPedometerAvailable } = useTodaySteps();
  const stepGoal = onboardingData?.step_goal || 10000;

  // Algorithm integration state
  const [algorithmManager, setAlgorithmManager] = useState(null);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [dailyPlan, setDailyPlan] = useState(null);
  
  // Daily check-in flow state
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);
  const [hasSeenModalToday, setHasSeenModalToday] = useState(false);
  const [todaysCheckInData, setTodaysCheckInData] = useState(null);
  const [showGoalsModal, setShowGoalsModal] = useState(false);

  // Handle back button - double tap to exit (ONLY on MainDashboardScreen)
  useEffect(() => {
    let backButtonPressed = 0;
    const backAction = () => {
      // Only handle back button on MainDashboardScreen
      if (navigation.getState().routes[navigation.getState().index].name === 'MainDashboard') {
        backButtonPressed++;
        if (backButtonPressed === 1) {
          // First press - do nothing, just reset after 2 seconds
          setTimeout(() => {
            backButtonPressed = 0;
          }, 2000);
          return true; // Prevent default back action
        } else if (backButtonPressed === 2) {
          // Second press within 2 seconds - exit app
          BackHandler.exitApp();
          return true;
        }
        return true;
      }
      // For other screens, allow normal navigation
      return false;
    };

    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, [navigation]);

  // Memoize expensive calculations (Instagram pattern)
  const percent = React.useMemo(() => 
    Math.round((stepsToday / stepGoal) * 100),
    [stepsToday, stepGoal]
  );

  // State for real food log data - Initialize with cached data if available (Instagram pattern)
  const [calories, setCalories] = useState(() => globalCache.cachedData?.calories || 0);
  const [mealsLogged, setMealsLogged] = useState(() => globalCache.cachedData?.mealsLogged || 0);
  const [lastSleepDuration, setLastSleepDuration] = useState('--');
  const [recentMeals, setRecentMeals] = useState(() => globalCache.cachedData?.recentMeals || []);
  const [todayWorkouts, setTodayWorkouts] = useState(() => globalCache.cachedData?.todayWorkouts || 0);

  // --- Weight Journey State ---
  const [currentWeight, setCurrentWeight] = useState(null);
  const [goalWeight, setGoalWeight] = useState(null);
  const [progress, setProgress] = useState(0);

  const [realUserId, setRealUserId] = useState(null);
  
  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: { user } } = await supabase.auth.getUser();
      setRealUserId(user?.id);
    };
    getUser();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      // Fetch latest sleep log
      const fetchLastSleep = async () => {
        if (!realUserId) return;
        const { data, error } = await supabase
          .from('sleep_logs')
          .select('*')
          .eq('user_id', realUserId)
          .order('date', { ascending: false })
          .limit(1);
        if (data && data[0]) {
          const log = data[0];
          // Calculate duration
          const [sh, sm] = log.start_time.split(':').map(Number);
          const [eh, em] = log.end_time.split(':').map(Number);
          let mins = (eh * 60 + em) - (sh * 60 + sm);
          if (mins < 0) mins += 24 * 60;
          setLastSleepDuration(`${Math.floor(mins / 60)}h ${mins % 60}m`);
        } else {
          setLastSleepDuration('--');
        }
      };
      fetchLastSleep();

      // --- Fetch Weight Data ---
      const fetchWeightData = async () => {
        if (!realUserId) return;
        // Fetch user profile for goal weight
        const { data: profile } = await supabase
          .from('user_profile')
          .select('weight, target_weight')
          .eq('id', realUserId)
          .single();
        if (profile) {
          setGoalWeight(Number(profile.target_weight) || 0);
        }
        // Fetch latest weight log
        const { data: logs } = await supabase
          .from('weight_logs')
          .select('weight')
          .eq('user_id', realUserId)
          .order('date', { ascending: false })
          .limit(1);
        let latestWeight = profile?.weight || 0;
        if (logs && logs.length > 0) {
          latestWeight = Number(logs[0].weight);
        }
        setCurrentWeight(latestWeight);
        // Calculate progress
        if (profile && profile.target_weight && latestWeight) {
          const start = Number(profile.weight) || latestWeight;
          const goal = Number(profile.target_weight);
          let prog = 0;
          if (start !== goal) {
            prog = (start - latestWeight) / (start - goal);
            prog = Math.max(0, Math.min(1, prog));
          }
          setProgress(prog);
        } else {
          setProgress(0);
        }
      };
      fetchWeightData();
    }, [realUserId])
  );

  useEffect(() => {
    const fetchUserProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { data: profile } = await supabase
          .from('user_profile')
          .select('name, weight, target_weight')
          .eq('id', session.user.id)
          .single();
        if (profile) {
          setOnboardingData((prev) => ({
            ...prev,
            name: profile.name || prev.name,
            weight: profile.weight || prev.weight,
            target_weight: profile.target_weight || prev.target_weight,
          }));
        }
      }
    };
    if (!onboardingData?.weight || !onboardingData?.target_weight) {
      fetchUserProfile();
    }
  }, [onboardingData?.weight, onboardingData?.target_weight, setOnboardingData]);

  // Extract user data from onboardingData (with fallback defaults)
  const age = Number(onboardingData?.age) || 25;
  const gender = (onboardingData?.gender || 'female').toLowerCase();
  const weight_kg = Number(onboardingData?.weight) || 60;
  const height_cm = Number(onboardingData?.height) || 165;
  const activity_level = (onboardingData?.daily_activity_level || 'moderate').toLowerCase();
  let goal_type = (onboardingData?.goal_focus || 'maintain').toLowerCase();
  if (goal_type.includes('lose')) goal_type = 'lose';
  else if (goal_type.includes('gain')) goal_type = 'gain';
  else goal_type = 'maintain';

  // Calculate calorie details
  const bmr = calculateBMR(gender, weight_kg, height_cm, age);
  const tdee = calculateTDEE(bmr, activity_level);
  let calorie_goal = adjustForGoal(tdee, goal_type);
  const minCalories = getMinCalories(gender);
  if (calorie_goal < minCalories) calorie_goal = minCalories;
  calorie_goal = Math.round(calorie_goal);
  const macro_targets = getMacroTargets(calorie_goal);

  // For untracked stats, set to null or 0
  const ritualStreak = null;
  const mood = onboardingData?.mood || null;
  const calmMinutes = null;
  const calmStreak = null;
  const workouts = null;
  const workoutGoal = null;
  const sleep = null;
  const water = null;
  const waterGoal = null;
  const coins = null;
  const rewards = null;
  const ritualsDone = null;
  const ritualsTotal = null;
  const nextRitual = null;
  const quote = getTodaysQuote();

  const weight = Number(onboardingData?.weight) || 0;
  const weightGoal = Number(onboardingData?.target_weight) || 0;

  // Add a handler for deleting a meal from recentMeals
  const handleDeleteMeal = async (index) => {
    try {
      const mealToDelete = recentMeals[index];
      if (!mealToDelete || !mealToDelete.id) return;
      await deleteFoodLog(mealToDelete.id);
      // Refetch logs to update calories, mealsLogged, and recentMeals
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      const logs = await getFoodLogs(session.user.id);
      // Filter logs for today
      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);
      const filteredLogs = logs.filter(log => {
        const logDate = new Date(log.created_at);
        return logDate >= startOfDay && logDate <= endOfDay;
      });
      setRecentMeals(filteredLogs.slice(-5).reverse());
      setMealsLogged(filteredLogs.length);
      setCalories(filteredLogs.reduce((sum, log) => sum + (log.calories || 0), 0));
    } catch (error) {
      console.error('Error deleting meal:', error);
      Alert.alert('Error', 'Failed to delete meal.');
    }
  };

  // Helper to normalize date string (handles 'YYYY-MM-DD' and 'YYYY-MM-DDTHH:MM:SSZ')
  function getDateOnly(str) {
    return str ? str.slice(0, 10) : '';
  }
  // Helper to convert interval (e.g., '08:30:00') to '8h 30m'
  function parseIntervalToDisplay(interval) {
    if (!interval || typeof interval !== 'string') return '--';
    const clean = interval.trim();
    if (!clean.includes(':')) return '--';
    const [h, m, s] = clean.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return '--';
    return `${h}h ${m}m`;
  }
  // Helper to convert interval to total minutes
  function parseIntervalToMinutes(interval) {
    if (!interval || typeof interval !== 'string') return 0;
    const clean = interval.trim();
    if (!clean.includes(':')) return 0;
    const [h, m, s] = clean.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return 0;
    return h * 60 + m;
  }
  // Sleep goal (hours) - will be fetched from database
  const [sleepGoal, setSleepGoal] = useState(() => globalCache.cachedData?.sleepGoal || 8);
  // Find today's sleep log for the user
  const todayStr = new Date().toISOString().slice(0,10);
  const [todaySleepLog, setTodaySleepLog] = useState(() => globalCache.cachedData?.todaySleepLog || null);
  const [sleepLogs, setSleepLogs] = useState(() => globalCache.cachedData?.sleepLogs || []);
  useFocusEffect(
    React.useCallback(() => {
        if (!realUserId) return;
      
      const now = Date.now();
      const timeSinceLastFetch = now - globalCache.lastFetchTime;
      const isStale = timeSinceLastFetch > globalCache.STALE_TIME;
      const isFresh = timeSinceLastFetch < globalCache.CACHE_DURATION;
      
      // SWR Pattern: Stale-While-Revalidate (like Instagram)
      if (globalCache.cachedData && isFresh) {
        // Data is fresh - use cache, no revalidation needed
        // Always restore from cache when fresh (not just first time)
        setRecentMeals(globalCache.cachedData.recentMeals || []);
        setMealsLogged(globalCache.cachedData.mealsLogged || 0);
        setCalories(globalCache.cachedData.calories || 0);
        setSleepLogs(globalCache.cachedData.sleepLogs || []);
        setTodaySleepLog(globalCache.cachedData.todaySleepLog || null);
        if (globalCache.cachedData.sleepGoal) setSleepGoal(globalCache.cachedData.sleepGoal);
        setTodayWorkouts(globalCache.cachedData.todayWorkouts || 0);
        globalCache.cacheHits++;
        return; // Fresh cache - no fetch needed
      }
      
      if (globalCache.cachedData && isStale && !isFresh) {
        // Data is stale but within cache duration - show stale, revalidate in background
        // Always restore from cache (not just first time)
        setRecentMeals(globalCache.cachedData.recentMeals || []);
        setMealsLogged(globalCache.cachedData.mealsLogged || 0);
        setCalories(globalCache.cachedData.calories || 0);
        setSleepLogs(globalCache.cachedData.sleepLogs || []);
        setTodaySleepLog(globalCache.cachedData.todaySleepLog || null);
        if (globalCache.cachedData.sleepGoal) setSleepGoal(globalCache.cachedData.sleepGoal);
        setTodayWorkouts(globalCache.cachedData.todayWorkouts || 0);
        globalCache.cacheHits++;
        // Continue to fetch fresh data in background (don't return)
      }
      
      // Prevent concurrent fetches
      if (globalCache.isFetching) return;
      
      globalCache.isFetching = true;
      globalCache.cacheMisses++;
      
      const fetchAllData = async () => {
        try {
          const today = new Date();
          const startOfDay = new Date(today).setHours(0, 0, 0, 0);
          const endOfDay = new Date(today).setHours(23, 59, 59, 999);
          const todayStr = today.toISOString().slice(0, 10);
          
          const [foodLogs, sleepData, cardioData, routineData] = await Promise.all([
            getFoodLogs(realUserId),
            supabase.from('sleep_logs').select('*').eq('user_id', realUserId).order('date', { ascending: false }).limit(7),
            supabase.from('saved_cardio_sessions').select('id').eq('user_id', realUserId).gte('created_at', new Date(startOfDay).toISOString()).lte('created_at', new Date(endOfDay).toISOString()),
            supabase.from('workouts').select('id').eq('user_id', realUserId).gte('created_at', new Date(startOfDay).toISOString()).lte('created_at', new Date(endOfDay).toISOString())
          ]);
          
          // Process food logs
          const filteredLogs = foodLogs.filter(log => {
            const logDate = new Date(log.created_at).getTime();
            return logDate >= startOfDay && logDate <= endOfDay;
          });
          setRecentMeals(filteredLogs.slice(-5).reverse());
          setMealsLogged(filteredLogs.length);
          setCalories(filteredLogs.reduce((sum, log) => sum + (log.calories || 0), 0));
          
          // Process sleep logs
          if (sleepData.data) {
            setSleepLogs(sleepData.data);
            const todayLog = sleepData.data.find(l => l.date?.slice(0, 10) === todayStr);
        setTodaySleepLog(todayLog || null);
            if (sleepData.data[0]?.sleep_goal) setSleepGoal(sleepData.data[0].sleep_goal);
          }
          
          // Process workouts
          const workoutsCount = (cardioData.data?.length || 0) + (routineData.data?.length || 0);
          setTodayWorkouts(workoutsCount);
          
          // Cache the data
          globalCache.cachedData = {
            recentMeals: filteredLogs.slice(-5).reverse(),
            mealsLogged: filteredLogs.length,
            calories: filteredLogs.reduce((sum, log) => sum + (log.calories || 0), 0),
            sleepLogs: sleepData.data || [],
            todaySleepLog: sleepData.data?.find(l => l.date?.slice(0, 10) === todayStr) || null,
            sleepGoal: sleepData.data?.[0]?.sleep_goal || 8,
            todayWorkouts: workoutsCount,
          };
          
          // Update cache timestamp
          globalCache.lastFetchTime = Date.now();
        } catch (error) {
          // Silent error handling
        } finally {
          globalCache.isFetching = false;
        }
      };
      
      fetchAllData();
    }, [realUserId])
  );
  let todaySleepDuration = '--';
  let todaySleepPercent = 0;
  if (todaySleepLog && todaySleepLog.duration) {
    todaySleepDuration = parseIntervalToDisplay(todaySleepLog.duration);
    const mins = parseIntervalToMinutes(todaySleepLog.duration);
    todaySleepPercent = sleepGoal > 0 ? Math.min(100, Math.round((mins / (sleepGoal * 60)) * 100)) : 0;
  }

  // Initialize hydration state with cached data (Instagram pattern)
  const [currentIntake, setCurrentIntake] = useState(() => globalCache.cachedHydrationData?.currentIntake || 0);
  const [dailyGoal, setDailyGoal] = useState(() => globalCache.cachedHydrationData?.dailyGoal || 2.5);
  const [intake1, setIntake1] = useState(() => globalCache.cachedHydrationData?.intake1 || 250);
  const [intake2, setIntake2] = useState(() => globalCache.cachedHydrationData?.intake2 || 500);
  const [hydrationLoading, setHydrationLoading] = useState(() => !globalCache.cachedHydrationData);
  const [hydrationRecordId, setHydrationRecordId] = useState(() => globalCache.cachedHydrationData?.hydrationRecordId || null);

  useFocusEffect(
    React.useCallback(() => {
      if (!realUserId) return;
      
      // Check cache - skip fetch if data is fresh
      const now = Date.now();
      if (now - globalCache.lastHydrationFetch < globalCache.CACHE_DURATION && globalCache.cachedHydrationData) {
        // Restore hydration state from cache
        setCurrentIntake(globalCache.cachedHydrationData.currentIntake);
        setDailyGoal(globalCache.cachedHydrationData.dailyGoal);
        setIntake1(globalCache.cachedHydrationData.intake1);
        setIntake2(globalCache.cachedHydrationData.intake2);
        setHydrationRecordId(globalCache.cachedHydrationData.hydrationRecordId);
        setHydrationLoading(false);
        return; // Use cached data
      }
      
    const fetchHydration = async () => {
      const today = new Date().toISOString().slice(0, 10);
        const { data } = await supabase
        .from('daily_water_intake')
        .select('*')
          .eq('user_id', realUserId)
        .eq('date', today)
        .single();
        
      if (data) {
        setCurrentIntake(data.current_intake_ml / 1000);
        setDailyGoal(data.daily_goal_ml / 1000);
        setIntake1(data.intake1_ml || 250);
        setIntake2(data.intake2_ml || 500);
          setHydrationRecordId(data.id);
        } else {
          await createTodayHydrationRecord(realUserId, today);
          setCurrentIntake(0);
          setDailyGoal(2.5);
          setIntake1(250);
          setIntake2(500);
      }
      setHydrationLoading(false);
        
        // Cache hydration data
        globalCache.cachedHydrationData = {
          currentIntake: data ? data.current_intake_ml / 1000 : 0,
          dailyGoal: data ? data.daily_goal_ml / 1000 : 2.5,
          intake1: data?.intake1_ml || 250,
          intake2: data?.intake2_ml || 500,
          hydrationRecordId: data?.id || null,
        };
        
        // Update cache timestamp
        globalCache.lastHydrationFetch = Date.now();
    };
    fetchHydration();
    }, [realUserId])
  );

  // Initialize algorithm manager
  useEffect(() => {
    if (realUserId && onboardingData) {
      const userProfile = {
        weight: onboardingData.weight || 70,
        height: onboardingData.height || 170,
        age: onboardingData.age || 25,
        gender: onboardingData.gender || 'male',
        activityLevel: onboardingData.activity_level || 'moderate',
        goal: onboardingData.goal || 'weightLoss',
        medicalConditions: [],
        medications: [],
        isBreastfeeding: false,
        menstrualCycle: null,
        history: [],
        weightHistory: []
      };
      
      console.log('Creating algorithm manager with userProfile:', userProfile);
      
      const manager = new KalryAlgorithmManager(userProfile);
      setAlgorithmManager(manager);
      
      // Start daily routine
      startDailyRoutine(manager);
    }
  }, [realUserId, onboardingData]);

  // Daily check-in flow management
  useEffect(() => {
    checkDailyCheckInStatus();
  }, []);

  const checkDailyCheckInStatus = async () => {
    try {
      const today = new Date().toDateString();
      const checkInData = await AsyncStorage.getItem(`dailyCheckIn_${today}`);
      const seenModalData = await AsyncStorage.getItem(`seenModal_${today}`);
      
      if (checkInData) {
        const parsedData = JSON.parse(checkInData);
        setHasCheckedInToday(true);
        setTodaysCheckInData(parsedData);
      }
      
      if (seenModalData) {
        setHasSeenModalToday(true);
      }
      
      // Auto-open modal only if user hasn't checked in AND hasn't seen modal today
      if (!checkInData && !seenModalData) {
        setShowCheckIn(true);
      }
    } catch (error) {
      console.error('Error checking daily check-in status:', error);
    }
  };

  const saveCheckInData = async (data) => {
    try {
      const today = new Date().toDateString();
      await AsyncStorage.setItem(`dailyCheckIn_${today}`, JSON.stringify(data));
      setHasCheckedInToday(true);
      setTodaysCheckInData(data);
    } catch (error) {
      console.error('Error saving check-in data:', error);
    }
  };

  const markModalAsSeen = async () => {
    try {
      const today = new Date().toDateString();
      await AsyncStorage.setItem(`seenModal_${today}`, 'true');
      setHasSeenModalToday(true);
    } catch (error) {
      console.error('Error marking modal as seen:', error);
    }
  };

  const handleCheckInClose = () => {
    setShowCheckIn(false);
    markModalAsSeen();
  };

  const handleCheckInButtonPress = () => {
    if (hasCheckedInToday) {
      // Show goals modal
      setShowGoalsModal(true);
    } else {
      // Open check-in modal
      setShowCheckIn(true);
    }
  };

  // Daily routine handler
  const startDailyRoutine = async (manager) => {
    try {
      const result = await manager.startDailyRoutine();
      
      if (result.type === 'recovery') {
        Alert.alert(
          'Recovered Data',
          `Found ${result.data.length} unsaved entries. Would you like to restore them?`,
          [
            { text: 'Discard', style: 'cancel' },
            { text: 'Restore', onPress: () => restoreRecoveredData(result.data) }
          ]
        );
      } else if (result.type === 'checkin') {
        setShowCheckIn(true);
      }
    } catch (error) {
      console.error('Error starting daily routine:', error);
    }
  };

  const restoreRecoveredData = async (data) => {
    for (const item of data) {
      console.log(`Restoring ${item.key} from ${item.ageMinutes} minutes ago`);
    }
  };

  const handleCheckInComplete = async (responses) => {
    try {
      console.log('Received responses from DailyCheckInModal:', responses);
      
      // Ensure situation is properly formatted as an array
      const processedResponses = {
        ...responses,
        situation: Array.isArray(responses.situation) 
          ? responses.situation 
          : responses.situation 
            ? [responses.situation] 
            : ['Normal day']
      };
      
      console.log('Processing responses:', processedResponses);
      
      const result = await algorithmManager.processDailyCheckIn(processedResponses);
      
      console.log('Check-in result:', result);
      
      if (result.success && result.dailyGoal) {
        setDailyPlan(result.dailyPlan);
        
        // Save check-in data
        const checkInData = {
          responses: processedResponses,
          dailyGoal: result.dailyGoal,
          dailyPlan: result.dailyPlan,
          timestamp: new Date().toISOString()
        };
        await saveCheckInData(checkInData);
        
        Alert.alert(
          'Your Personalized Plan',
          `Today's goal: ${result.dailyGoal.min}-${result.dailyGoal.max} calories\n\n${result.dailyGoal.displayMessage}`,
          [{ text: 'Got it!', style: 'default' }]
        );
      } else {
        console.error('Check-in failed or missing dailyGoal:', result);
        Alert.alert('Error', 'Failed to generate personalized plan. Please try again.');
      }
    } catch (error) {
      console.error('Error processing check-in:', error);
      Alert.alert('Error', 'Failed to process check-in. Please try again.');
    }
  };

  // Create today's hydration record if it doesn't exist
  const createTodayHydrationRecord = async (userId, today) => {
    try {
      const { data, error } = await supabase
        .from('daily_water_intake')
        .insert({
          user_id: userId,
          date: today,
          current_intake_ml: 0,
          daily_goal_ml: 2500,
          intake1_ml: 250,
          intake2_ml: 500,
          goal_status: 'not achieved',
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      setHydrationRecordId(data.id);
    } catch (error) {
      // Silent
    }
  };

  const handleAddWater = async (amount) => {
    if (!hydrationRecordId) return;

    // Convert amount from ml to L (same as HydrationTrackerScreen)
    const amountInL = amount / 1000;
    const newIntake = Math.min(currentIntake + amountInL, dailyGoal);
    
    // Optimistic update - update UI immediately
    setCurrentIntake(newIntake);
    
    // Update cache immediately for instant display on navigation
    if (globalCache.cachedHydrationData) {
      globalCache.cachedHydrationData.currentIntake = newIntake;
      globalCache.lastHydrationFetch = Date.now();
    }
    
    try {
      // Update by record ID (same as HydrationTrackerScreen)
      const { error } = await supabase
      .from('daily_water_intake')
        .update({
          current_intake_ml: Math.round(newIntake * 1000), // Convert L to ml for database
          goal_status: newIntake >= dailyGoal ? 'achieved' : 'not achieved',
          updated_at: new Date().toISOString()
        })
        .eq('id', hydrationRecordId);

      if (error) throw error;
    } catch (error) {
      // Silent - but could rollback optimistic update here if needed
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      {/* Daily Check-in Modal */}
      <DailyCheckInModal
        visible={showCheckIn}
        onClose={handleCheckInClose}
        onComplete={handleCheckInComplete}
        userProfile={onboardingData}
      />
      
      {/* Goals Modal */}
      <Modal
        visible={showGoalsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowGoalsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.goalsModalContainer}>
            <View style={styles.goalsModalHeader}>
              <Text style={styles.goalsModalTitle}>Today&apos;s Personalized Plan</Text>
              <TouchableOpacity
                style={styles.goalsModalCloseButton}
                onPress={() => setShowGoalsModal(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {todaysCheckInData && (
              <ScrollView style={styles.goalsModalContent}>
                {/* Calorie Goals */}
                <View style={styles.goalSection}>
                  <Text style={styles.goalSectionTitle}>🎯 Calorie Goals</Text>
                  <View style={styles.calorieGoalCard}>
                    <Text style={styles.calorieGoalRange}>
                      {todaysCheckInData.dailyGoal.min} - {todaysCheckInData.dailyGoal.max} calories
                    </Text>
                    <Text style={styles.calorieGoalTarget}>
                      Target: {todaysCheckInData.dailyGoal.target} calories
                    </Text>
                    <Text style={styles.calorieGoalMessage}>
                      {todaysCheckInData.dailyGoal.displayMessage}
                    </Text>
                  </View>
                </View>
                
                {/* Check-in Responses */}
                <View style={styles.goalSection}>
                  <Text style={styles.goalSectionTitle}>📊 Your Check-in</Text>
                  <View style={styles.checkInSummaryCard}>
                    <Text style={styles.checkInSummaryText}>
                      Sleep: {todaysCheckInData.responses.sleep} hours
                    </Text>
                    <Text style={styles.checkInSummaryText}>
                      Energy: {todaysCheckInData.responses.energy}
                    </Text>
                    <Text style={styles.checkInSummaryText}>
                      Stress: {todaysCheckInData.responses.stress}
                    </Text>
                    <Text style={styles.checkInSummaryText}>
                      Mood: {todaysCheckInData.responses.mood}/10
                    </Text>
                    {todaysCheckInData.responses.situation && todaysCheckInData.responses.situation.length > 0 && (
                      <Text style={styles.checkInSummaryText}>
                        Situation: {todaysCheckInData.responses.situation.join(', ')}
                      </Text>
                    )}
                  </View>
                </View>
                
                {/* Reasons */}
                {todaysCheckInData.dailyGoal.reasons && todaysCheckInData.dailyGoal.reasons.length > 0 && (
                  <View style={styles.goalSection}>
                    <Text style={styles.goalSectionTitle}>💡 Insights</Text>
                    {todaysCheckInData.dailyGoal.reasons.map((reason, index) => (
                      <View key={index} style={styles.insightCard}>
                        <Text style={styles.insightText}>
                          {reason.factor}: {reason.message}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}
            
            <TouchableOpacity
              style={styles.goalsModalButton}
              onPress={() => setShowGoalsModal(false)}
            >
              <Text style={styles.goalsModalButtonText}>Got it!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      <ScrollView
        contentContainerStyle={{
          ...styles.scrollContent,
          paddingBottom: 110, // ensure content is visible above footer
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting Card */}
        <View style={styles.greetingCard}>
          <Text style={styles.greetingCardTitle}>Good Morning, {userName}</Text>
          <Text style={styles.greetingCardVibe}>Today&apos;s vibe: {mood || 'Not tracked yet'} <Text style={{ fontSize: 16 }}>💙</Text></Text>
          
          {/* Daily Check-in Button */}
          <TouchableOpacity
            style={styles.checkInButton}
            onPress={handleCheckInButtonPress}
          >
            <Ionicons name="checkmark-circle" size={20} color="#7B61FF" />
            <Text style={styles.checkInButtonText}>
              {hasCheckedInToday ? 'View Check-in' : 'Daily Check-in'}
            </Text>
          </TouchableOpacity>
          {ritualStreak !== null ? (
            <View style={styles.streakRowBlue}>
              <Ionicons name="water" size={18} color="#3B82F6" style={{ marginRight: 6 }} />
              <Text style={styles.greetingCardStreak}>{ritualStreak}-day consistency streak</Text>
            </View>
          ) : null}
        </View>

        {/* Mood/Journal Card */}
        <TouchableOpacity 
          style={styles.moodCard} 
          activeOpacity={0.9}
          onPress={() => navigation.navigate('Journal')}
        >
          <View style={styles.moodIconWrap}><MaterialCommunityIcons name="emoticon-happy-outline" size={28} color={COLORS.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.moodTitle}>{mood || 'Not tracked yet'}</Text>
            <Text style={styles.moodSub}>New journal entry ready</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={COLORS.primary} />
        </TouchableOpacity>

        {/* --- Dashboard Cards Start Here --- */}
        <View style={styles.dashboardContainer}>
          {/* Stats Row */}
          <View style={styles.statRowBg}>
            <View style={styles.statRowCustom}>
              {/* Calories Today Card */}
              <TouchableOpacity
                style={styles.statCardCustom}
                onPress={() => navigation.navigate('Home')}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <Ionicons name="home-outline" size={20} color="#FF9100" style={{ marginRight: 8 }} />
                  <Text style={styles.statLabelCustom}>Calories{`\n`}Today</Text>
                </View>
                <Text style={styles.statValueCustom2}>{calories} / {calorie_goal}</Text>
                <Text style={styles.statSubCustom}>{mealsLogged} meals logged</Text>
              </TouchableOpacity>
              {/* Strength Today Card */}
              <TouchableOpacity
                style={styles.statCardCustom}
                onPress={() => navigation.navigate('Exercise')}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <MaterialCommunityIcons name="dumbbell" size={20} color="#3B82F6" style={{ marginRight: 8 }} />
                  <Text style={styles.statLabelCustom}>Strength{`\n`}Today</Text>
                </View>
                <Text style={[styles.statValueCustom, { textAlign: 'center' }]}>{todayWorkouts}</Text>
                <Text style={styles.statSubCustom}>workouts this Day</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Hydration Card */}
          <View style={styles.shadowWrapper}>
            <TouchableOpacity 
              style={styles.hydrationCardCustom}
              onPress={() => navigation.navigate('HydrationTrackerScreen')}
              activeOpacity={0.8}
            >
              <View style={styles.hydrationCardContent}>
                {/* Left Section - Progress Indicator */}
                <View style={styles.hydrationProgressContainer}>
                  <View style={styles.hydrationBottleContainer}>
                    {/* Progress Fill */}
                    <View style={[
                      styles.hydrationBottleFill, 
                      { 
                        height: hydrationLoading ? '0%' : currentIntake === 0 ? '0%' : `${Math.min(100, (currentIntake / dailyGoal) * 100)}%`,
                        minHeight: currentIntake === 0 ? 0 : 20
                      }
                    ]}>
                    </View>
                    {/* Icon and Percentage - Always centered */}
                    <View style={styles.hydrationIconPercentageContainer}>
                      <MaterialCommunityIcons 
                        name="water-outline" 
                        size={28} 
                        color="black" 
                        style={styles.hydrationDropIcon} 
                      />
                      <Text style={[
                        styles.hydrationPercentage,
                        { 
                          color: "black",
                          textShadowColor: "#000",
                          textShadowOffset: { width: 0.5, height: 0.5 },
                          textShadowRadius: 1,
                        }
                      ]}>
                        {hydrationLoading ? '0%' : `${Math.min(100, Math.round((currentIntake / dailyGoal) * 100))}%`}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Right Section - Details and Actions */}
                <View style={styles.hydrationDetailsSection}>
                  <Text style={styles.hydrationTitle}>Hydration</Text>
                  <View style={styles.hydrationProgressText}>
                    <Text style={styles.hydrationGoal}>
                      {hydrationLoading ? '--' : `${currentIntake.toFixed(1)}L / ${dailyGoal.toFixed(1)}L`}
                    </Text>
                  </View>
                  <View style={styles.hydrationBtnsRow}>
                    <TouchableOpacity 
                      style={styles.hydrationBtn} 
                      onPress={(e) => {
                        e.stopPropagation();
                        handleAddWater(250);
                      }}
                    >
                      <Text style={styles.hydrationBtnText}>+250ml</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.hydrationBtn} 
                      onPress={(e) => {
                        e.stopPropagation();
                        handleAddWater(500);
                      }}
                    >
                      <Text style={styles.hydrationBtnText}>+500ml</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Sleep & Steps Row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 }}>
            {/* Steps Card */}
            <View style={{ flex: 1, marginRight: 8 }}>
              <TouchableOpacity
                style={{
                  backgroundColor: '#B6E6F6',
                  borderRadius: 24,
                  padding: 20,
                  minWidth: 0,
                  alignItems: 'flex-start',
                  shadowColor: '#000',
                  shadowOpacity: 0.08,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 3,
                  position: 'relative',
                }}
                onPress={() => navigation.navigate('StepTrackerScreen')}
                activeOpacity={0.85}
              >
                {/* Icon and expand */}
                <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ backgroundColor: '#E0F7FA', borderRadius: 18, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialCommunityIcons name="walk" size={22} color="#222" />
                    </View>
                    <Text style={{ fontFamily: 'Lexend-Bold', fontSize: 18, color: '#4A6FA5', marginLeft: 10 }}>
                      Walk Steps
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', marginTop: 8, marginBottom: 8 }}>
                  <View style={{ borderWidth: 1, borderColor: '#222', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 2 }}>
                    <Text style={{ fontFamily: 'Lexend-Regular', fontSize: 12, color: '#222' }}>{percent}% Goal</Text>
                  </View>
                </View>
                <Text style={{ fontFamily: 'Lexend-Bold', fontSize: 28, color: '#222', marginTop: 2 }}>{stepsToday.toLocaleString()}</Text>
                {isPedometerAvailable !== 'true' && (
                  <Text style={{ fontFamily: 'Manrope-Regular', fontSize: 14, color: '#e74c3c', marginTop: 2 }}>
                    Step sensor not available on this device.
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            {/* Sleep Card */}
            <View style={{ flex: 1, marginLeft: 8 }}>
              <TouchableOpacity
                style={{
                  backgroundColor: '#E6D6F6',
                  borderRadius: 24,
                  padding: 20,
                  minWidth: 0,
                  alignItems: 'flex-start',
                  shadowColor: '#000',
                  shadowOpacity: 0.08,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 3,
                  position: 'relative',
                }}
                onPress={() => navigation.navigate('SleepTrackerScreen')}
                activeOpacity={0.85}
              >
                {/* Icon and expand */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ backgroundColor: '#F3E8FF', borderRadius: 18, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialCommunityIcons name="moon-waning-crescent" size={22} color="#7C3AED" />
                    </View>
                    <Text style={{ fontFamily: 'Lexend-Bold', fontSize: 18, color: '#7C3AED', marginLeft: 10 }}>
                      Sleep
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', marginTop: 8, marginBottom: 8 }}>
                  <View style={{ borderWidth: 1, borderColor: '#7C3AED', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 2 }}>
                    <Text style={{ fontFamily: 'Lexend-Regular', fontSize: 12, color: '#7C3AED' }}>{todaySleepPercent}% of {sleepGoal}h</Text>
                  </View>
                </View>
                <Text style={{ fontFamily: 'Lexend-Bold', fontSize: 28, color: '#222', marginTop: 2 }}>{todaySleepDuration}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Weight Journey Card */}
          <View style={styles.weightJourneyCardV2}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <MaterialCommunityIcons name="scale-bathroom" size={26} color={COLORS.primary} style={{ marginRight: 8 }} />
              <Text style={styles.weightJourneyLabelV2}>Weight Journey</Text>
              <Ionicons name="camera-outline" size={22} color="#444" style={{ marginLeft: 'auto' }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.weightJourneySubV2}>Current</Text>
                <Text style={styles.weightJourneyCurrentV2}>{currentWeight ? `${currentWeight} kg` : '--'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.weightJourneySubV2}>Goal</Text>
                <Text style={styles.weightJourneyGoalV2}>{goalWeight ? `${goalWeight} kg` : '--'}</Text>
              </View>
            </View>
            <View style={styles.weightJourneyBarBgV2}>
              <View style={[styles.weightJourneyBarFillV2, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
            <TouchableOpacity style={styles.weightJourneyBtnV2} onPress={() => navigation.navigate('WeightTrackerScreen')}>
              <Text style={styles.weightJourneyBtnTextV2}>View Progress</Text>
            </TouchableOpacity>
          </View>



        </View>
        {/* Recent Meals Section */}
        <RecentMeals recentMeals={recentMeals} handleDeleteMeal={handleDeleteMeal} />

      </ScrollView>
      <FooterBar navigation={navigation} activeTab="Home" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 32 },
  greetingCard: {
    backgroundColor: '#EAF3FF',
    borderRadius: 18,
    marginHorizontal: 18,
    marginTop: 24,
    marginBottom: 18,
    padding: 20,
    ...SHADOW.md,
    position: 'relative',
  },
  logoutBtnAbsolute: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 2,
    padding: 4,
  },
  streakRowBlue: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  greetingCardTitle: {
    fontSize: 22,
    fontFamily: 'Lexend-Bold',
    color: '#11181C',
    marginBottom: 2,
    textAlign: 'left',
  },
  greetingCardVibe: {
    fontSize: 15,
    fontFamily: 'Manrope-Regular',
    color: '#222B45',
    marginBottom: 2,
    textAlign: 'left',
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#7B61FF',
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  checkInButtonText: {
    fontSize: 14,
    fontFamily: 'Lexend-Medium',
    color: '#7B61FF',
    marginLeft: 6,
  },
  greetingCardStreak: {
    color: '#3B82F6',
    fontFamily: 'Manrope-Bold',
    fontSize: 15,
    textAlign: 'left',
  },
  moodCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 18, marginHorizontal: 20, marginBottom: 12, ...SHADOW.md },
  moodIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  moodTitle: { fontSize: 17, fontFamily: 'Lexend-Bold', color: COLORS.primary, marginBottom: 2 },
  moodSub: { fontSize: 14, fontFamily: 'Manrope-Regular', color: COLORS.secondary },
  statsGrid2x2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  statCard2x2: {
    flexBasis: '48%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 12,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
  },
  statIcon2x2: { marginBottom: 6 },
  statLabel2x2: { fontSize: 13, fontFamily: 'Manrope-Bold', color: COLORS.secondary, marginBottom: 2 },
  statMain2x2: { fontSize: 16, fontFamily: 'Lexend-Bold', color: COLORS.primary, marginBottom: 2 },
  statSub2x2: { fontSize: 13, fontFamily: 'Manrope-Regular', color: COLORS.secondary },
  waterCardFull: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
  },
  waterLabelFull: { fontSize: 13, fontFamily: 'Manrope-Bold', color: COLORS.secondary, marginRight: 10 },
  waterTextFull: { fontSize: 15, fontFamily: 'Lexend-Bold', color: COLORS.water, flex: 1 },
  addWaterBtnFull: { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, paddingVertical: 4, paddingHorizontal: 10, marginLeft: 8 },
  addWaterText: { color: COLORS.primary, fontFamily: 'Manrope-Bold', fontSize: 14 },
  waterBarBgFull: { height: 8, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.full, marginTop: 2, width: '100%' },
  waterBarFillFull: { height: 8, backgroundColor: COLORS.primary, borderRadius: RADIUS.full },
  statsGrid2x1: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 20, marginBottom: 12 },
  statCard2x1: { flexBasis: '48%', backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 16, alignItems: 'flex-start', borderWidth: 1, borderColor: COLORS.primaryLight },
  statIcon2x1: { marginBottom: 6 },
  statLabel2x1: { fontSize: 13, fontFamily: 'Manrope-Bold', color: COLORS.secondary, marginBottom: 2 },
  statMain2x1: { fontSize: 16, fontFamily: 'Lexend-Bold', color: COLORS.primary, marginBottom: 2 },
  statSub2x1: { fontSize: 13, fontFamily: 'Manrope-Regular', color: COLORS.secondary },
  ritualsCardFull: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, marginHorizontal: 20, marginBottom: 12, padding: 16, borderWidth: 1, borderColor: COLORS.primaryLight },
  ritualsTitleFull: { fontSize: 15, fontFamily: 'Lexend-Bold', color: COLORS.rituals, flex: 1 },
  ritualsDoneFull: { fontSize: 15, fontFamily: 'Manrope-Bold', color: COLORS.rituals, marginLeft: 8 },
  ritualsBarBgFull: { height: 8, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.full, marginTop: 2, width: '100%' },
  ritualsBarFillFull: { height: 8, backgroundColor: COLORS.primary, borderRadius: RADIUS.full },
  ritualsNextFull: { fontSize: 13, color: COLORS.secondary, fontFamily: 'Manrope-Regular', marginTop: 6 },
  quoteCardFull: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, marginHorizontal: 20, marginBottom: 24, padding: 16, borderWidth: 1, borderColor: COLORS.primaryLight },
  quoteLabelFull: { fontSize: 15, fontFamily: 'Lexend-Bold', color: COLORS.primary, marginBottom: 6 },
  quoteTextFull: { fontSize: 15, fontFamily: 'Manrope-Bold', color: COLORS.primary, marginBottom: 10 },
  quoteInputFull: { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: 12, fontSize: 15, fontFamily: 'Manrope-Regular', color: COLORS.text, marginTop: 2 },
  statIconLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  statLabelBig: { fontSize: 16, fontFamily: 'Lexend-Bold', color: COLORS.primary, marginLeft: 8 },
  waterLabelBig: { fontSize: 16, fontFamily: 'Lexend-Bold', color: COLORS.water, marginRight: 10 },
  waterPrompt: { fontSize: 13, fontFamily: 'Manrope-Regular', color: COLORS.secondary, marginTop: 4, marginLeft: 2 },
  // New styles for dashboard layout
  dashboardContainer: {
    marginHorizontal: 20,
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statCard: {
    flexBasis: '48%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
  },
  statIcon: { marginBottom: 8 },
  statLabel: {
    fontSize: 14,
    fontFamily: 'Lexend-Bold',
    color: '#11181C',
    textAlign: 'center',
    lineHeight: 20,
  },
  statValue: {
    fontSize: 20,
    fontFamily: 'Lexend-Bold',
    color: '#11181C',
    marginTop: 4,
    textAlign: 'center',
  },
  statSub: {
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
    color: '#4B5563',
    marginTop: 4,
    textAlign: 'center',
  },
  hydrationCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
  },
  hydrationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  hydrationTitle: {
    fontSize: 20,
    fontFamily: 'Lexend-Bold',
    color: '#181A20',
    marginBottom: 8,
    fontWeight: 'bold',
  },
  hydrationGoal: {
    fontSize: 16,
    fontFamily: 'Lexend-SemiBold',
    color: '#181A20',
    marginRight: 8,
  },
  hydrationEmojis: {
    fontSize: 16,
  },
  hydrationBtnsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  hydrationBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#a855f7',
  },
  hydrationBtnText: {
    color: '#374151', // Dark gray text for buttons
    fontFamily: 'Lexend-SemiBold',
    fontSize: 14,
    fontWeight: '600',
  },
  sleepCard: {
    flexBasis: '48%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
  },
  sleepTitle: {
    fontSize: 15,
    fontFamily: 'Lexend-Bold',
    color: COLORS.primary,
    marginTop: 8,
  },
  sleepValue: {
    fontSize: 20,
    fontFamily: 'Lexend-Bold',
    color: '#11181C',
    marginTop: 4,
  },
  sleepSub: {
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
    color: '#4B5563',
    marginTop: 4,
  },
  sleepBtn: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    paddingVertical: 8,
    paddingHorizontal: 15,
    marginTop: 12,
  },
  sleepBtnText: {
    color: COLORS.primary,
    fontFamily: 'Manrope-Bold',
    fontSize: 14,
  },
  stepsCard: {
    flexBasis: '48%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
  },
  stepsTitle: {
    fontSize: 15,
    fontFamily: 'Lexend-Bold',
    color: COLORS.primary,
    marginTop: 8,
  },
  stepsValue: {
    fontSize: 20,
    fontFamily: 'Lexend-Bold',
    color: '#11181C',
    marginTop: 4,
  },
  weightJourneyCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
  },
  weightJourneyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  weightJourneyTitle: {
    fontSize: 15,
    fontFamily: 'Lexend-Bold',
    color: COLORS.primary,
    marginLeft: 8,
  },
  weightJourneyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weightJourneyCurrentLabel: {
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
    color: '#4B5563',
  },
  weightJourneyCurrentValue: {
    fontSize: 16,
    fontFamily: 'Lexend-Bold',
    color: '#11181C',
  },
  weightJourneyGoalLabel: {
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
    color: '#4B5563',
  },
  weightJourneyGoalValue: {
    fontSize: 16,
    fontFamily: 'Lexend-Bold',
    color: '#11181C',
  },
  weightJourneyBarBg: {
    height: 8,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.full,
    marginTop: 8,
    marginBottom: 12,
  },
  weightJourneyBarFill: {
    height: 8,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
  },
  weightJourneyBtn: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    paddingVertical: 8,
    paddingHorizontal: 15,
  },
  weightJourneyBtnText: {
    color: COLORS.primary,
    fontFamily: 'Manrope-Bold',
    fontSize: 14,
  },
  habitsCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
  },
  habitsTitle: {
    fontSize: 15,
    fontFamily: 'Lexend-Bold',
    color: '#11181C',
    marginBottom: 12,
  },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  habitText: {
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    color: '#4B5563',
    marginLeft: 8,
  },
  habitCheck: {
    width: 18,
    height: 18,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#9CA3AF',
    marginLeft: 'auto',
  },
  habitCheckFilled: {
    width: 18,
    height: 18,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    marginLeft: 'auto',
  },
  recentMealsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recentMealsLabel: {
    fontSize: 15,
    fontFamily: 'Lexend-Bold',
    color: '#11181C',
  },
  recentMealsAddBtn: {
    padding: 8,
  },
  recentMealsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  mealCard: {
    flexBasis: '30%',
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
  },
  mealImg: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    marginBottom: 8,
  },
  mealTitle: {
    fontSize: 13,
    fontFamily: 'Lexend-Bold',
    color: '#11181C',
    marginBottom: 4,
  },
  mealKcal: {
    fontSize: 12,
    fontFamily: 'Manrope-Bold',
    color: '#11181C',
  },
  statRowCustom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 0,
    marginBottom: 18,
  },
  statCardCustom: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 21,
    marginHorizontal: 4,
    // Slightly more visible black box shadow
    shadowColor: '#181A20',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 5,
    minWidth: 0,
    maxWidth: '100%',
  },
  statLabelCustom: {
    fontFamily: 'Lexend-SemiBold',
    fontSize: 16,
    color: '#11181C',
  },
  statValueCustom: {
    fontFamily: 'Lexend-SemiBold',
    fontSize: 22,
    color: '#11181C',
    marginBottom: 4,
  },
  statValueCustom2: {
    fontFamily: 'Lexend-SemiBold',
    fontSize: 20,
    color: '#11181C',
    marginBottom: 4,
  },
  statSubCustom: {
    fontFamily: 'Lexend-Regular',
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  statRowBg: {
    backgroundColor: '#F6F7FB', // or #F3F4F6 for a subtle dark background
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  shadowWrapper: {
    shadowColor: '#181A20',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 5,
    borderRadius: 22,
    marginHorizontal: 4,
    marginBottom: 18,
  },
  cardCustom: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 18,
  },
  hydrationCardCustom: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  hydrationCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hydrationProgressContainer: {
    marginRight: 20,
  },
  hydrationBottleContainer: {
    width: 60,
    height: 120,
    backgroundColor: '#E5E7EB', // Light gray background
    borderRadius: 7,
    overflow: 'hidden',
    position: 'relative',
  },
  hydrationBottleFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#a855f7', // Light blue fill
    minHeight: 20,
  },
  hydrationIconPercentageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  hydrationDropIcon: {
    marginBottom: 2, // Small gap between icon and percentage
  },
  hydrationPercentage: {
    fontFamily: 'Lexend-Bold',
    fontSize: 14,
    fontWeight: 'bold',
  },
  hydrationDetailsSection: {
    flex: 1,
  },
  hydrationProgressText: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sleepCardCustom: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 22,
    marginHorizontal: 4,
    shadowColor: '#181A20',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 5,
    minWidth: 0,
    maxWidth: '100%',
  },
  sleepLabelCustom: {
    fontFamily: 'Lexend-SemiBold',
    fontSize: 16,
    color: '#181A20',
  },
  sleepTimeCustom: {
    fontFamily: 'Lexend-SemiBold',
    fontSize: 28,
    color: '#181A20',
    marginBottom: 4,
  },
  sleepRefreshedCustom: {
    fontFamily: 'Manrope-Regular',
    fontSize: 16,
    color: '#6B7280',
  },
  logSleepBtnCustom: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  logSleepBtnTextCustom: {
    color: COLORS.primary,
    fontFamily: 'Lexend-SemiBold',
    fontSize: 18,
  },
  stepsCardCustom: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 22,
    marginHorizontal: 4,
    shadowColor: '#181A20',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 5,
    minWidth: 0,
    maxWidth: '100%',
    alignItems: 'center',
  },
  stepsLabelCustom: {
    fontFamily: 'Lexend-SemiBold',
    fontSize: 16,
    color: '#181A20',
  },
  stepsCountCustom: {
    fontFamily: 'Lexend-SemiBold',
    fontSize: 22,
    color: '#181A20',
    marginBottom: 2,
  },
  stepsGoodCustom: {
    fontFamily: 'Manrope-Regular',
    fontSize: 16,
    color: '#6B7280',
  },
  sleepCardV2: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 24,
    marginHorizontal: 6,
    shadowColor: '#181A20',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 6,
    minWidth: 0,
    maxWidth: '100%',
  },
  sleepLabelV2: {
    fontFamily: 'Lexend-SemiBold',
    fontSize: 18,
    color: '#181A20',
  },
  sleepTimeV2: {
    fontFamily: 'Lexend-SemiBold',
    fontSize: 32,
    color: '#181A20',
    marginBottom: 6,
  },
  sleepRefreshedV2: {
    fontFamily: 'Manrope-Regular',
    fontSize: 17,
    color: '#6B7280',
  },
  logSleepBtnV2: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 18,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 2,
  },
  logSleepBtnTextV2: {
    color: COLORS.primary,
    fontFamily: 'Lexend-SemiBold',
    fontSize: 18,
  },
  stepsCardV2: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 24,
    marginHorizontal: 6,
    shadowColor: '#181A20',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 6,
    minWidth: 0,
    maxWidth: '100%',
    alignItems: 'center',
  },
  stepsLabelV2: {
    fontFamily: 'Lexend-SemiBold',
    fontSize: 18,
    color: '#181A20',
  },
  stepsCountV2: {
    fontFamily: 'Lexend-SemiBold',
    fontSize: 24,
    color: '#181A20',
    marginBottom: 2,
  },
  stepsGoodV2: {
    fontFamily: 'Manrope-Regular',
    fontSize: 17,
    color: '#6B7280',
  },
  weightJourneyCardV2: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 24,
    marginHorizontal: 6,
    marginBottom: 18,
    shadowColor: '#181A20',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 6,
  },
  weightJourneyLabelV2: {
    fontFamily: 'Lexend-SemiBold',
    fontSize: 18,
    color: '#181A20',
  },
  weightJourneySubV2: {
    fontFamily: 'Manrope-Regular',
    fontSize: 15,
    color: '#888',
    marginBottom: 2,
  },
  weightJourneyCurrentV2: {
    fontFamily: 'Lexend-SemiBold',
    fontSize: 24,
    color: '#181A20',
  },
  weightJourneyGoalV2: {
    fontFamily: 'Lexend-SemiBold',
    fontSize: 24,
    color: COLORS.primary,
  },
  weightJourneyBarBgV2: {
    height: 10,
    backgroundColor: '#F1F1F5',
    borderRadius: 6,
    marginBottom: 18,
    marginTop: 2,
    overflow: 'hidden',
  },
  weightJourneyBarFillV2: {
    height: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 6,
  },
  weightJourneyBtnV2: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 22,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 2,
  },
  weightJourneyBtnTextV2: {
    color: COLORS.primary,
    fontFamily: 'Lexend-SemiBold',
    fontSize: 20,
  },
  habitsCardV2: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 24,
    marginHorizontal: 6,
    marginBottom: 18,
    shadowColor: '#181A20',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 6,
  },
  habitsTitleV2: {
    fontFamily: 'Lexend-SemiBold',
    fontSize: 18,
    color: '#181A20',
    marginBottom: 18,
  },
  habitRowV2: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  habitTextV2: {
    fontFamily: 'Lexend-Regular',
    fontSize: 16,
    color: '#181A20',
    flex: 1,
  },
  habitCheckFilledV2: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.primary,
    marginLeft: 12,
  },
  habitCheckEmptyV2: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    marginLeft: 12,
  },
  recentMealsHeaderV2: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 6,
    marginBottom: 10,
    marginTop: 8,
    marginLeft: 20,
    marginRight: 20,
  },
  recentMealsTitleV2: {
    fontFamily: 'Lexend-SemiBold',
    fontSize: 20,
    color: '#181A20',
  },
  recentMealsScrollV2: {
    marginLeft: 20,
    marginRight: 20,
    marginBottom: 18,
  },
  mealCardV2: {
    width: 142,
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 12,
    marginRight: 16,
    alignItems: 'center',
    shadowColor: '#181A20',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 5,
  },
  mealImgV2: {
    width: 90,
    height: 90,
    borderRadius: 16,
    marginBottom: 10,
    backgroundColor: '#F3F0FF',
  },
  mealNameV2: {
    fontFamily: 'Lexend-SemiBold',
    fontSize: 16,
    color: '#181A20',
    marginBottom: 2,
  },
  mealKcalV2: {
    fontFamily: 'Manrope-Regular',
    fontSize: 15,
    color: '#888',
  },
  
  // Goals Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  goalsModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxHeight: '80%',
    ...SHADOW.lg,
  },
  goalsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  goalsModalTitle: {
    fontSize: 20,
    fontFamily: 'Lexend-Bold',
    color: '#11181C',
  },
  goalsModalCloseButton: {
    padding: 4,
  },
  goalsModalContent: {
    maxHeight: 400,
    paddingHorizontal: 20,
  },
  goalSection: {
    marginVertical: 12,
  },
  goalSectionTitle: {
    fontSize: 16,
    fontFamily: 'Lexend-SemiBold',
    color: '#11181C',
    marginBottom: 8,
  },
  calorieGoalCard: {
    backgroundColor: '#F8F9FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  calorieGoalRange: {
    fontSize: 18,
    fontFamily: 'Lexend-Bold',
    color: '#7B61FF',
    marginBottom: 4,
  },
  calorieGoalTarget: {
    fontSize: 14,
    fontFamily: 'Manrope-Medium',
    color: '#666',
    marginBottom: 8,
  },
  calorieGoalMessage: {
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    color: '#444',
    lineHeight: 20,
  },
  checkInSummaryCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  checkInSummaryText: {
    fontSize: 14,
    fontFamily: 'Manrope-Medium',
    color: '#444',
    marginBottom: 4,
  },
  insightCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  insightText: {
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
    color: '#444',
    lineHeight: 18,
  },
  goalsModalButton: {
    backgroundColor: '#7B61FF',
    marginHorizontal: 20,
    marginVertical: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  goalsModalButtonText: {
    fontSize: 16,
    fontFamily: 'Lexend-SemiBold',
    color: '#FFFFFF',
  },
});

export default React.memo(MainDashboardScreen); 