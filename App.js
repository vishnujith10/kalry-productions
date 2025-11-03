import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import React, { useCallback } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import CustomCameraScreen from './src/caloriescreen/CustomCameraScreen';
import MealPreferencesScreen from './src/caloriescreen/MealPreferencesScreen';
import PhotoCalorieScreen from './src/caloriescreen/PhotoCalorieScreen';
import PostCalorieScreen from './src/caloriescreen/PostCalorieScreen';
import ProgressScreen from './src/caloriescreen/ProgressScreen';
import QuickLogScreen from './src/caloriescreen/QuickLogScreen';
import SavedMealsScreen from './src/caloriescreen/SavedMealsScreen';
import VoiceCalorieScreen from './src/caloriescreen/VoiceCalorieScreen';
import VoicePostCalorieScreen from './src/caloriescreen/VoicePostCalorieScreen';
import CardioPlayerScreen from './src/cardioscreen/CardioPlayerScreen';
import CreateWorkoutScreen from './src/cardioscreen/CreateWorkoutScreen';
import WorkoutStartScreen from './src/cardioscreen/WorkoutStartScreen';
import { OnboardingProvider } from './src/context/OnboardingContext';
import HomeScreen from './src/homescreens/HomeScreen';
import JournalScreen from './src/homescreens/JournalScreen';
import MainDashboardScreen from './src/homescreens/MainDashboardScreen';
import HydrationTrackerScreen from './src/hydrationscreen/HydrationTrackerScreen';
import LoginScreen from './src/loginsignup/LoginScreen';
import SignupScreen from './src/loginsignup/SignupScreen';
import ActivityLevelScreen from './src/onboarding/ActivityLevelScreen';
import FocusScreen from './src/onboarding/FocusScreen';
import GoalSummaryScreen from './src/onboarding/GoalSummaryScreen';
import MiniProfileScreen from './src/onboarding/MiniProfileScreen';
import ReferralSourceScreen from './src/onboarding/ReferralSourceScreen';
import TimePerDayScreen from './src/onboarding/TimePerDayScreen';
import WeightGoalScreen from './src/onboarding/WeightGoalScreen';
import WorkoutPreferencesScreen from './src/onboarding/WorkoutPreferencesScreen';
import AppSettingsScreen from './src/profilescreen/AppSettingsScreen';
import PersonalInfoScreen from './src/profilescreen/PersonalInfoScreen';
import PreferencesScreen from './src/profilescreen/PreferencesScreen';
import ProfileScreen from './src/profilescreen/ProfileScreen';
import AllExercisesScreen from './src/routinescreen/AllExercisesScreen';
import CategoryWorkoutsScreen from './src/routinescreen/CategoryWorkoutsScreen';
import ExerciseDetailScreen from './src/routinescreen/ExerciseDetailScreen';
import StartWorkoutScreen from './src/routinescreen/StartWorkoutScreen';
import AuthLoadingScreen from './src/screens/AuthLoadingScreen';
import GoalMoodScreen from './src/screens/GoalMoodScreen';
import GoalScreen from './src/screens/GoalScreen';
import ManualLogScreen from './src/screens/ManualLogScreen';
import MinimalSignupTestScreen from './src/screens/MinimalSignupTestScreen';
import TargetSummaryScreen from './src/screens/TargetSummaryScreen';
import WorkoutSpaceScreen from './src/screens/WorkoutSpaceScreen';
import SleepTrackerScreen from './src/sleepscreen/SleepTrackerScreen';
import StepTrackerScreen from './src/steptrackerscreen/StepTrackerScreen';
import AddWeightScreen from './src/weightscreen/AddWeightScreen';
import WeightTrackerScreen from './src/weightscreen/WeightTrackerScreen';
import WelcomeScreen from './src/welcomescreen/WelcomeScreen';
import ExerciseScreen from './src/workoutscreen/ExerciseScreen';
import WorkoutHistoryScreen from './src/workoutscreen/WorkoutHistoryScreen';
import WorkoutSaveScreen from './src/workoutscreen/WorkoutSaveScreen';
if (typeof global.structuredClone !== 'function') {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#7B61FF',
        tabBarInactiveTintColor: '#B0B0B0',
        tabBarStyle: { backgroundColor: '#fff', borderTopWidth: 0.5, borderTopColor: '#E5E7EB' },
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Workouts') return <Ionicons name="barbell-outline" size={size} color={color} />;
          if (route.name === 'Create') return <Ionicons name="add-circle-outline" size={size} color={color} />;
          if (route.name === 'Exercise') return <Ionicons name="fitness-outline" size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Workouts" component={WorkoutHistoryScreen} />
      <Tab.Screen name="Create" component={CreateWorkoutScreen} />
      <Tab.Screen name="Exercise" component={ExerciseScreen} />
    </Tab.Navigator>
  );
}

const Stack = createNativeStackNavigator();

