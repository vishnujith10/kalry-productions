import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import supabase from '../lib/supabase';

const JournalScreen = () => {
  const navigation = useNavigation();


  const [selectedFilter, setSelectedFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [journalData, setJournalData] = useState({
    today: { meals: [], workouts: [], sleep: [], hydration: [], weight: [] },
    yesterday: { meals: [], workouts: [], sleep: [], hydration: [], weight: [] }
  });
  const [timelineDays, setTimelineDays] = useState([]); // [{dateLabel, entries:{meals,workouts,sleep,hydration,weight}}]
  const [rangeFilter, setRangeFilter] = useState('today'); // 'today' | '7days' | '1month'
  const [showRangeMenu, setShowRangeMenu] = useState(false);

  const filters = ['All', 'Meals', 'Workouts', 'Sleep', 'Hydration', 'Weight'];
  const [showTypeMenu, setShowTypeMenu] = useState(false);

  useEffect(() => {
    fetchJournalData();
  }, [rangeFilter]);

  // Helpers for local day handling
  const getLocalDateString = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const getLocalDayBoundsISO = (date) => {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).toISOString();
    const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).toISOString();
    return { start, end };
  };

  // Format a duration value (assumed seconds) to human-friendly string
  const formatDuration = (seconds) => {
    const sec = Number(seconds) || 0;
    if (sec < 90) return `${Math.max(1, Math.round(sec))}s`;
    const mins = Math.round(sec / 60);
    return `${Math.max(1, mins)}m`;
  };

  const fetchJournalData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        setLoading(false);
        return;
      }

      const todayDate = new Date();
      const yesterdayDate = new Date(Date.now() - 86400000);
      const today = getLocalDateString(todayDate);
      const yesterday = getLocalDateString(yesterdayDate);
      const { start: todayStart, end: todayEnd } = getLocalDayBoundsISO(todayDate);
      const { start: yStart, end: yEnd } = getLocalDayBoundsISO(yesterdayDate);

      // Decide range for "today" section
      let rangeStartISO = todayStart;
      let rangeEndISO = todayEnd;
      let rangeStartDateStr = today; // for date-based tables
      let rangeEndDateStr = today;
      if (rangeFilter === '7days') {
        const start = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() - 6);
        rangeStartISO = new Date(start).toISOString();
        rangeEndISO = todayEnd;
        rangeStartDateStr = getLocalDateString(start);
        rangeEndDateStr = today;
      } else if (rangeFilter === '1month') {
        const start = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
        rangeStartISO = new Date(start).toISOString();
        rangeEndISO = todayEnd;
        rangeStartDateStr = getLocalDateString(start);
        rangeEndDateStr = today;
      }

      // Fetch all data for selected range
      const [mealsRange, cardioRange, routineRange, waterRange, sleepRange, weightRange] = await Promise.all([
        fetchMealsRange(userId, rangeStartISO, rangeEndISO, rangeStartDateStr, rangeEndDateStr),
        fetchCardio(userId, rangeStartISO, rangeEndISO),
        fetchRoutineExercisesRange(userId, rangeStartDateStr, rangeEndDateStr),
        fetchWaterRange(userId, rangeStartDateStr, rangeEndDateStr),
        fetchSleepRange(userId, rangeStartDateStr, rangeEndDateStr),
        fetchWeightRange(userId, rangeStartDateStr, rangeEndDateStr)
      ]);

      // Group by date label
      const byDate = new Map();
      const ensureBucket = (dateStr) => {
        if (!byDate.has(dateStr)) byDate.set(dateStr, { meals: [], workouts: [], sleep: [], hydration: [], weight: [] });
        return byDate.get(dateStr);
      };
      (mealsRange || []).forEach(m => { const b = ensureBucket(m._date); b.meals.push(m); });
      (cardioRange || []).forEach(c => { const b = ensureBucket(c._date); b.workouts.push(c); });
      (routineRange || []).forEach(r => { const b = ensureBucket(r._date); b.workouts.push(r); });
      (waterRange || []).forEach(w => { const b = ensureBucket(w._date); b.hydration.push(w); });
      (sleepRange || []).forEach(s => { const b = ensureBucket(s._date); b.sleep.push(s); });
      (weightRange || []).forEach(w => { const b = ensureBucket(w._date); b.weight.push(w); });

      // Deduplicate any accidental duplicate keys and sort desc
      const sortedDates = Array.from(new Set(byDate.keys())).sort((a,b) => (a < b ? 1 : -1));
      setTimelineDays(sortedDates.map(d => ({ dateLabel: d, entries: byDate.get(d) })));

      setLoading(false);
    } catch (error) {
      console.error('Error fetching journal data:', error);
      setLoading(false);
    }
  };

  const fetchMeals = async (userId, dateStr, startISO, endISO) => {
    try {
      const { data, error } = await supabase
        .from('user_food_logs')
        .select('id, food_name, meal_type, calories, created_at, date_time')
        .eq('user_id', userId)
        .or(`date_time.eq.${dateStr},and(created_at.gte.${startISO},created_at.lte.${endISO})`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(meal => {
        const timeStr = meal.created_at ? new Date(meal.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        return {
          id: `meal-${meal.id}`,
          title: meal.food_name || 'Meal',
          description: `${meal.meal_type || 'Meal'} - ${meal.calories || 0} calories`,
          type: 'meal',
          _time: timeStr
        };
      });
    } catch (error) {
      console.error('Error fetching meals:', error);
      return [];
    }
  };

  const fetchMealsRange = async (userId, startISO, endISO, startDateStr, endDateStr) => {
    try {
      const { data, error } = await supabase
        .from('user_food_logs')
        .select('id, food_name, meal_type, calories, created_at, date_time')
        .eq('user_id', userId)
        .or(`and(date_time.gte.${startDateStr},date_time.lte.${endDateStr}),and(created_at.gte.${startISO},created_at.lte.${endISO})`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(meal => {
        const dateOnly = meal?.date_time
          ? String(meal.date_time).slice(0, 10)
          : (meal.created_at ? meal.created_at.split('T')[0] : startDateStr);
        const timeStr = meal.created_at ? new Date(meal.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        return {
          id: `meal-${meal.id}`,
          title: meal.food_name || 'Meal',
          description: `${meal.meal_type || 'Meal'} - ${meal.calories || 0} calories`,
          type: 'meal',
          _date: dateOnly,
          _time: timeStr
        };
      });
    } catch (error) {
      console.error('Error fetching meals (range):', error);
      return [];
    }
  };

  const fetchCardio = async (userId, startISO, endISO) => {
    try {
      // Primary: saved_cardio_sessions (has user_id)
      const { data: sessions, error: sErr } = await supabase
        .from('saved_cardio_sessions')
        .select('id, name, total_rounds, estimated_time, created_at')
        .eq('user_id', userId)
        .gte('created_at', startISO)
        .lte('created_at', endISO)
        .order('created_at', { ascending: false });
      
      if (sErr) {
        console.error('Error fetching cardio sessions:', sErr);
        return [];
      }
      
      if (sessions && sessions.length) {
        return sessions.map(s => ({
          id: `cardio-${s.id}`,
          title: s.name || 'Cardio',
          description: `Rounds: ${s.total_rounds ?? 1}   ${formatDuration(s.estimated_time || 0)}`,
          type: 'workout',
          _date: s.created_at ? s.created_at.split('T')[0] : '',
          _time: s.created_at ? new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching cardio:', error);
      return [];
    }
  };

  const fetchRoutineExercises = async (userId, dateStr) => {
    try {
      // 1) Get workouts for the local date
      const { data: workouts, error: wErr } = await supabase
        .from('workouts')
        .select('id, created_at')
        .eq('date', dateStr);
      if (wErr) throw wErr;
      const ids = (workouts || []).map(w => w.id);
      const idToTime = new Map((workouts || []).map(w => [w.id, w.created_at]));
      if (!ids.length) return [];
      // 2) Get routine exercises for those workouts
      const { data, error } = await supabase
        .from('daily_routine_exercises')
        .select('id, exercise_name, total_sets, total_reps, workout_id')
        .in('workout_id', ids)
        .order('exercise_name');
      if (error) throw error;
      return (data || []).map(exercise => {
        const ts = idToTime.get(exercise.workout_id);
        const timeStr = ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        return {
          id: `routine-${exercise.id}`,
          title: exercise.exercise_name || 'Exercise',
          description: `${exercise.total_sets || 0} sets × ${exercise.total_reps || 0} reps`,
          type: 'workout',
          _date: (ts ? ts.split('T')[0] : dateStr),
          _time: timeStr
        };
      });
    } catch (error) {
      console.error('Error fetching routine exercises:', error);
      return [];
    }
  };

  const fetchRoutineExercisesRange = async (userId, startDateStr, endDateStr) => {
    try {
      const { data: workouts, error: wErr } = await supabase
        .from('workouts')
        .select('id, date, created_at')
        .gte('date', startDateStr)
        .lte('date', endDateStr);
      if (wErr) throw wErr;
      const ids = (workouts || []).map(w => w.id);
      const idToDate = new Map((workouts || []).map(w => [w.id, w.date]));
      const idToTime = new Map((workouts || []).map(w => [w.id, w.created_at]));
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from('daily_routine_exercises')
        .select('id, exercise_name, total_sets, total_reps, workout_id')
        .in('workout_id', ids)
        .order('exercise_name');
      if (error) throw error;
      return (data || []).map(exercise => {
        const ts = idToTime.get(exercise.workout_id);
        const timeStr = ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        return {
          id: `routine-${exercise.id}`,
          title: exercise.exercise_name || 'Exercise',
          description: `${exercise.total_sets || 0} sets × ${exercise.total_reps || 0} reps`,
          type: 'workout',
          _date: idToDate.get(exercise.workout_id) || startDateStr,
          _time: timeStr
        };
      });
    } catch (error) {
      console.error('Error fetching routine exercises (range):', error);
      return [];
    }
  };

  const fetchWater = async (userId, dateStr) => {
    try {
      const { data, error } = await supabase
        .from('daily_water_intake')
        .select('id, current_intake_ml')
        .eq('user_id', userId)
        .eq('date', dateStr)
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error; // allow no rows
      if (!data) return [];
      return [{
        id: `water-${data.id}`,
        title: 'Hydration Logged',
        description: `${data.current_intake_ml || 0}ml`,
        type: 'hydration'
      }];
    } catch (error) {
      console.error('Error fetching water:', error);
      return [];
    }
  };

  const fetchWaterRange = async (userId, startDateStr, endDateStr) => {
    try {
      const { data, error } = await supabase
        .from('daily_water_intake')
        .select('id, current_intake_ml, date')
        .eq('user_id', userId)
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date', { ascending: false });
      if (error) throw error;
      return (data || []).map(w => ({
        id: `water-${w.id}`,
        title: 'Hydration Logged',
        description: `${w.current_intake_ml || 0}ml`,
        type: 'hydration',
        _date: w.date
      }));
    } catch (error) {
      console.error('Error fetching water (range):', error);
      return [];
    }
  };

  const fetchSleep = async (userId, dateStr) => {
    try {
      const { data, error } = await supabase
        .from('sleep_logs')
        .select('id, duration, quality')
        .eq('user_id', userId)
        .eq('date', dateStr)
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return [];
      return [{
        id: `sleep-${data.id}`,
        title: 'Sleep Logged',
        description: `${data.duration || ''} - Quality: ${data.quality || 'N/A'}`,
        type: 'sleep'
      }];
    } catch (error) {
      console.error('Error fetching sleep:', error);
      return [];
    }
  };

  const fetchSleepRange = async (userId, startDateStr, endDateStr) => {
    try {
      const { data, error } = await supabase
        .from('sleep_logs')
        .select('id, duration, quality, date')
        .eq('user_id', userId)
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date', { ascending: false });
      if (error) throw error;
      return (data || []).map(s => ({
        id: `sleep-${s.id}`,
        title: 'Sleep Logged',
        description: `${s.duration || ''} - Quality: ${s.quality || 'N/A'}`,
        type: 'sleep',
        _date: s.date
      }));
    } catch (error) {
      console.error('Error fetching sleep (range):', error);
      return [];
    }
  };

  const fetchWeightRange = async (userId, startDateStr, endDateStr) => {
    try {
      console.log('📊 Fetching weight logs for range:', startDateStr, 'to', endDateStr);
      
      // 1. Get ALL weight logs for this user (we need historical data)
      const { data: allLogs, error } = await supabase
        .from('weight_logs')
        .select('id, weight, date, note, emoji')
        .eq('user_id', userId)
        .order('date', { ascending: true }); // Oldest first for processing
      
      if (error) throw error;
      
      if (!allLogs || allLogs.length === 0) {
        console.log('⚠️ No weight logs found for user');
        return [];
      }
      
      console.log('✅ Found', allLogs.length, 'weight logs');
      
      // 2. Create a map of date -> weight (only actual logged dates)
      const weightByDate = new Map();
      allLogs.forEach(log => {
        weightByDate.set(log.date, {
          id: log.id,
          weight: log.weight,
          note: log.note,
          emoji: log.emoji,
          date: log.date
        });
      });
      
      // 3. Generate all dates in the range
      const start = new Date(startDateStr);
      const end = new Date(endDateStr);
      const datesInRange = [];
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        datesInRange.push(getLocalDateString(d));
      }
      
      // 4. For each date in range, find the most recent weight up to that date
      const result = [];
      
      for (const dateStr of datesInRange) {
        // Find the most recent weight log on or before this date
        let currentWeight = null;
        
        for (const log of allLogs) {
          if (log.date <= dateStr) {
            currentWeight = {
              id: log.id,
              weight: log.weight,
              note: log.note,
              emoji: log.emoji,
              date: log.date,
              isActualLog: log.date === dateStr // True if logged on this specific date
            };
          } else {
            break; // logs are sorted ascending, so we can break
          }
        }
        
        if (currentWeight) {
          result.push({
            id: `weight-${currentWeight.id}-${dateStr}`,
            title: currentWeight.isActualLog ? 'Weight Logged' : 'Weight (Carried Forward)',
            description: `${currentWeight.weight} kg${currentWeight.note ? ' - ' + currentWeight.note : ''}`,
            type: 'weight',
            _date: dateStr,
            _isActualLog: currentWeight.isActualLog
          });
        }
      }
      
      console.log('✅ Processed weight data for', result.length, 'days');
      return result;
      
    } catch (error) {
      console.error('❌ Error fetching weight (range):', error);
      return [];
    }
  };

  const getIconForType = (type) => {
    switch (type) {
      case 'meal':
        return { icon: 'restaurant', color: '#10B981', bgColor: '#D1FAE5' };
      case 'workout':
        return { icon: 'fitness', color: '#F59E0B', bgColor: '#FEF3C7' };
      case 'sleep':
        return { icon: 'moon', color: '#8B5CF6', bgColor: '#EDE9FE' };
      case 'hydration':
        return { icon: 'water', color: '#3B82F6', bgColor: '#DBEAFE' };
      case 'weight':
        return { icon: 'body', color: '#EF4444', bgColor: '#FEE2E2' };
      default:
        return { icon: 'ellipse', color: '#6B7280', bgColor: '#E5E7EB' };
    }
  };

  const filterEntries = (entries) => {
    if (selectedFilter === 'All') return entries;
    const filterMap = {
      'Meals': 'meal',
      'Workouts': 'workout',
      'Sleep': 'sleep',
      'Hydration': 'hydration',
      'Weight': 'weight'
    };
    return entries.filter(entry => entry.type === filterMap[selectedFilter]);
  };

  const renderJournalEntry = (entry) => {
    const iconData = getIconForType(entry.type);
    
    return (
      <View key={entry.id} style={styles.entryWrapper}>
        {/* Timeline Icon */}
        <View style={styles.timelineIconWrapper}>
          <View style={[styles.timelineIcon, { backgroundColor: iconData.bgColor }]}>
            <Ionicons name={iconData.icon} size={20} color={iconData.color} />
          </View>
        </View>

        {/* Entry Card */}
        <View style={styles.entryCard}>
          <Text style={styles.entryTitle}>{entry.title}</Text>
          {entry.type === 'meal' ? (
            <View style={styles.mealMetaRow}>
              {entry.description ? (
                <Text style={[styles.entryDescription, { flex: 1 }]} numberOfLines={1}>
                  {entry.description}
                </Text>
              ) : <View style={{ flex: 1 }} />}
              {entry._time ? (
                <Text style={styles.entryTime}>{entry._time}</Text>
              ) : null}
            </View>
          ) : (
            entry.description ? (
              <Text style={styles.entryDescription}>{entry.description}</Text>
            ) : null
          )}
        </View>
      </View>
    );
  };

  const renderCategory = (title, entries, type) => {
    const filteredEntries = entries.filter(e => e.type === type);
    
    return (
      <View style={styles.categorySection}>
        <Text style={styles.categoryTitle}>{title}</Text>
        {filteredEntries.length === 0 ? (
          <View style={styles.entryWrapper}>
            <View style={styles.timelineIconWrapper}>
              <View style={[styles.timelineIcon, { backgroundColor: getIconForType(type).bgColor }]}>
                <Ionicons name={getIconForType(type).icon} size={20} color={getIconForType(type).color} />
              </View>
            </View>
            <View style={styles.entryCard}>
              <Text style={styles.noEntryText}>No entry</Text>
            </View>
          </View>
        ) : type === 'meal' && filteredEntries.length > 1 ? (
          <View style={styles.entryWrapper}>
            <View style={styles.timelineIconWrapper}>
              <View style={[styles.timelineIcon, { backgroundColor: getIconForType(type).bgColor }]}>
                <Ionicons name={getIconForType(type).icon} size={20} color={getIconForType(type).color} />
              </View>
            </View>
            <View style={styles.entryCard}>
              {filteredEntries.map((entry, idx) => (
                <View key={entry.id} style={{ marginBottom: idx !== filteredEntries.length - 1 ? 12 : 0 }}>
                  <Text style={styles.entryTitle}>{entry.title}</Text>
                  <View style={styles.mealMetaRow}>
                    {entry.description ? (
                      <Text style={[styles.entryDescription, { flex: 1 }]} numberOfLines={1}>
                        {entry.description}
                      </Text>
                    ) : <View style={{ flex: 1 }} />}
                    {entry._time ? (<Text style={styles.entryTime}>{entry._time}</Text>) : null}
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : (
          // For workouts, combine cardio and routine into one card similar to meals when >1
          type === 'workout' && filteredEntries.length > 1 ? (
            <View style={styles.entryWrapper}>
              <View style={styles.timelineIconWrapper}>
                <View style={[styles.timelineIcon, { backgroundColor: getIconForType(type).bgColor }]}>
                  <Ionicons name={getIconForType(type).icon} size={20} color={getIconForType(type).color} />
                </View>
              </View>
              <View style={styles.entryCard}>
                {filteredEntries.map((entry, idx) => (
                  <View key={entry.id} style={{ marginBottom: idx !== filteredEntries.length - 1 ? 12 : 0 }}>
                    <Text style={styles.entryTitle}>{entry.title}</Text>
                    <View style={styles.mealMetaRow}>
                      {entry.description ? (
                        <Text style={[styles.entryDescription, { flex: 1 }]} numberOfLines={1}>
                          {entry.description}
                        </Text>
                      ) : <View style={{ flex: 1 }} />}
                      {entry._time ? (<Text style={styles.entryTime}>{entry._time}</Text>) : null}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            filteredEntries.map(renderJournalEntry)
          )
        )}
      </View>
    );
  };

  const renderSection = (title, data) => {
    const allEntries = [...data.meals, ...data.workouts, ...data.sleep, ...data.hydration, ...data.weight];
    
    if (selectedFilter === 'All') {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <View style={styles.timelineSection}>
            <View style={styles.timelineLine} />
            <View style={styles.entriesWrapper}>
              {renderCategory('Meals', allEntries, 'meal')}
              {renderCategory('Workouts', allEntries, 'workout')}
              {renderCategory('Sleep', allEntries, 'sleep')}
              {renderCategory('Hydration', allEntries, 'hydration')}
              {renderCategory('Weight', allEntries, 'weight')}
            </View>
          </View>
        </View>
      );
    } else {
      const filtered = filterEntries(allEntries);
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <View style={styles.timelineSection}>
            <View style={styles.timelineLine} />
            <View style={styles.entriesWrapper}>
              {filtered.length === 0 ? (
                <View style={styles.entryWrapper}>
                  <View style={styles.timelineIconWrapper}>
                    <View style={[styles.timelineIcon, { backgroundColor: '#E5E7EB' }]}>
                      <Ionicons name="ellipse" size={20} color="#6B7280" />
                    </View>
                  </View>
                  <View style={styles.entryCard}>
                    <Text style={styles.noEntryText}>No entry</Text>
                  </View>
                </View>
              ) : (
                filtered.map(renderJournalEntry)
              )}
            </View>
          </View>
        </View>
      );
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7B61FF" />
          <Text style={styles.loadingText}>Loading journal...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeftFixed}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.navigate('MainDashboard')}
          >
            <Ionicons name="chevron-back" size={24} color="#374151" />
          </TouchableOpacity>
        </View>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Time Line</Text>
        </View>
        <View style={[styles.rangeDropdownWrapper, styles.headerRightFixed]}> 
          <TouchableOpacity style={styles.rangeDropdownButton} onPress={() => setShowTypeMenu(v => !v)}>
            <Text style={styles.rangeDropdownText}>{selectedFilter}</Text>
            <Ionicons name={showTypeMenu ? 'chevron-up' : 'chevron-down'} size={18} color="#7B61FF" />
          </TouchableOpacity>
          {showTypeMenu && (
            <View style={styles.rangeDropdownMenu}>
              {filters.map((f) => (
                <TouchableOpacity key={f} style={styles.rangeDropdownItem} onPress={() => { setSelectedFilter(f); setShowTypeMenu(false); }}>
                  <Text style={[styles.rangeDropdownItemText, selectedFilter === f && styles.rangeDropdownItemTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Type Filter moved to header */}

      {/* Timeline Content */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.timelineContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{rangeFilter === 'today' ? 'Today' : rangeFilter === '7days' ? 'Last 7 days' : 'This month'}</Text>
            <View style={styles.rangeDropdownWrapper}>
              <TouchableOpacity style={styles.rangeDropdownButton} onPress={() => setShowRangeMenu(v => !v)}>
                <Text style={styles.rangeDropdownText}>{rangeFilter === 'today' ? 'Today' : rangeFilter === '7days' ? '7 days' : '1 month'}</Text>
                <Ionicons name={showRangeMenu ? 'chevron-up' : 'chevron-down'} size={18} color="#7B61FF" />
              </TouchableOpacity>
              {showRangeMenu && (
                <View style={styles.rangeDropdownMenu}>
                  <TouchableOpacity style={styles.rangeDropdownItem} onPress={() => { setRangeFilter('today'); setShowRangeMenu(false); }}>
                    <Text style={[styles.rangeDropdownItemText, rangeFilter === 'today' && styles.rangeDropdownItemTextActive]}>Today</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rangeDropdownItem} onPress={() => { setRangeFilter('7days'); setShowRangeMenu(false); }}>
                    <Text style={[styles.rangeDropdownItemText, rangeFilter === '7days' && styles.rangeDropdownItemTextActive]}>7 days</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rangeDropdownItem} onPress={() => { setRangeFilter('1month'); setShowRangeMenu(false); }}>
                    <Text style={[styles.rangeDropdownItemText, rangeFilter === '1month' && styles.rangeDropdownItemTextActive]}>1 month</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {timelineDays.length === 0 ? (
            <View style={styles.timelineSection}>
              <View style={styles.timelineLine} />
              <View style={styles.entriesWrapper}>
                {selectedFilter === 'All' || selectedFilter === 'Meals' ? renderCategory('Meals', [], 'meal') : null}
                {selectedFilter === 'All' || selectedFilter === 'Workouts' ? renderCategory('Workouts', [], 'workout') : null}
                {selectedFilter === 'All' || selectedFilter === 'Sleep' ? renderCategory('Sleep', [], 'sleep') : null}
                {selectedFilter === 'All' || selectedFilter === 'Hydration' ? renderCategory('Hydration', [], 'hydration') : null}
                {selectedFilter === 'All' || selectedFilter === 'Weight' ? renderCategory('Weight', [], 'weight') : null}
              </View>
            </View>
          ) : (
            timelineDays.map(day => (
              <View key={day.dateLabel} style={{ marginBottom: 24 }}>
                <Text style={styles.dayLabel}>{day.dateLabel}</Text>
                <View style={styles.timelineSection}>
                  <View style={styles.timelineLine} />
                  <View style={styles.entriesWrapper}>
                    { (selectedFilter === 'All' || selectedFilter === 'Meals') &&
                      renderCategory('Meals', [...day.entries.meals, ...day.entries.workouts, ...day.entries.sleep, ...day.entries.hydration, ...day.entries.weight], 'meal') }
                    { (selectedFilter === 'All' || selectedFilter === 'Workouts') &&
                      renderCategory('Workouts', [...day.entries.meals, ...day.entries.workouts, ...day.entries.sleep, ...day.entries.hydration, ...day.entries.weight], 'workout') }
                    { (selectedFilter === 'All' || selectedFilter === 'Sleep') &&
                      renderCategory('Sleep', [...day.entries.meals, ...day.entries.workouts, ...day.entries.sleep, ...day.entries.hydration, ...day.entries.weight], 'sleep') }
                    { (selectedFilter === 'All' || selectedFilter === 'Hydration') &&
                      renderCategory('Hydration', [...day.entries.meals, ...day.entries.workouts, ...day.entries.sleep, ...day.entries.hydration, ...day.entries.weight], 'hydration') }
                    { (selectedFilter === 'All' || selectedFilter === 'Weight') &&
                      renderCategory('Weight', [...day.entries.meals, ...day.entries.workouts, ...day.entries.sleep, ...day.entries.hydration, ...day.entries.weight], 'weight') }
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Bottom Navigation removed as requested */}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Manrope-Regular',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  headerLeftFixed: {
    width: 90,
    alignItems: 'flex-start',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    fontFamily: 'Lexend-Bold',
  },
  headerRightFixed: {
    minWidth: 120,
    alignItems: 'flex-end',
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  filtersContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#EDE9FE',
    marginRight: 10,
  },
  filterButtonActive: {
    backgroundColor: '#7B61FF',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7B61FF',
    fontFamily: 'Lexend-SemiBold',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  timelineContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeaderRow: {
    marginBottom: 8,
    paddingHorizontal: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 24,
    fontFamily: 'Lexend-Bold',
  },
  dayLabel: {
    color: 'grey',
    fontSize: 18,
    fontFamily: 'Lexend-SemiBold',
    marginBottom: 8,
    marginLeft: 56,
    alignSelf: 'flex-start',
  },
  rangeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  rangeDropdownWrapper: {
    position: 'relative',
    zIndex: 1000,
  },
  rangeDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  rangeDropdownText: {
    color: '#7B61FF',
    fontFamily: 'Lexend-SemiBold',
    fontSize: 14,
  },
  rangeDropdownMenu: {
    position: 'absolute',
    top: 44,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 16,
    zIndex: 1001,
    minWidth: 120,
  },
  rangeDropdownItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  rangeDropdownItemText: {
    fontSize: 14,
    color: '#374151',
  },
  rangeDropdownItemTextActive: {
    color: '#7B61FF',
    fontFamily: 'Lexend-SemiBold',
  },
  rangeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#EDE9FE',
  },
  rangeChipActive: {
    backgroundColor: '#7B61FF',
  },
  rangeText: {
    fontSize: 12,
    color: '#7B61FF',
    fontFamily: 'Lexend-SemiBold',
  },
  rangeTextActive: {
    color: '#FFFFFF',
  },
  timelineSection: {
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    left: 19,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#E5E7EB',
  },
  entriesWrapper: {
    paddingLeft: 0,
  },
  categorySection: {
    marginBottom: 20,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    marginLeft: 56,
    fontFamily: 'Lexend-SemiBold',
  },
  entryWrapper: {
    flexDirection: 'row',
    marginBottom: 16,
    position: 'relative',
  },
  timelineIconWrapper: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  timelineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  entryCard: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
    marginLeft: 16,
    marginTop: 0,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  entryTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Lexend-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  entryDescription: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Manrope-Regular',
    color: '#6B7280',
  },
  entryTime: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 12,
    fontFamily: 'Manrope-Regular',
  },
  mealMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  noEntryText: {
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
});

export default JournalScreen;