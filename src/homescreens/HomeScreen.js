import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import React, { useContext, useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { ProgressChart } from "react-native-chart-kit";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CompassionateFeedbackEngine } from "../algorithms/CompassionateFeedbackEngine";
import { DataSyncEngine } from "../algorithms/DataSyncEngine";
import { OnboardingContext } from "../context/OnboardingContext";
import supabase from "../lib/supabase";
import { createFoodLog, deleteFoodLog, getFoodLogs } from "../utils/api";
import { getHomeScreenCache, invalidateHomeScreenCache, updateHomeScreenCacheOptimistic } from "../utils/cacheManager";
import { getTodayCaloriesBurned } from "../utils/calorieCalculator";
import { getFoodStreak, recalculateFoodStreak, updateFoodStreak } from "../utils/streakService";
import useTodaySteps from "../utils/useTodaySteps";

const screenWidth = Dimensions.get("window").width;

// Use centralized cache
const globalHomeCache = getHomeScreenCache();

// Streak cache to prevent unnecessary re-fetches
const streakCache = {
  lastFetch: 0,
  cachedStreak: null,
  CACHE_DURATION: 30000, // 30 seconds
};

// Username cache to prevent re-fetching
const userNameCache = {
  lastFetch: 0,
  cachedName: null,
  CACHE_DURATION: 300000, // 5 minutes
};

// Export for backward compatibility
export { invalidateHomeScreenCache, updateHomeScreenCacheOptimistic as updateHomeScreenCache };

// Memoized Header Component to prevent re-renders
const HomeHeader = React.memo(({ userName, selectedDate, navigation }) => {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.greeting}>Hello, {userName}</Text>
        <Text style={styles.date}>
          {selectedDate.toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric' 
          })}
        </Text>
      </View>
      <View style={{flexDirection: 'row', alignItems: 'center'}}>
        <TouchableOpacity 
          style={styles.headerButton} 
          onPress={() => navigation.navigate('ProgressScreen')}
        >
          <Ionicons name="stats-chart-outline" size={24} color="#7B61FF" />
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => navigation.navigate('Exercise')} 
          style={styles.headerButton}
        >
          <Ionicons name="barbell-outline" size={24} color="#7B61FF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}, (prevProps, nextProps) => {
  // Only re-render if userName or selectedDate actually changed
  return prevProps.userName === nextProps.userName && 
         prevProps.selectedDate.getTime() === nextProps.selectedDate.getTime();
});
HomeHeader.displayName = 'HomeHeader';

// Memoized Streak Badge Component
const StreakBadge = React.memo(({ calorieStreak }) => {
  return (
    <View style={styles.streakBadge}>
      <Text style={styles.streakEmoji}>🔥</Text>
      <Text style={styles.streakText}>
        {calorieStreak > 0 ? `${calorieStreak}-day streak` : '0-day streak'}
      </Text>
    </View>
  );
}, (prevProps, nextProps) => {
  // Only re-render if streak value changed
  return prevProps.calorieStreak === nextProps.calorieStreak;
});
StreakBadge.displayName = 'StreakBadge';

// Add FooterBar component (same as MainDashboard)
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
      icon: <Ionicons name="restaurant-outline" size={24} color={activeTab === 'Meals' ? '#7B61FF' : '#232B3A'} />,
      route: 'Home',
    },
    {
      key: 'Workout',
      label: 'Saved',
      icon: <Ionicons name="fast-food-outline" size={24} color={activeTab === 'Workout' ? '#7B61FF' : '#232B3A'} />,
      route: 'SavedMealsScreen',
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

// Simple Plus Icon Component with Camera Above
const AnimatedPlusIcon = ({ navigation }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Simple shared values
  const voiceOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const voiceTranslateY = useSharedValue(0);
  const textTranslateY = useSharedValue(0);

  const handlePlusPress = () => {
    if (!isExpanded) {
      // Simple expand animation
      voiceTranslateY.value = withSpring(-60);
      textTranslateY.value = withSpring(-120);
      voiceOpacity.value = withTiming(1, { duration: 200 });
      textOpacity.value = withTiming(1, { duration: 200 });
      setIsExpanded(true);
    } else {
      // Simple collapse animation
      voiceTranslateY.value = withSpring(0);
      textTranslateY.value = withSpring(0);
      voiceOpacity.value = withTiming(0, { duration: 200 });
      textOpacity.value = withTiming(0, { duration: 200 });
      setIsExpanded(false);
    }
  };

  const handleVoicePress = () => {
    // Close and navigate
    voiceTranslateY.value = withSpring(0);
    textTranslateY.value = withSpring(0);
    voiceOpacity.value = withTiming(0, { duration: 150 });
    textOpacity.value = withTiming(0, { duration: 150 });
    setIsExpanded(false);
    
    setTimeout(() => {
      navigation.navigate('VoiceCalorieScreen', { mealType: 'Quick Log' });
    }, 150);
  };

  const handleTextPress = () => {
    // Close and navigate
    voiceTranslateY.value = withSpring(0);
    textTranslateY.value = withSpring(0);
    voiceOpacity.value = withTiming(0, { duration: 150 });
    textOpacity.value = withTiming(0, { duration: 150 });
    setIsExpanded(false);
    
    setTimeout(() => {
      navigation.navigate('QuickLogScreen', { mealType: 'Quick Log' });
    }, 150);
  };

  const handleCameraPress = () => {
    navigation.navigate('CustomCameraScreen');
  };

  // Simple animated styles
  const voiceAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: voiceTranslateY.value }],
      opacity: voiceOpacity.value,
    };
  });

  const textAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: textTranslateY.value }],
      opacity: textOpacity.value,
    };
  });

  return (
    <View style={plusStyles.container}>
      {/* Voice Icon */}
      <Animated.View style={[plusStyles.expandedIcon, voiceAnimatedStyle]}>
        <TouchableOpacity
          style={[plusStyles.iconButton, { backgroundColor: '#7B61FF' }]}
          onPress={handleVoicePress}
          activeOpacity={0.8}
        >
          <Ionicons name="mic" size={24} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      {/* Text Icon */}
      <Animated.View style={[plusStyles.expandedIcon, textAnimatedStyle]}>
        <TouchableOpacity
          style={[plusStyles.iconButton, { backgroundColor: '#A084E8' }]}
          onPress={handleTextPress}
          activeOpacity={0.8}
        >
          <Ionicons name="pencil" size={24} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      {/* Camera Icon (above plus) */}
      <TouchableOpacity
        style={plusStyles.cameraButton}
        onPress={handleCameraPress}
        activeOpacity={0.8}
      >
        <Ionicons name="camera" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Main Plus Icon */}
      <TouchableOpacity
        style={plusStyles.plusButton}
        onPress={handlePlusPress}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

