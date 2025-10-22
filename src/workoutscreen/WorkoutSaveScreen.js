import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import supabase from '../lib/supabase';

const COLORS = {
  primary: '#7C3AED',
  primaryLight: '#A084E8',
  background: '#E8E9F0',
  surface: '#FFFFFF',
  text: '#181A20',
  textSecondary: '#666666',
  textMuted: '#999999',
  border: '#E5E7EB',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
};

export default function SavedCardioSessionsScreen({ route }) {
  const [cardioSessions, setCardioSessions] = useState([]);
  const [routineSessions, setRoutineSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(route?.params?.activeTab || 'cardio');
  const [showMenuForSession, setShowMenuForSession] = useState(null);
  const navigation = useNavigation();

  useEffect(() => {
    fetchSessions();
  }, []);

  // Handle route parameter changes
  useEffect(() => {
    if (route?.params?.activeTab) {
      setActiveTab(route.params.activeTab);
    }
  }, [route?.params?.activeTab]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchSessions();
    }, [])
  );

  const fetchSessions = async () => {
    setLoading(true);
    
    try {
      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      
      if (!userId) {
        console.log('No user session found');
        setLoading(false);
        return;
      }

      // Fetch saved cardio sessions with exercise names
      const { data: cardioData, error: cardioError } = await supabase
        .from('saved_cardio_sessions')
        .select(`
          id,
          name,
          total_rounds,
          rest_between_rounds,
          estimated_time,
          estimated_calories,
          created_at,
          saved_cardio_exercises (
            exercise_name,
            duration,
            rest,
            order_index,
            image_url
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (cardioError) {
        console.error('Error fetching cardio sessions:', cardioError);
      } else {
        // Filter out sessions with no exercises
        const filteredCardioData = (cardioData || []).filter(session => 
          session.saved_cardio_exercises && 
          session.saved_cardio_exercises.length > 0 &&
          session.saved_cardio_exercises.some(ex => ex.exercise_name)
        );
        setCardioSessions(filteredCardioData);
      }

      // Fetch saved routine sessions (from workouts table with 'Saved Routine' notes)
      const { data: routineData, error: routineError } = await supabase
        .from('workouts')
        .select(`
          id,
          date,
          duration,
          total_kcal,
          created_at,
          saved_routine_exercises (
            id,
            exercise_id,
            exercise_name,
            duration,
            image_url,
            order,
            total_sets,
            total_reps,
            total_weight,
            exercise (
              name,
              gif_url
            )
          )
        `)
        .eq('user_id', userId)
        .eq('notes', 'Saved Routine')
        .order('created_at', { ascending: false });

      if (routineError) {
        console.error('Error fetching routine sessions:', routineError);
      } else {
        // Transform routine data to match expected format
        const transformedRoutines = (routineData || [])
          .filter(routine => {
            // Only show routines that have exercises
            const exerciseCount = routine.saved_routine_exercises?.length || 0;
            return exerciseCount > 0;
          })
          .map(routine => {
            const exerciseCount = routine.saved_routine_exercises?.length || 0;
            const exerciseNames = routine.saved_routine_exercises?.map(ex => ex.exercise_name || ex.exercise?.name).filter(Boolean) || [];
            
            return {
              id: routine.id,
              name: exerciseNames.length > 0 
                ? (exerciseNames.length <= 2 
                    ? exerciseNames.join(', ')
                    : `${exerciseNames.slice(0, 2).join(', ')} +${exerciseNames.length - 2} more`)
                : `Routine (${exerciseCount} exercises)`,
              total_rounds: 0, // Routines don't have rounds concept
              estimated_time: routine.duration || 0,
              estimated_calories: routine.total_kcal || 0,
              saved_routine_exercises: routine.saved_routine_exercises || [],
              date: routine.date,
              created_at: routine.created_at,
              exercise_count: exerciseCount
            };
          });
        setRoutineSessions(transformedRoutines);
      }

    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (session, type) => {
    try {
      const { data: { session: userSession } } = await supabase.auth.getSession();
      const userId = userSession?.user?.id;
      
      if (!userId) {
        Alert.alert('Error', 'User not logged in');
        return;
      }

      if (type === 'cardio') {
        // Delete from saved_cardio_sessions
        const { error } = await supabase
          .from('saved_cardio_sessions')
          .delete()
          .eq('id', session.id)
          .eq('user_id', userId);

        if (error) throw error;
        
        // Update local state
        setCardioSessions(prev => prev.filter(s => s.id !== session.id));
        
        Alert.alert(
          'Session Deleted',
          'The cardio session has been deleted successfully.',
          [{ text: 'OK' }]
        );
      } else {
        // Delete from workouts table
        const { error } = await supabase
          .from('workouts')
          .delete()
          .eq('id', session.id)
          .eq('user_id', userId);

        if (error) throw error;
        
        // Update local state
        setRoutineSessions(prev => prev.filter(s => s.id !== session.id));
        
        Alert.alert(
          'Session Deleted',
          'The routine session has been deleted successfully.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      Alert.alert('Error', 'Failed to delete session. Please try again.');
    }
  };

  const showDeleteConfirmation = (session, type) => {
    Alert.alert(
      'Delete Session',
      `Are you sure you want to delete this ${type} session? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: () => handleDeleteSession(session, type)
        },
      ]
    );
  };

  const renderSessionCard = (session, type) => (
    <TouchableOpacity
      key={session.id}
      style={styles.sessionCard}
      onPress={() => {
        if (type === 'cardio') {
          navigation.navigate('CardioPlayerScreen', { session });
        } else {
          // TODO: Navigate to routine player
          console.log('Routine session:', session);
        }
      }}
    >
      <View style={styles.sessionHeader}>
        <View style={styles.sessionIcon}>
          {type === 'cardio' ? (
            session.saved_cardio_exercises && session.saved_cardio_exercises.length > 0 && session.saved_cardio_exercises[0].image_url ? (
              <Image
                source={{ uri: session.saved_cardio_exercises[0].image_url }}
                style={styles.sessionGif}
                resizeMode="cover"
              />
            ) : (
              <Ionicons 
                name="fitness" 
                size={24} 
                color={COLORS.primary} 
              />
            )
          ) : (
            session.saved_routine_exercises && session.saved_routine_exercises.length > 0 && (session.saved_routine_exercises[0].image_url || session.saved_routine_exercises[0].exercise?.gif_url) ? (
              <Image
                source={{ uri: session.saved_routine_exercises[0].image_url || session.saved_routine_exercises[0].exercise.gif_url }}
                style={styles.sessionGif}
                resizeMode="cover"
              />
            ) : (
              <Ionicons 
                name="barbell" 
                size={24} 
                color={COLORS.primary} 
              />
            )
          )}
        </View>
        <View style={styles.sessionInfo}>
          <View style={styles.sessionNameRow}>
            <Text style={styles.sessionName}>
              {type === 'cardio' ? (
                session.saved_cardio_exercises && session.saved_cardio_exercises.length > 0
                  ? (() => {
                      const exerciseNames = session.saved_cardio_exercises
                        .sort((a, b) => a.order_index - b.order_index)
                        .map(ex => ex.exercise_name)
                        .filter(name => name); // Filter out null/undefined names
                      
                      if (exerciseNames.length === 0) {
                        return 'Empty Session';
                      } else if (exerciseNames.length <= 2) {
                        return exerciseNames.join(', ');
                      } else {
                        return `${exerciseNames.slice(0, 2).join(', ')} +${exerciseNames.length - 2} more`;
                      }
                    })()
                  : 'Empty Session'
              ) : (
                session.name
              )}
            </Text>
            <TouchableOpacity 
              style={styles.sessionMoreButton}
              onPress={(e) => {
                e.stopPropagation();
                setShowMenuForSession(showMenuForSession === session.id ? null : session.id);
              }}
            >
              <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.sessionDetails}>
            <View style={styles.detailItem}>
              <Ionicons name={type === 'cardio' ? "repeat" : "barbell"} size={14} color={COLORS.textMuted} />
              <Text style={styles.detailText}>
                {type === 'cardio' 
                  ? `${session.total_rounds} rounds`
                  : `${session.exercise_count || session.saved_routine_exercises?.length || 0} exercises`
                }
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="time" size={14} color={COLORS.textMuted} />
              <Text style={styles.detailText}>
                {(() => {
                  const duration = session.estimated_time || 0;
                  if (duration < 60) {
                    return `${duration} sec`;
                  } else {
                    const minutes = Math.round(duration / 60);
                    return `${minutes} min`;
                  }
                })()}
              </Text>
            </View>
            {type === 'cardio' && session.saved_cardio_exercises && session.saved_cardio_exercises.length > 0 && session.saved_cardio_exercises[0].rest && (
              <View style={styles.detailItem}>
                <Ionicons name="pause" size={14} color={COLORS.textMuted} />
                <Text style={styles.detailText}>
                  {(() => {
                    const restTime = session.saved_cardio_exercises[0].rest || 0;
                    return `${restTime} sec rest`;
                  })()}
                </Text>
              </View>
            )}
            {session.estimated_calories && (
              <View style={styles.detailItem}>
                <Ionicons name="flame" size={14} color={COLORS.textMuted} />
                <Text style={styles.detailText}>{session.estimated_calories} cal</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Three-dots menu */}
      {showMenuForSession === session.id && (
        <View style={styles.sessionMenuOverlay}>
          <TouchableOpacity 
            style={styles.sessionMenuItem}
            onPress={() => {
              setShowMenuForSession(null);
              showDeleteConfirmation(session, type);
            }}
          >
            <Ionicons name="trash" size={18} color={COLORS.error} />
            <Text style={[styles.sessionMenuText, { color: COLORS.error }]}>Delete Session</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <View style={styles.sessionActions}>
        <TouchableOpacity
          style={styles.playButton}
          onPress={() => {
            if (type === 'cardio') {
              // Transform session data to match StartWorkoutScreen expectations
              const transformedExercises = session.saved_cardio_exercises?.map(exercise => ({
                id: exercise.id || Date.now().toString(36) + Math.random().toString(36).substr(2),
                name: exercise.exercise_name,
                workout: exercise.exercise_name, // StartWorkoutScreen also checks exercise.workout
                duration: exercise.duration,
                rest: exercise.rest,
                rounds: exercise.rounds || 1,
                gif_url: exercise.image_url, // StartWorkoutScreen expects gif_url
                sets: [] // StartWorkoutScreen will add sets as needed
              })) || [];
              
              navigation.navigate('WorkoutStart', {
                exercises: transformedExercises,
                sessionType: 'Cardio',
                intensity: 'Medium', // Default intensity
                restBetweenRounds: session.rest_between_rounds || 0,
                sessionData: {
                  estimated_time: session.estimated_time,
                  estimated_calories: session.estimated_calories,
                  name: session.name
                }
              });
            } else {
              // Transform routine session data to match StartWorkoutScreen expectations
              const transformedExercises = session.saved_routine_exercises?.map(exercise => ({
                id: exercise.id || Date.now().toString(36) + Math.random().toString(36).substr(2),
                name: exercise.exercise_name || exercise.exercise?.name,
                workout: exercise.exercise_name || exercise.exercise?.name, // StartWorkoutScreen also checks exercise.workout
                muscle: exercise.exercise?.muscle || exercise.muscle || 'General',
                body_part: exercise.exercise?.body_part || exercise.body_part || 'General',
                gif_url: exercise.image_url || exercise.exercise?.gif_url, // StartWorkoutScreen expects gif_url
                sets: [] // StartWorkoutScreen will add sets as needed
              })) || [];
              
              navigation.navigate('StartWorkout', {
                exercises: transformedExercises,
                sessionType: 'Routine',
                intensity: 'Medium', // Default intensity
                sessionData: {
                  estimated_time: session.estimated_time,
                  estimated_calories: session.estimated_calories,
                  name: session.name
                }
              });
            }
          }}
        >
          <Ionicons name="play" size={16} color={COLORS.surface} />
          <Text style={styles.playButtonText}>Play</Text>
        </TouchableOpacity>
      </View>
          </TouchableOpacity>
  );

  const renderEmptyState = (type) => (
    <View style={styles.emptyState}>
      <Ionicons 
        name={type === 'cardio' ? 'heart-outline' : 'barbell-outline'} 
        size={48} 
        color={COLORS.textMuted} 
      />
      <Text style={styles.emptyTitle}>No {type} sessions saved</Text>
      <Text style={styles.emptySubtitle}>
        Create and save your {type} workouts to see them here
      </Text>
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => {
          if (type === 'cardio') {
            navigation.navigate('CreateWorkoutScreen');
          } else {
            // TODO: Navigate to routine creation
            console.log('Create routine session');
          }
        }}
      >
        <Ionicons name="add" size={16} color={COLORS.surface} />
        <Text style={styles.createButtonText}>Create {type === 'cardio' ? 'Cardio' : 'Routine'} Session</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading sessions...</Text>
        </View>
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.navigate('Exercise')}
        >
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Workouts</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'cardio' && styles.activeTab]}
          onPress={() => setActiveTab('cardio')}
        >
          <Ionicons 
            name="heart" 
            size={20} 
            color={activeTab === 'cardio' ? COLORS.surface : COLORS.textSecondary} 
          />
          <Text style={[
            styles.tabText,
            activeTab === 'cardio' && styles.activeTabText
          ]}>
            Cardio
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'routines' && styles.activeTab]}
          onPress={() => setActiveTab('routines')}
        >
          <Ionicons 
            name="barbell" 
            size={20} 
            color={activeTab === 'routines' ? COLORS.surface : COLORS.textSecondary} 
          />
          <Text style={[
            styles.tabText,
            activeTab === 'routines' && styles.activeTabText
          ]}>
            Routines
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <TouchableWithoutFeedback onPress={() => setShowMenuForSession(null)}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {activeTab === 'cardio' ? (
            cardioSessions.length > 0 ? (
              cardioSessions.map(session => renderSessionCard(session, 'cardio'))
            ) : (
              renderEmptyState('cardio')
            )
          ) : (
            routineSessions.length > 0 ? (
              routineSessions.map(session => renderSessionCard(session, 'routines'))
            ) : (
              renderEmptyState('routines')
            )
          )}
        </View>
      </ScrollView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  activeTabText: {
    color: COLORS.surface,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sessionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  sessionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primaryLight + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sessionGif: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sessionName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  sessionMoreButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    marginLeft: 8,
  },
  sessionDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginLeft: 4,
  },
  sessionActions: {
    flexDirection: 'row',
    gap: 12,
  },
  playButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  playButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.surface,
    marginLeft: 6,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.surface,
    marginLeft: 6,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  sessionMenuOverlay: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1000,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 160,
  },
  sessionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  sessionMenuText: {
    fontSize: 16,
    fontWeight: '500',
  },
});