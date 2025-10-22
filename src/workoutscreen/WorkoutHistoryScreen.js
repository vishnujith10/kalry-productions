import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import supabase from '../lib/supabase';

// Group workouts by date helper function
const groupWorkoutsByDate = (routineWorkouts, cardioWorkouts) => {
  const grouped = {};
  
  // Dates to exclude
  const excludedDates = [
    'September 26, 2025',
    'September 13, 2025', 
    'September 11, 2025'
  ];
  
  // Process routine workouts (from daily_routine_exercises)
  routineWorkouts.forEach(workout => {
    const date = new Date(workout.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let dateKey;
    if (date.toDateString() === today.toDateString()) {
      dateKey = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      dateKey = 'Yesterday';
    } else {
      dateKey = date.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      });
    }

    // Skip excluded dates
    if (excludedDates.includes(dateKey)) {
      return;
    }

    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }

    // Process each exercise in the workout
    workout.daily_routine_exercises.forEach(exercise => {
      const exerciseData = {
        id: exercise.id,
        name: exercise.exercise_name,
        icon: getExerciseIcon(exercise.exercise_name),
        iconType: 'MaterialIcons',
        duration: formatDuration(exercise.duration),
        calories: `${exercise.total_kcal || 0} kcal`,
        time: date.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        }),
        color: '#4A90E2',
        sets: exercise.total_sets,
        reps: exercise.total_reps,
        weight: exercise.total_weight,
        workoutNotes: workout.notes || 'Workout',
        type: 'routine',
        created_at: workout.created_at
      };

      grouped[dateKey].push(exerciseData);
    });
  });

  // Process cardio workouts (from saved_cardio_sessions)
  cardioWorkouts.forEach(cardio => {
    const date = new Date(cardio.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let dateKey;
    if (date.toDateString() === today.toDateString()) {
      dateKey = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      dateKey = 'Yesterday';
    } else {
      dateKey = date.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      });
    }

    // Skip excluded dates
    if (excludedDates.includes(dateKey)) {
      return;
    }

    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }

    const cardioData = {
      id: cardio.id,
      name: cardio.name,
      icon: getExerciseIcon(cardio.name),
      iconType: 'MaterialIcons',
      duration: formatDuration(cardio.estimated_time),
      calories: `${cardio.estimated_calories || 0} kcal`,
      time: date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      }),
      color: '#7c3aed', // Purple color for cardio
      sets: cardio.total_rounds,
      reps: null,
      weight: null,
      workoutNotes: cardio.notes || 'Cardio',
      type: 'cardio',
      created_at: cardio.created_at
    };

    grouped[dateKey].push(cardioData);
  });

  // Sort workouts within each date by time (most recent first)
  Object.keys(grouped).forEach(dateKey => {
    grouped[dateKey].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  });

  // Convert to array format and sort dates (most recent first)
  return Object.keys(grouped)
    .sort((a, b) => {
      // Custom sort to handle 'Today', 'Yesterday', and actual dates
      if (a === 'Today') return -1;
      if (b === 'Today') return 1;
      if (a === 'Yesterday') return -1;
      if (b === 'Yesterday') return 1;
      
      // For actual dates, parse and compare
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateB - dateA;
    })
    .map(date => ({
      date,
      workouts: grouped[date]
    }));
};

// Get appropriate icon for exercise
const getExerciseIcon = (exerciseName) => {
  const name = exerciseName.toLowerCase();
  if (name.includes('run') || name.includes('jog')) return 'running';
  if (name.includes('cycle') || name.includes('bike')) return 'directions-bike';
  if (name.includes('swim')) return 'pool';
  if (name.includes('push') || name.includes('press')) return 'fitness-center';
  if (name.includes('squat') || name.includes('leg')) return 'fitness-center';
  if (name.includes('cardio')) return 'favorite';
  return 'fitness-center';
};

// Format duration from seconds to readable format
const formatDuration = (seconds) => {
  if (!seconds) return '0 min';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes === 0) return `${remainingSeconds}s`;
  if (remainingSeconds === 0) return `${minutes} min`;
  return `${minutes}m ${remainingSeconds}s`;
};