export default function App() {
  const [fontsLoaded] = useFonts({
    'Lexend-Regular': require('./assets/Lexend,Manrope,Ubuntu/Lexend/static/Lexend-Regular.ttf'),
    'Lexend-Medium': require('./assets/Lexend,Manrope,Ubuntu/Lexend/static/Lexend-Medium.ttf'),
    'Lexend-SemiBold': require('./assets/Lexend,Manrope,Ubuntu/Lexend/static/Lexend-SemiBold.ttf'),
    'Manrope-Regular': require('./assets/Lexend,Manrope,Ubuntu/Manrope/static/Manrope-Regular.ttf'),
    'Manrope-Bold': require('./assets/Lexend,Manrope,Ubuntu/Manrope/static/Manrope-Bold.ttf'),
    'Ubuntu-Regular': require('./assets/Lexend,Manrope,Ubuntu/Ubuntu/Ubuntu-Regular.ttf'),
    'Ubuntu-Bold': require('./assets/Lexend,Manrope,Ubuntu/Ubuntu/Ubuntu-Bold.ttf'),
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      // ✅ Only hide splash screen, don't initialize Google Sign-In here
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* AuthProvider wraps everything to provide authentication context */}
          <OnboardingProvider>
            <NavigationContainer onReady={onLayoutRootView}>
              <Stack.Navigator 
                initialRouteName="AuthLoading" 
                screenOptions={{ 
                  headerShown: false,
                  animation: 'slide_from_right',
                  animationDuration: 200,
                }}
                detachInactiveScreens={false}
              >
                <Stack.Screen name="AuthLoading" component={AuthLoadingScreen} />
                <Stack.Screen name="Welcome" component={WelcomeScreen} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen name="ReferralSource" component={ReferralSourceScreen} />
                <Stack.Screen name="ActivityLevel" component={ActivityLevelScreen} />
                <Stack.Screen name="Focus" component={FocusScreen} />
                <Stack.Screen name="GoalMood" component={GoalMoodScreen} />
                <Stack.Screen name="MealPreferences" component={MealPreferencesScreen} />
                <Stack.Screen name="WeightGoal" component={WeightGoalScreen} />
                <Stack.Screen name="TargetSummary" component={TargetSummaryScreen} />
                <Stack.Screen name="TimePerDay" component={TimePerDayScreen} />
                <Stack.Screen name="WorkoutPreferences" component={WorkoutPreferencesScreen} />
                <Stack.Screen name="WorkoutSpace" component={WorkoutSpaceScreen} />
                <Stack.Screen name="GoalSummary" component={GoalSummaryScreen} />
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Signup" component={SignupScreen} />
                <Stack.Screen 
                  name="MainDashboard" 
                  component={MainDashboardScreen}
                  options={{
                    animation: 'slide_from_left',
                    gestureDirection: 'horizontal',
                  }}
                />
                <Stack.Screen 
                  name="Home" 
                  component={HomeScreen}
                  options={{
                    animation: 'slide_from_right',
                    gestureDirection: 'horizontal',
                  }}
                />
                <Stack.Screen 
                  name="Journal" 
                  component={JournalScreen}
                  options={{
                    animation: 'slide_from_right',
                    gestureDirection: 'horizontal',
                  }}
                />
                <Stack.Screen name="PhotoCalorieScreen" component={PhotoCalorieScreen} />
                <Stack.Screen name="ManualLogScreen" component={ManualLogScreen} />
                <Stack.Screen name="VoiceCalorieScreen" component={VoiceCalorieScreen} />
                <Stack.Screen name="VoicePostCalorieScreen" component={VoicePostCalorieScreen} />
                <Stack.Screen name="MinimalSignupTest" component={MinimalSignupTestScreen} />
                <Stack.Screen name="Tabs" component={MainTabs} />
                <Stack.Screen 
                  name="Exercise" 
                  component={ExerciseScreen}
                  options={{
                    animation: 'slide_from_right',
                    gestureDirection: 'horizontal',
                  }}
                />
                <Stack.Screen name="CategoryWorkouts" component={CategoryWorkoutsScreen} options={{ headerShown: false }} />
                <Stack.Screen name="Goal" component={GoalScreen} />
                <Stack.Screen name="SleepTrackerScreen" component={SleepTrackerScreen} options={{ headerShown: false }} />
                <Stack.Screen name="WeightTrackerScreen" component={WeightTrackerScreen} options={{ headerShown: false }} />
                <Stack.Screen name="AddWeightScreen" component={AddWeightScreen} options={{ headerShown: false }} />
                <Stack.Screen name="HydrationTrackerScreen" component={HydrationTrackerScreen} options={{ headerShown: false }} />
                <Stack.Screen name="StepTrackerScreen" component={StepTrackerScreen} options={{ headerShown: false }} />
                <Stack.Screen 
                  name="SavedMealsScreen" 
                  component={SavedMealsScreen} 
                  options={{ 
                    headerShown: false,
                    animation: 'slide_from_right',
                    gestureDirection: 'horizontal',
                  }} 
                />
                <Stack.Screen name="ExerciseDetail" component={ExerciseDetailScreen} />
                <Stack.Screen name="Create" component={CreateWorkoutScreen} />
                <Stack.Screen name="Workouts" component={WorkoutHistoryScreen} />
                <Stack.Screen name="PostCalorieScreen" component={PostCalorieScreen} />
                <Stack.Screen name="QuickLogScreen" component={QuickLogScreen} />
                <Stack.Screen name="StartWorkout" component={StartWorkoutScreen} />
                <Stack.Screen name="AllExercisesScreen" component={AllExercisesScreen} options={{ headerShown: false }} />
                <Stack.Screen name="CustomCameraScreen" component={CustomCameraScreen} options={{ headerShown: false }} />
                <Stack.Screen name="CardioPlayerScreen" component={CardioPlayerScreen} />
                <Stack.Screen name="WorkoutStart" component={WorkoutStartScreen} />
                <Stack.Screen name="ProgressScreen" component={ProgressScreen} />
                <Stack.Screen name="WorkoutSaveScreen" component={WorkoutSaveScreen} />
                <Stack.Screen name="PersonalInfo" component={PersonalInfoScreen} />
                <Stack.Screen name="Preferences" component={PreferencesScreen} />
                <Stack.Screen name="AppSettings" component={AppSettingsScreen} />
                <Stack.Screen name="MiniProfile" component={MiniProfileScreen} />
              </Stack.Navigator>
            </NavigationContainer>
          </OnboardingProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}