function getCurrentWeekDates() {
  const today = new Date();
  const week = [];
  // Get Monday of current week (Monday = 1, Sunday = 0, so we need to adjust)
  const monday = new Date(today);
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If Sunday, go back 6 days; otherwise go back (dayOfWeek - 1) days
  monday.setDate(today.getDate() - daysToMonday);

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    week.push({
      date: d,
      dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
      dayNumber: d.getDate(),
      isToday:
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear(),
    });
  }
  return week;
}

const HomeScreen = ({ navigation }) => {
  const [weekDates, setWeekDates] = useState(getCurrentWeekDates());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [user, setUser] = useState({ id: null });
  // Initialize with cached data if available (Instagram pattern)
  const [foodLogs, setFoodLogs] = useState(() => globalHomeCache.cachedData?.foodLogs || []);
  const [totals, setTotals] = useState(() => globalHomeCache.cachedData?.totals || {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });


  const [userName, setUserName] = useState(onboardingData?.name || "User");
  const [recentMeals, setRecentMeals] = useState(() => globalHomeCache.cachedData?.recentMeals || []);
  const [expandedMeal, setExpandedMeal] = useState(null);
  const [selectedMeals, setSelectedMeals] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [calorieStreak, setCalorieStreak] = useState(0);
  const [totalCaloriesBurned, setTotalCaloriesBurned] = useState(0);
  const [calorieBreakdown, setCalorieBreakdown] = useState({ steps: 0, workouts: 0, cardio: 0 });
  const { stepsToday, calories: stepCalories } = useTodaySteps();
  const { onboardingData } = useContext(OnboardingContext);

  // Calorie calculation helpers
  function calculateBMR(gender, weight_kg, height_cm, age) {
    return gender === "male"
      ? 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
      : 10 * weight_kg + 6.25 * height_cm - 5 * age - 161;
  }
  function calculateTDEE(bmr, activity_level) {
    const multiplier = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      very: 1.725,
      extra: 1.9,
    };
    return bmr * (multiplier[activity_level] || 1.2);
  }
  function adjustForGoal(tdee, goal) {
    switch (goal) {
      case "lose":
        return tdee * 0.85;
      case "gain":
        return tdee * 1.1;
      default:
        return tdee;
    }
  }
  function getMacroTargets(calories) {
    return {
      protein_g: Math.round((calories * 0.3) / 4),
      fat_g: Math.round((calories * 0.3) / 9),
      carbs_g: Math.round((calories * 0.4) / 4),
    };
  }
  function getMinCalories(gender) {
    return gender === "male" ? 1500 : 1200;
  }

  // Calorie goal logic
  const age = Number(onboardingData?.age) || 25;
  const gender = (onboardingData?.gender || "female").toLowerCase();
  const weight_kg = Number(onboardingData?.weight) || 60;
  const height_cm = Number(onboardingData?.height) || 165;
  const activity_level = (
    onboardingData?.daily_activity_level || "moderate"
  ).toLowerCase();
  let goal_type = (onboardingData?.goal_focus || "maintain").toLowerCase();
  if (goal_type.includes("lose")) goal_type = "lose";
  else if (goal_type.includes("gain")) goal_type = "gain";
  else goal_type = "maintain";

  const bmr = calculateBMR(gender, weight_kg, height_cm, age);
  const tdee = calculateTDEE(bmr, activity_level);
  let calorie_goal = adjustForGoal(tdee, goal_type);
  const minCalories = getMinCalories(gender);
  if (calorie_goal < minCalories) calorie_goal = minCalories;
  calorie_goal = Math.round(calorie_goal);
  const macro_targets = getMacroTargets(calorie_goal);
  const dailyGoal = calorie_goal;

  useEffect(() => {
    const fetchUserAndGoal = async () => {
      if (onboardingData.daily_calorie_goal) {
        calorie_goal = onboardingData.daily_calorie_goal;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUser({ id: session.user.id });

        // Check username cache first
        const now = Date.now();
        const timeSinceLastFetch = now - userNameCache.lastFetch;
        
        if (userNameCache.cachedName && timeSinceLastFetch < userNameCache.CACHE_DURATION) {
          // Use cached username
          setUserName(userNameCache.cachedName);
        } else {
          // Fetch user's name from database
          const { data: profileData } = await supabase
            .from("user_profile")
            .select("name")
            .eq("id", session.user.id)
            .single();

          if (profileData?.name) {
            userNameCache.cachedName = profileData.name;
            userNameCache.lastFetch = now;
            setUserName(profileData.name);
          }
        }
      }
    };
    fetchUserAndGoal();
  }, [onboardingData]);

  useEffect(() => {
    setWeekDates(getCurrentWeekDates());
  }, []);

  // Handle date changes - force data refresh when selectedDate changes
  useEffect(() => {
    if (user && user.id && selectedDate) {
      // Clear cache and fetch fresh data for the new date
      globalHomeCache.cachedData = null;
      globalHomeCache.lastFetchTime = 0;
      fetchFoodLogs(selectedDate);
    }
  }, [selectedDate, user?.id]);
  
  // Use useFocusEffect with cache - Fixed to properly handle date changes
  useFocusEffect(
    React.useCallback(() => {
      if (user && user.id && selectedDate) {
        // Clear cache when returning to screen to force fresh data fetch
        globalHomeCache.cachedData = null;
        globalHomeCache.lastFetchTime = 0;
        fetchFoodLogs(selectedDate);
        
        // Fetch comprehensive calories burned
        fetchCaloriesBurned();
        
        // Reload streak with caching to prevent unnecessary re-fetches
        const loadStreak = async () => {
          try {
            const now = Date.now();
            const timeSinceLastFetch = now - streakCache.lastFetch;
            
            // Use cached streak if it's fresh (within 30 seconds)
            if (streakCache.cachedStreak !== null && timeSinceLastFetch < streakCache.CACHE_DURATION) {
              setCalorieStreak(streakCache.cachedStreak);
              return;
            }
            
            // Fetch fresh streak
            const currentStreak = await getFoodStreak(user.id);
            streakCache.cachedStreak = currentStreak;
            streakCache.lastFetch = now;
            setCalorieStreak(currentStreak);
          } catch (error) {
            console.error('Error loading streak:', error);
          }
        };
        loadStreak();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, selectedDate])
  );

  const fetchCaloriesBurned = async () => {
    if (!user?.id) return;
    
    try {
      const userProfile = {
        weight: weight_kg,
        height: height_cm,
        age: age,
        gender: gender,
      };
      
      const caloriesData = await getTodayCaloriesBurned(user.id, userProfile, selectedDate);
      setTotalCaloriesBurned(caloriesData.total);
      setCalorieBreakdown({
        steps: caloriesData.steps,
        workouts: caloriesData.workouts,
        cardio: caloriesData.cardio,
      });
    } catch (error) {
      console.error('Error fetching calories burned:', error);
    }
  };

  const fetchFoodLogs = async (date) => {
    // Create a unique cache key for each date
    const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD format
    const cacheKey = `foodLogs_${dateKey}`;
    
    const now = Date.now();
    const timeSinceLastFetch = now - globalHomeCache.lastFetchTime;
    const isStale = timeSinceLastFetch > globalHomeCache.STALE_TIME;
    const isFresh = timeSinceLastFetch < globalHomeCache.CACHE_DURATION;
    
    // Check if we have cached data for this specific date
    const cachedDataForDate = globalHomeCache.cachedData && globalHomeCache.cachedData.dateKey === dateKey;
    
    // SWR Pattern: Stale-While-Revalidate (like Instagram)
    if (cachedDataForDate && isFresh) {
      // Data is fresh for this date - use cache, no revalidation needed
      setFoodLogs(globalHomeCache.cachedData.foodLogs || []);
      setTotals(globalHomeCache.cachedData.totals || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
      setRecentMeals(globalHomeCache.cachedData.recentMeals || []);
      globalHomeCache.cacheHits++;
      return; // Fresh cache - no fetch needed
    }
    
    if (cachedDataForDate && isStale && !isFresh) {
      // Data is stale but within cache duration - show stale, revalidate in background
      setFoodLogs(globalHomeCache.cachedData.foodLogs || []);
      setTotals(globalHomeCache.cachedData.totals || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
      setRecentMeals(globalHomeCache.cachedData.recentMeals || []);
      globalHomeCache.cacheHits++;
      // Continue to fetch fresh data in background (don't return)
    }
    
    // Prevent concurrent fetches
    if (globalHomeCache.isFetching) return;
    
    globalHomeCache.isFetching = true;
    globalHomeCache.cacheMisses++;
    
    try {
      const logs = await getFoodLogs(user.id);
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      const filteredLogs = logs.filter((log) => {
        const logDate = new Date(log.created_at);
        return logDate >= startOfDay && logDate <= endOfDay;
      });
      setFoodLogs(filteredLogs);
      
      // Calculate totals
      const newTotals = filteredLogs.reduce(
        (acc, log) => {
          acc.calories += log.calories || 0;
          acc.protein += log.protein || 0;
          acc.carbs += log.carbs || 0;
          acc.fat += log.fat || 0;
          acc.fiber += log.fiber || 0;
          return acc;
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
      );
      setTotals(newTotals);
      
      // Resolve signed URLs for recent meals
      const recent = filteredLogs.slice(-5).reverse();
      const withUrls = await Promise.all(recent.map(async (meal) => {
        if (meal.photo_url && !meal.photo_url.startsWith('http')) {
          try {
            const { data } = await supabase.storage
              .from('food-photos')
              .createSignedUrl(meal.photo_url, 60 * 60);
            return { ...meal, photo_url: data?.signedUrl || meal.photo_url };
          } catch {
            return meal;
          }
        }
        return meal;
      }));
      setRecentMeals(withUrls);
      
      // Cache the data with date key
      globalHomeCache.cachedData = {
        foodLogs: filteredLogs,
        totals: newTotals,
        recentMeals: withUrls,
        dateKey: dateKey, // Store the date key for cache validation
      };
      
      // Update cache timestamp
      globalHomeCache.lastFetchTime = Date.now();

      // Update and get food streak from database
      if (user.id && filteredLogs.length > 0) {
        await updateFoodStreak(user.id);
        const currentStreak = await getFoodStreak(user.id);
        // Update cache
        streakCache.cachedStreak = currentStreak;
        streakCache.lastFetch = Date.now();
        setCalorieStreak(currentStreak);
      } else if (user.id) {
        // Just get current streak if no logs today
        const currentStreak = await getFoodStreak(user.id);
        // Update cache
        streakCache.cachedStreak = currentStreak;
        streakCache.lastFetch = Date.now();
        setCalorieStreak(currentStreak);
      }
    } catch (error) {
      console.error("Error fetching food logs:", error);
    } finally {
      globalHomeCache.isFetching = false;
    }
  };

  const calculateTotals = (logs) => {
    const newTotals = logs.reduce(
      (acc, log) => {
        acc.calories += log.calories || 0;
        acc.protein += log.protein || 0;
        acc.carbs += log.carbs || 0;
        acc.fat += log.fat || 0;
        acc.fiber += log.fiber || 0;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    );
    setTotals(newTotals);
  };

  const launchImagePicker = async (pickerFunction, mealType) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera permission is required.");
      return;
    }
    const result = await pickerFunction({
      allowsEditing: false,
      aspect: [4, 3],
      quality: 1,
    });
    if (!result.canceled) {
      navigation.navigate("PhotoCalorieScreen", {
        photoUri: result.assets[0].uri,
        mealType,
      });
    }
  };

  const showImagePickerOptions = (mealType) => {
    Alert.alert(
      "Log Food with Photo",
      "Choose an option",
      [
        {
          text: "Take a photo",
          onPress: () =>
            launchImagePicker(ImagePicker.launchCameraAsync, mealType),
        },
        {
          text: "Choose from Library",
          onPress: () =>
            launchImagePicker(ImagePicker.launchImageLibraryAsync, mealType),
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ],
      { cancelable: true }
    );
  };

  const handleLogFood = async (mealType, nutritionData) => {
    if (!nutritionData) return;
    try {
      const logData = {
        meal_type: mealType,
        food_name: nutritionData.food_name,
        calories: nutritionData.calories,
        protein: nutritionData.protein,
        carbs: nutritionData.carbs,
        fat: nutritionData.fat,
        user_id: user.id,
      };
      const {
        data: { session },
      } = await supabase.auth.getSession();
      logData.user_id = session?.user?.id;
      if (!logData.user_id) {
        Alert.alert("You must be logged in to log food.");
        return;
      }
      await createFoodLog(logData);
      fetchFoodLogs(selectedDate);
      
      // Auto-save the food log for crash recovery
      const syncEngine = new DataSyncEngine();
      syncEngine.autoSave(logData, `food_log_${Date.now()}`);
      
      // Generate compassionate feedback
      const feedbackEngine = new CompassionateFeedbackEngine();
      const foodData = {
        name: nutritionData.food_name,
        calories: nutritionData.calories,
        protein: nutritionData.protein || 0,
        carbs: nutritionData.carbs || 0,
        fat: nutritionData.fat || 0,
        fiber: 0, // Could be added to nutrition data
        micronutrients: {}, // Could be enhanced
        category: 'meal' // Could be determined from food type
      };
      
      const feedback = feedbackEngine.generateFoodFeedback(foodData);
      
      // Show compassionate feedback instead of generic success message
      Alert.alert(
        "Food Logged! 🍽️",
        feedback.message,
        [{ text: "Great!", style: "default" }]
      );
      
    } catch (error) {
      console.error("Error logging food:", error);
      Alert.alert("Error", "Failed to log food.");
    }
  };

  const openVoiceModal = (mealType) => {
    navigation.navigate("VoiceCalorieScreen", { mealType, selectedDate });
  };

  const handleMealLongPress = (mealId) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedMeals(new Set([mealId]));
    }
  };

  const handleMealPress = (mealId, index) => {
    if (isSelectionMode) {
      const newSelected = new Set(selectedMeals);
      if (newSelected.has(mealId)) {
        newSelected.delete(mealId);
        if (newSelected.size === 0) {
          setIsSelectionMode(false);
        }
      } else {
        newSelected.add(mealId);
      }
      setSelectedMeals(newSelected);
    } else {
      setExpandedMeal(expandedMeal === index ? null : index);
    }
  };

  const handleDeleteSelected = async () => {
    try {
      const selectedIds = Array.from(selectedMeals);
      await Promise.all(selectedIds.map(id => deleteFoodLog(id)));
      
      // Clear cache to force fresh data fetch
      globalHomeCache.cachedData = null;
      globalHomeCache.lastFetchTime = 0;
      
      // Also invalidate main dashboard cache to keep everything in sync
      invalidateHomeScreenCache();
      
      // Refresh data from database
      await fetchFoodLogs(selectedDate);
      
      // Recalculate streak from scratch based on remaining logs
      console.log('🔄 Recalculating streak after deletion...');
      await recalculateFoodStreak(user.id);
      
      // Get updated streak and display it
      const updatedStreak = await getFoodStreak(user.id);
      // Invalidate and update streak cache
      streakCache.cachedStreak = updatedStreak;
      streakCache.lastFetch = Date.now();
      setCalorieStreak(updatedStreak);
      
      setSelectedMeals(new Set());
      setIsSelectionMode(false);
      
      Alert.alert("Success", "Selected meals deleted successfully.");
    } catch (e) {
      console.error('Error in handleDeleteSelected:', e);
      Alert.alert("Error", "Failed to delete selected meals.");
    }
  };

  const renderMealSection = (mealType, iconName, time) => (
    <View style={styles.mealSection}>
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
        <View style={styles.mealIconContainer}>
          <Ionicons name={iconName} size={20} color="#7B61FF" />
        </View>
        <View>
          <Text style={styles.mealTitle}>{mealType}</Text>
          <Text style={styles.mealTime}>{time}</Text>
        </View>
      </View>
      <View style={styles.mealActions}>
        <TouchableOpacity
          style={styles.mealButton}
          onPress={() => showImagePickerOptions(mealType)}
        >
          <Ionicons name="camera-outline" size={24} color="#A9A9A9" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.mealButton}
          onPress={() => openVoiceModal(mealType)}
        >
          <Ionicons name="mic-outline" size={24} color="#A9A9A9" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mealButton, styles.mealAddButton]}
          onPress={() =>
            navigation.navigate("ManualLogScreen", {
              mealType,
              selectedDate: selectedDate.toISOString(),
            })
          }
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const calorieProgress = dailyGoal > 0 ? totals.calories / dailyGoal : 0;
  const progressChartData = {
    data: [calorieProgress > 1 ? 1 : calorieProgress],
  };

  const calorieBalance = dailyGoal - totals.calories;
  const balanceSign = calorieBalance > 0 ? "+" : calorieBalance < 0 ? "-" : "";
  const balanceDisplay = `${balanceSign}${Math.abs(calorieBalance)}`;
  // Use comprehensive calories (steps + workouts + cardio)
  const caloriesBurned = totalCaloriesBurned || 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
      <HomeHeader userName={userName} selectedDate={selectedDate} navigation={navigation} />

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginVertical: 12,
            paddingHorizontal: 10,
          }}
        >
          {weekDates.map((d, i) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dateToCheck = new Date(d.date);
            dateToCheck.setHours(0, 0, 0, 0);
            const isFutureDate = dateToCheck > today;

            const isSelected =
              selectedDate.getDate() === d.date.getDate() &&
              selectedDate.getMonth() === d.date.getMonth() &&
              selectedDate.getFullYear() === d.date.getFullYear();

            return (
              <TouchableOpacity
                key={i}
                onPress={() => {
                  if (!isFutureDate) {
                    setSelectedDate(d.date);
                    // Clear cache immediately when date changes
                    globalHomeCache.cachedData = null;
                    globalHomeCache.lastFetchTime = 0;
                  }
                }}
                style={{ alignItems: "center", flex: 1 }}
                disabled={isFutureDate}
              >
                <View
                  style={{
                    backgroundColor: isSelected
                      ? "#7B61FF"
                      : isFutureDate
                      ? "#F0F0F0"
                      : "#F6F6F6",
                    borderRadius: 24,
                    paddingVertical: 8,
                    paddingHorizontal: 0,
                    minWidth: 44,
                    opacity: isFutureDate ? 0.5 : 1,
                  }}
                >
                  <Text
                    style={{
                      color: isSelected
                        ? "#fff"
                        : isFutureDate
                        ? "#CCC"
                        : "#888",
                      fontFamily: "Lexend-SemiBold",
                      fontSize: 14,
                      textAlign: "center",
                    }}
                  >
                    {d.dayName}
                  </Text>
                  <Text
                    style={{
                      color: isSelected
                        ? "#fff"
                        : isFutureDate
                        ? "#CCC"
                        : "#222",
                      fontFamily: "Lexend-Bold",
                      fontSize: 18,
                      textAlign: "center",
                    }}
                  >
                    {d.dayNumber}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.cardTitle}>Today&apos;s Summary</Text>
            <TouchableOpacity style={styles.dateChip}>
              <Ionicons name="calendar-outline" size={16} color="#7B61FF" />
              <Text style={styles.dateChipText}>
                {selectedDate.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.summaryBody}>
            <View style={styles.caloriesInfo}>
              <Text style={styles.caloriesCount}>
                {totals.calories.toFixed(0)}
              </Text>
              <Text style={styles.caloriesUnit}>
                kcal / {dailyGoal.toFixed(0)}
              </Text>
            </View>
            <View style={styles.progressContainer}>
              <ProgressChart
                data={progressChartData}
                width={100}
                height={100}
                strokeWidth={10}
                radius={40}
                chartConfig={{
                  backgroundGradientFrom: "#fff",
                  backgroundGradientTo: "#fff",
                  color: (opacity = 1, _index) =>
                    `rgba(123, 97, 255, ${opacity})`,
                  propsForLabels: {
                    fontSize: 0,
                  },
                }}
                hideLegend
              />
              <Text style={styles.progressText}>
                {(calorieProgress * 100).toFixed(0)}%
              </Text>
            </View>
          </View>
          <View style={styles.pillRow}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <View style={[styles.pill, styles.pillBurned]}>
                <Text style={styles.pillLabel}>Calories Burned</Text>
                <Text style={styles.pillValueBurned}>{caloriesBurned}</Text>
              </View>
              <View style={[styles.pill, styles.pillBalance]}>
                <Text style={styles.pillLabel}>Balance</Text>
                <Text style={styles.pillValueBalance}>{balanceDisplay}</Text>
              </View>
            </View>
            {calorieStreak > 0 && <StreakBadge calorieStreak={calorieStreak} />}
          </View>
        </View>

        <View style={styles.macroGrid}>
          <View style={styles.macroRow}>
            <View style={[styles.macroCard, { marginRight: 12 }]}>
              <View style={styles.macroCardTopRow}>
                <Ionicons
                  name="barbell"
                  size={28}
                  color="#222"
                  style={styles.macroIconLarge}
                />
                <Text style={styles.macroTitle}>Protein</Text>
              </View>
              <Text style={styles.macroValueLarge}>
                {totals.protein?.toFixed(0) || 0}g
              </Text>
              <View style={styles.macroDivider} />
              <Text style={styles.macroGoalSmall}>
                Goal: {macro_targets.protein_g}g
              </Text>
            </View>
            <View style={styles.macroCard}>
              <View style={styles.macroCardTopRow}>
                <Ionicons
                  name="nutrition"
                  size={28}
                  color="#222"
                  style={styles.macroIconLarge}
                />
                <Text style={styles.macroTitle}>Carbs</Text>
              </View>
              <Text style={styles.macroValueLarge}>
                {totals.carbs?.toFixed(0) || 0}g
              </Text>
              <View style={styles.macroDivider} />
              <Text style={styles.macroGoalSmall}>
                Goal: {macro_targets.carbs_g}g
              </Text>
            </View>
          </View>
          <View style={styles.macroRow}>
            <View style={styles.macroCard}>
              <View style={styles.macroCardTopRow}>
                <Ionicons
                  name="leaf"
                  size={28}
                  color="#222"
                  style={styles.macroIconLarge}
                />
                <Text style={styles.macroTitle}>Fat</Text>
              </View>
              <Text style={styles.macroValueLarge}>
                {totals.fat?.toFixed(0) || 0}g
              </Text>
              <View style={styles.macroDivider} />
              <Text style={styles.macroGoalSmall}>
                Goal: {macro_targets.fat_g}g
              </Text>
            </View>
            <View style={styles.macroCard}>
              <View style={styles.macroCardTopRow}>
                <Ionicons
                  name="restaurant"
                  size={28}
                  color="#222"
                  style={styles.macroIconLarge}
                />
                <Text style={styles.macroTitle}>Fiber</Text>
              </View>
              <Text style={styles.macroValueLarge}>
                {Math.round(totals.fiber)}g
              </Text>
              <View style={styles.macroDivider} />
              <Text style={styles.macroGoalSmall}>Goal: 30g</Text>
            </View>
          </View>
        </View>
        {/* Recent Meals Section */}
        <View
          style={{ marginHorizontal: 20, marginBottom: 30, paddingBottom: 80 }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text
              style={{
                fontFamily: "Lexend-SemiBold",
                fontSize: 18,
                color: "#181A20",
              }}
            >
              Recent Meals
            </Text>
            {isSelectionMode && selectedMeals.size > 0 && (
              <TouchableOpacity
                onPress={handleDeleteSelected}
                style={{
                  backgroundColor: '#FF3B30',
                  borderRadius: 20,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="trash-outline" size={18} color="#fff" />
                <Text style={{ color: '#fff', marginLeft: 6, fontWeight: '600' }}>
                  Delete ({selectedMeals.size})
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {recentMeals.length === 0 ? (
            <Text
              style={{
                fontFamily: "Manrope-Regular",
                fontSize: 15,
                color: "#888",
              }}
            >
              No meals logged yet today.
            </Text>
          ) : (
            <View style={{ gap: 12 }}>
              {recentMeals.map((meal, i) => (
                <TouchableOpacity
                  key={meal.id || i}
                  onPress={() => handleMealPress(meal.id, i)}
                  onLongPress={() => handleMealLongPress(meal.id)}
                  style={{
                    backgroundColor: selectedMeals.has(meal.id) ? "#FFF3F3" : "#fff",
                    borderRadius: 16,
                    padding: 12,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.06,
                    shadowRadius: 10,
                    elevation: 4,
                    transform: [{ scale: expandedMeal === i ? 1.02 : 1 }],
                    borderWidth: selectedMeals.has(meal.id) ? 2 : 0,
                    borderColor: selectedMeals.has(meal.id) ? "#FF3B30" : "transparent",
                  }}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    {/* Meal Image */}
                    {meal.photo_url && meal.photo_url.startsWith('http') ? (
                      <Image
                        source={{ uri: meal.photo_url }}
                        style={{
                          width: 60,
                          height: 60,
                          borderRadius: 12,
                          backgroundColor: "#F3F0FF",
                        }}
                      />
                    ) : (
                      <Image
                        source={{
                          uri: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop",
                        }}
                        style={{
                          width: 60,
                          height: 60,
                          borderRadius: 12,
                          backgroundColor: "#F3F0FF",
                        }}
                        defaultSource={{
                          uri: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop",
                        }}
                      />
                    )}

                    {/* Meal Details */}
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text
                        style={{
                          fontFamily: "Lexend-SemiBold",
                          fontSize: 16,
                          color: "#181A20",
                          marginBottom: 4,
                        }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {meal.food_name || meal.meal_type || "Meal"}
                      </Text>
                      <Text
                        style={{
                          fontFamily: "Manrope-Regular",
                          fontSize: 14,
                          color: "#666",
                        }}
                      >
                        {meal.calories ? `${meal.calories} kcal` : "-- kcal"}
                      </Text>
                    </View>

                    {/* Selection indicator */}
                    {isSelectionMode && (
                      <View style={{ padding: 6 }}>
                        <Ionicons
                          name={selectedMeals.has(meal.id) ? "checkmark-circle" : "ellipse-outline"}
                          size={24}
                          color={selectedMeals.has(meal.id) ? "#FF3B30" : "#CCC"}
                        />
                      </View>
                    )}
                  </View>

                  {/* Expanded Nutrition Details - Inside the same card */}
                  {expandedMeal === i && (
                    <View
                      style={{
                        marginTop: 12,
                        paddingTop: 12,
                        borderTopWidth: 1,
                        borderTopColor: "#F0F0F0",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Lexend-SemiBold",
                          fontSize: 14,
                          color: "#181A20",
                          marginBottom: 8,
                        }}
                      >
                        Nutrition Details
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                        }}
                      >
                        <View
                          style={{
                            alignItems: "center",
                            backgroundColor: "#E6F7EC",
                            borderRadius: 8,
                            padding: 8,
                            minWidth: "22%",
                            marginBottom: 4,
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "Manrope-Bold",
                              fontSize: 12,
                              color: "#22C55E",
                            }}
                          >
                            Protein
                          </Text>
                          <Text
                            style={{
                              fontFamily: "Lexend-SemiBold",
                              fontSize: 14,
                              color: "#22C55E",
                            }}
                          >
                            {meal.protein || 0}g
                          </Text>
                        </View>

                        <View
                          style={{
                            alignItems: "center",
                            backgroundColor: "#FFF2E2",
                            borderRadius: 8,
                            padding: 8,
                            minWidth: "22%",
                            marginBottom: 4,
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "Manrope-Bold",
                              fontSize: 12,
                              color: "#FF9100",
                            }}
                          >
                            Carbs
                          </Text>
                          <Text
                            style={{
                              fontFamily: "Lexend-SemiBold",
                              fontSize: 14,
                              color: "#FF9100",
                            }}
                          >
                            {meal.carbs || 0}g
                          </Text>
                        </View>

                        <View
                          style={{
                            alignItems: "center",
                            backgroundColor: "#EEE8FF",
                            borderRadius: 8,
                            padding: 8,
                            minWidth: "22%",
                            marginBottom: 4,
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "Manrope-Bold",
                              fontSize: 12,
                              color: "#A084E8",
                            }}
                          >
                            Fat
                          </Text>
                          <Text
                            style={{
                              fontFamily: "Lexend-SemiBold",
                              fontSize: 14,
                              color: "#A084E8",
                            }}
                          >
                            {meal.fat || 0}g
                          </Text>
                        </View>

                        <View
                          style={{
                            alignItems: "center",
                            backgroundColor: "#E8F5E8",
                            borderRadius: 8,
                            padding: 8,
                            minWidth: "22%",
                            marginBottom: 4,
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "Manrope-Bold",
                              fontSize: 12,
                              color: "#28a745",
                            }}
                          >
                            Fiber
                          </Text>
                          <Text
                            style={{
                              fontFamily: "Lexend-SemiBold",
                              fontSize: 14,
                              color: "#28a745",
                            }}
                          >
                            {meal.fiber || 0}g
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      
      {/* Footer Bar */}
      <FooterBar navigation={navigation} activeTab="Meals" />
      
      {/* Animated Plus Icon with Camera Above */}
      <AnimatedPlusIcon navigation={navigation} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greeting: { fontSize: 24, fontWeight: "bold", color: "#343a40" },
  date: { fontSize: 16, color: "#6c757d" },
  headerButton: {
    marginLeft: 16,
    backgroundColor: "#e9ecef",
    padding: 8,
    borderRadius: 20,
  },

  dateScrollView: { paddingHorizontal: 20, paddingVertical: 10 },
  dateItem: {
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: "#fff",
  },
  dateItemActive: { backgroundColor: "#7B61FF" },
  dateDay: { fontSize: 14, color: "#6c757d" },
  dateNumber: { fontSize: 18, fontWeight: "bold", color: "#343a40" },
  dateTextActive: { color: "#fff" },

  cardTitle: { fontSize: 18, fontWeight: "bold", color: "#343a40" },
  summaryCard: {
    backgroundColor: "#fff",
    margin: 20,
    marginTop: 10,
    padding: 16,
    borderRadius: 15,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  dateChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e9ecef",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
  },
  dateChipText: { color: "#7B61FF", fontWeight: "bold", marginLeft: 6 },
  streakContainer: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3F2",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  streakEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  streakText: {
    fontFamily: "Lexend-SemiBold",
    fontSize: 12,
    color: "#181A20",
  },
  summaryBody: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  caloriesInfo: { alignItems: "flex-start" },
  caloriesCount: { fontSize: 40, fontWeight: "bold", color: "#343a40" },
  caloriesUnit: { fontSize: 16, color: "#6c757d", marginTop: -5 },
  progressContainer: { justifyContent: "center", alignItems: "center" },
  progressText: {
    position: "absolute",
    fontSize: 18,
    fontWeight: "bold",
    color: "#7B61FF",
  },

  pillRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingVertical: 2,
    paddingHorizontal: 8,
    marginRight: 8,
    minWidth: 0,
  },
  pillBurned: {
    backgroundColor: "#FFF4E0",
  },
  pillBalance: {
    backgroundColor: "#E6F9ED",
  },
  pillLabel: {
    fontSize: 10,
    color: "#888",
    fontWeight: "500",
    marginRight: 3,
  },
  pillValueBurned: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#FF9800",
  },
  pillValueBalance: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1abc9c",
  },

  macroGrid: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  macroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  macroCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    width: "45%",
    minHeight: 90,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: 0,
  },
  macroCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  macroIconLarge: {
    marginRight: 7,
    fontSize: 22,
  },
  macroTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#222",
  },
  macroValueLarge: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#222",
    textAlign: "left",
    marginVertical: 1,
  },
  macroDivider: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginVertical: 6,
    width: "100%",
  },
  macroGoalSmall: {
    fontSize: 11,
    color: "#888",
    textAlign: "left",
  },

  mealSection: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginVertical: 8,
    padding: 16,
    borderRadius: 15,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mealIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e9ecef",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  mealTitle: { fontSize: 16, fontWeight: "bold" },
  mealTime: { fontSize: 12, color: "#6c757d" },
  mealActions: { flexDirection: "row", alignItems: "center" },
  mealButton: { padding: 4, marginHorizontal: 4 },
  mealAddButton: { backgroundColor: "#7B61FF", borderRadius: 15, padding: 6 },

  activityCard: {
    backgroundColor: "#fff",
    margin: 20,
    marginTop: 10,
    padding: 16,
    borderRadius: 15,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  activityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  workoutButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#7B61FF",
  },
  workoutButtonText: {
    color: "#7B61FF",
    fontWeight: "600",
    marginLeft: 6,
    fontSize: 14,
  },
  activityBody: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 16,
  },
  activityItem: { alignItems: "center" },
  activityValue: { fontSize: 18, fontWeight: "bold", marginTop: 4 },
  activityUnit: { fontSize: 12, color: "#6c757d" },

  modalCenteredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: "90%",
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 15 },
  recordButton: {
    backgroundColor: "#7B61FF",
    borderRadius: 50,
    width: 100,
    height: 100,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 20,
  },
  recordingStatus: { fontSize: 16, color: "#666", marginVertical: 10 },
  transcribedText: {
    fontSize: 16,
    fontStyle: "italic",
    color: "#333",
    marginVertical: 15,
    textAlign: "center",
  },
  nutritionResultContainer: { alignItems: "center", width: "100%" },
  foodName: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  nutritionGrid: { marginVertical: 10, alignItems: "center" },
  confirmLogButton: {
    backgroundColor: "#28a745",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
    width: "100%",
  },
  closeButton: {
    backgroundColor: "#6c757d",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
    width: "100%",
  },
  buttonText: { color: "white", fontWeight: "bold"   },
});

// Footer styles (same as MainDashboard)
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

// Plus icon styles (vertical alignment)
const plusStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 20,
    bottom: Platform.OS === 'ios' ? 100 : 80,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom:20,
    paddingTop:20,
    zIndex: 200,
  },
  plusButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#7B61FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7B61FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    
  },
  cameraButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1abc9c',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#1abc9c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  expandedIcon: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    paddingBottom: 50,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});

export default React.memo(HomeScreen);