// Add FooterBar component
const FooterBar = ({ navigation, activeTab }) => {
  const tabs = [
    {
      key: 'Home',
      label: 'Home',
      icon: <Ionicons name="home-outline" size={24} color={activeTab === 'MainDashboard' ? '#7B61FF' : '#232B3A'} />,
      route: 'MainDashboard',
    },
    
    {
      key: 'Exercise',
      label: 'Workouts',
      icon: <Ionicons name="barbell-outline" size={24} color={activeTab === 'Exercise' ? '#7B61FF' : '#232B3A'} />,
      route: 'Exercise',
    },
    {
      key: 'Progress',
      label: 'Progress',
      icon: <Ionicons name="stats-chart-outline" size={24} color={activeTab === 'Progress' ? '#7B61FF' : '#232B3A'} />,
      route: 'WorkoutSaveScreen',
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
            onPress={() => navigation.navigate(tab.route)}
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

const WorkoutHistoryScreen = () => {
  const navigation = useNavigation();
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [selectedTimeFilter, setSelectedTimeFilter] = useState('Last 7 Days');
  const [workoutData, setWorkoutData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPreviousMonth, setShowPreviousMonth] = useState(false);
  const [previousMonthData, setPreviousMonthData] = useState([]);

  const filters = ['All', 'Cardio', 'Routines'];
  const timeFilters = ['Last 7 Days', 'Last 30 Days', 'All Time'];

  // Fetch workout history from both daily_routine_exercises and saved_cardio_sessions
  useEffect(() => {
    const fetchWorkoutHistory = async () => {
      try {
        setLoading(true);
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setWorkoutData([]);
          setLoading(false);
          return;
        }

        // Get date range based on selected time filter
        const now = new Date();
        let startDate, endDate;
        
        if (selectedTimeFilter === 'Last 7 Days') {
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          endDate = now;
        } else if (selectedTimeFilter === 'Last 30 Days') {
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          endDate = now;
        } else { // All Time
          startDate = new Date(0); // Very old date
          endDate = now;
        }

        // Fetch routine workouts with their exercises based on time filter
        const { data: routineWorkouts, error: routineError } = await supabase
          .from('workouts')
          .select(`
            id,
            date,
            duration,
            total_kcal,
            notes,
            created_at,
            daily_routine_exercises (
              id,
              exercise_name,
              duration,
              total_sets,
              total_reps,
              total_weight,
              total_kcal,
              image_url,
              order
            )
          `)
          .eq('user_id', user.id)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .order('created_at', { ascending: false });

        // Fetch cardio workouts based on time filter
        const { data: cardioWorkouts, error: cardioError } = await supabase
          .from('saved_cardio_sessions')
          .select(`
            id,
            name,
            total_rounds,
            rest_between_rounds,
            sound_alerts,
            sound_option,
            auto_repeat,
            notes,
            estimated_time,
            estimated_calories,
            created_at
          `)
          .eq('user_id', user.id)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .order('created_at', { ascending: false });

        if (routineError) {
          console.error('Error fetching routine workouts:', routineError);
        }

        if (cardioError) {
          console.error('Error fetching cardio workouts:', cardioError);
        }

        // Group workouts by date (combining both routine and cardio)
        const groupedWorkouts = groupWorkoutsByDate(routineWorkouts || [], cardioWorkouts || []);
        setWorkoutData(groupedWorkouts);
      } catch (error) {
        console.error('Error fetching workout history:', error);
        setWorkoutData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkoutHistory();
  }, [selectedTimeFilter]);

  // Fetch previous month's data
  const fetchPreviousMonthData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get previous month range (for previous month button)
      const now = new Date();
      const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

      // Fetch routine workouts for previous month
      const { data: routineWorkouts, error: routineError } = await supabase
        .from('workouts')
        .select(`
          id,
          date,
          duration,
          total_kcal,
          notes,
          created_at,
          daily_routine_exercises (
            id,
            exercise_name,
            duration,
            total_sets,
            total_reps,
            total_weight,
            total_kcal,
            image_url,
            order
          )
        `)
        .eq('user_id', user.id)
        .gte('created_at', startOfPreviousMonth.toISOString())
        .lte('created_at', endOfPreviousMonth.toISOString())
        .order('created_at', { ascending: false });

      // Fetch cardio workouts for previous month
      const { data: cardioWorkouts, error: cardioError } = await supabase
        .from('saved_cardio_sessions')
        .select(`
          id,
          name,
          total_rounds,
          rest_between_rounds,
          sound_alerts,
          sound_option,
          auto_repeat,
          notes,
          estimated_time,
          estimated_calories,
          created_at
        `)
        .eq('user_id', user.id)
        .gte('created_at', startOfPreviousMonth.toISOString())
        .lte('created_at', endOfPreviousMonth.toISOString())
        .order('created_at', { ascending: false });

      if (routineError) {
        console.error('Error fetching previous month routine workouts:', routineError);
      }

      if (cardioError) {
        console.error('Error fetching previous month cardio workouts:', cardioError);
      }

      // Group workouts by date (combining both routine and cardio)
      const groupedWorkouts = groupWorkoutsByDate(routineWorkouts || [], cardioWorkouts || []);
      setPreviousMonthData(groupedWorkouts);
      setShowPreviousMonth(true);
    } catch (error) {
      console.error('Error fetching previous month data:', error);
    }
  };


  const renderIcon = (iconName, iconType, color) => {
    if (iconType === 'MaterialIcons') {
      return <MaterialIcons name={iconName} size={24} color={color} />;
    }
    return <Ionicons name={iconName} size={24} color={color} />;
  };

  const renderWorkoutItem = (workout) => (
    <TouchableOpacity key={workout.id} style={styles.workoutItem}>
      <View style={[styles.iconContainer, { backgroundColor: workout.color + '20' }]}>
        {renderIcon(workout.icon, workout.iconType, workout.color)}
      </View>
      
      <View style={styles.workoutDetails}>
        <Text style={styles.workoutName}>{workout.name}</Text>
        <Text style={styles.workoutSubtitle}>
          {workout.type === 'cardio' ? (
            `${workout.sets} rounds • ${workout.duration}`
          ) : (
            `${workout.sets ? workout.sets + ' sets • ' : ''}${workout.duration}${workout.reps ? ` • ${workout.reps} reps` : ''}${workout.weight ? ` • ${workout.weight}kg` : ''}`
          )}
        </Text>
        <Text style={[styles.workoutType, { color: workout.color }]}>
          {workout.type === 'cardio' ? 'Cardio' : 'Routine'}
        </Text>
      </View>
      
      <View style={styles.workoutStats}>
        <Text style={styles.caloriesText}>{workout.calories}</Text>
        <Text style={styles.timeText}>{workout.time}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
        {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.navigate('Exercise')}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Workout History</Text>
        <TouchableOpacity style={styles.themeButton}>
          <Ionicons name="moon-outline" size={24} color="#000" />
        </TouchableOpacity>
        </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScrollContainer}
          >
            {filters.map((filter) => (
            <TouchableOpacity
                key={filter}
                style={[
                  styles.filterTab,
                  selectedFilter === filter && styles.activeFilterTab
                ]}
                onPress={() => setSelectedFilter(filter)}
              >
                <Text
                  style={[
                    styles.filterText,
                    selectedFilter === filter && styles.activeFilterText
                  ]}
                >
                  {filter}
                </Text>
            </TouchableOpacity>
          ))}
          </ScrollView>
        </View>

        {/* Time Filter */}
        <View style={styles.controlsContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.timeFilterScrollContainer}
          >
            {timeFilters.map((timeFilter) => (
              <TouchableOpacity
                key={timeFilter}
                style={[
                  styles.timeFilterTab,
                  selectedTimeFilter === timeFilter && styles.activeTimeFilterTab
                ]}
                onPress={() => setSelectedTimeFilter(timeFilter)}
              >
                <Ionicons 
                  name="calendar-outline" 
                  size={16} 
                  color={selectedTimeFilter === timeFilter ? '#4A90E2' : '#666'} 
                />
                <Text
                  style={[
                    styles.timeFilterText,
                    selectedTimeFilter === timeFilter && styles.activeTimeFilterText
                  ]}
                >
                  {timeFilter}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Workout List */}
        <View style={styles.workoutList}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4A90E2" />
              <Text style={styles.loadingText}>Loading workout history...</Text>
            </View>
          ) : workoutData.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="fitness-center" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>No workouts yet</Text>
              <Text style={styles.emptySubtitle}>Start your fitness journey by creating your first workout!</Text>
            </View>
          ) : (
            <>
              {/* Current Month Data */}
              {workoutData.map((section) => (
                <View key={section.date} style={styles.dateSection}>
                  <Text style={styles.dateHeader}>{section.date}</Text>
                  {section.workouts
                    .filter(workout => {
                      if (selectedFilter === 'All') return true;
                      if (selectedFilter === 'Cardio') return workout.type === 'cardio';
                      if (selectedFilter === 'Routines') return workout.type === 'routine';
                      return true;
                    })
                    .map(renderWorkoutItem)}
              </View>
              ))}
              
              {/* Previous Month Button */}
              {!showPreviousMonth && workoutData.length > 0 && (
                <TouchableOpacity
                  style={styles.previousMonthButton}
                  onPress={fetchPreviousMonthData}
                >
                  <Ionicons name="chevron-down" size={20} color="#4A90E2" />
                  <Text style={styles.previousMonthText}>Previous Month</Text>
                </TouchableOpacity>
              )}
              
              {/* Previous Month Data */}
              {showPreviousMonth && previousMonthData.length > 0 && (
                <>
                  <View style={styles.previousMonthHeader}>
                    <Text style={styles.previousMonthTitle}>Previous Month</Text>
                <TouchableOpacity
                      onPress={() => setShowPreviousMonth(false)}
                      style={styles.hideButton}
                >
                      <Ionicons name="chevron-down" size={20} color="#666" />
                </TouchableOpacity>
              </View>
                  {previousMonthData.map((section) => (
                    <View key={`prev-${section.date}`} style={styles.dateSection}>
                      <Text style={styles.dateHeader}>{section.date}</Text>
                      {section.workouts
                        .filter(workout => {
                          if (selectedFilter === 'All') return true;
                          if (selectedFilter === 'Cardio') return workout.type === 'cardio';
                          if (selectedFilter === 'Routines') return workout.type === 'routine';
                          return true;
                        })
                        .map(renderWorkoutItem)}
                    </View>
                  ))}
                </>
              )}
              
              {/* Show message if no previous month data */}
              {showPreviousMonth && previousMonthData.length === 0 && (
                <View style={styles.noPreviousDataContainer}>
                  <Text style={styles.noPreviousDataText}>No workouts in previous month</Text>
                  <TouchableOpacity 
                    onPress={() => setShowPreviousMonth(false)}
                    style={styles.hideButton}
                  >
                    <Ionicons name="chevron-up" size={20} color="#666" />
                  </TouchableOpacity>
            </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <FooterBar navigation={navigation} activeTab="History" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },
  themeButton: {
    padding: 5,
  },
  content: {
    flex: 1,
  },
  filterContainer: {
    paddingVertical: 10,
  },
  filterScrollContainer: {
    paddingHorizontal: 20,
  },
  filterTab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginRight: 15,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  activeFilterTab: {
    backgroundColor: '#E3F2FD',
  },
  filterText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#4A90E2',
    fontWeight: '600',
  },
  controlsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  timeFilterScrollContainer: {
    paddingHorizontal: 0,
  },
  timeFilterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    marginRight: 10,
    gap: 5,
  },
  activeTimeFilterTab: {
    backgroundColor: '#E3F2FD',
  },
  timeFilterText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTimeFilterText: {
    color: '#4A90E2',
    fontWeight: '600',
  },
  workoutList: {
    paddingHorizontal: 20,
  },
  dateSection: {
    marginBottom: 25,
  },
  dateHeader: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginBottom: 15,
  },
  workoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  workoutDetails: {
    flex: 1,
  },
  workoutName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  workoutSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  workoutType: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  workoutStats: {
    alignItems: 'flex-end',
  },
  caloriesText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  timeText: {
    fontSize: 14,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  previousMonthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginVertical: 20,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  previousMonthText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A90E2',
    marginLeft: 8,
  },
  previousMonthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginVertical: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  previousMonthTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  hideButton: {
    padding: 8,
    borderRadius: 8,
  },
  noPreviousDataContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginVertical: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  noPreviousDataText: {
    fontSize: 16,
    color: '#6B7280',
    fontStyle: 'italic',
  },
});

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

export default WorkoutHistoryScreen;
