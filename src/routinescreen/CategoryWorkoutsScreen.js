import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, findNodeHandle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import supabase from '../lib/supabase';

const PRIMARY = '#7B61FF';
const BG = '#F7F7FA';
const CARD = '#fff';
const GRAY = '#6B7280';
const LEVEL_COLORS = {
  Beginner: '#22C55E',
  Intermediate: '#A084E8',
  Advanced: '#F472B6',
};

function AnimatedChip({ label, selected, onPress, chipRef }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withSpring(selected ? 1.12 : 1);
  }, [selected, scale]);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: selected ? '#EDE9FE' : '#F3F4F6',
    shadowColor: selected ? PRIMARY : 'transparent',
    shadowOpacity: selected ? 0.12 : 0,
    shadowRadius: selected ? 8 : 0,
    elevation: selected ? 3 : 0,
  }));
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{ marginRight: 8 }}
    >
      <Animated.View style={[styles.chip, animatedStyle]} ref={chipRef}>
        <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

function AnimatedWorkoutCard({ item, getWorkoutIcon, navigation }) {
  const scale = useSharedValue(1);
  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPressIn={() => { scale.value = withSpring(0.97); }}
      onPressOut={() => { scale.value = withSpring(1); }}
      style={{ flex: 1 }}
      onPress={() => navigation.navigate('ExerciseDetail', { workout: item })}
    >
      <Animated.View style={[styles.workoutCard, animatedCardStyle]}>
        {item.gif_url || item.image_url ? (
          <Image source={{ uri: item.gif_url || item.image_url }} style={styles.thumb} />
        ) : (
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons name={getWorkoutIcon(item)} size={28} color={PRIMARY} />
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.workoutTitle} numberOfLines={2} ellipsizeMode="tail">{item.workout || item.name}</Text>
          <Text style={styles.workoutSub}>{[item.body_part, item.equipment].filter(Boolean).join(' • ')}</Text>
        </View>
        {item.level && (
          <View style={[styles.levelPill, { alignSelf: 'flex-start', marginTop: 2 } ]}>
            <Text style={[styles.levelText, { color: LEVEL_COLORS[item.level] || '#7B61FF' }]}>{item.level}</Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function CategoryWorkoutsScreen() {
  const navigation = useNavigation();

  const [allWorkouts, setAllWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [sortBy, setSortBy] = useState('Muscle'); // 'A–Z' | 'Muscle' | 'Level'
  const [grid, setGrid] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    
    const fetchExercises = async () => {
      try {
        const { data: exerciseData, error: exerciseError } = await supabase
          .from('exercise')
          .select('*');
        
        if (exerciseError) {
          throw exerciseError;
        }
        
        if (!cancelled) {
          setAllWorkouts(Array.isArray(exerciseData) ? exerciseData : []);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Could not load exercises');
          setLoading(false);
          console.error('Exercise library fetch error:', err);
        }
      }
    };
    
    fetchExercises();
    return () => { cancelled = true; };
  }, []);

  // Extract unique muscle groups for filter chips (without "All Groups")
  const muscleGroups = useMemo(() => {
    const groups = new Set();
    allWorkouts.forEach(w => {
      if (w.body_part) {
        w.body_part.split(',').forEach(bp => groups.add(bp.trim()));
      }
    });
    return Array.from(groups).filter(Boolean);
  }, [allWorkouts]);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState('All Equipment');
  const [selectedLevel, setSelectedLevel] = useState('All Levels');

  // Set first muscle group as default when muscle groups are loaded
  useEffect(() => {
    if (muscleGroups.length > 0 && selectedGroup === '') {
      setSelectedGroup(muscleGroups[0]);
    }
  }, [muscleGroups, selectedGroup]);

  // For auto-centering chips
  const chipRefs = useRef([]);
  // Ensure refs array matches muscleGroups length, always reset before render
  if (chipRefs.current.length !== muscleGroups.length) {
    chipRefs.current = muscleGroups.map(() => React.createRef());
  }
  const scrollViewRef = useRef();

  // When selectedGroup changes, scroll the chip into view
  useEffect(() => {
    const idx = muscleGroups.indexOf(selectedGroup);
    const chipRef = chipRefs.current[idx]?.current;
    if (
      idx !== -1 &&
      chipRef &&
      scrollViewRef.current &&
      typeof chipRef.measureLayout === 'function'
    ) {
      chipRef.measureLayout(
        findNodeHandle(scrollViewRef.current),
        (x, y, width, height) => {
          // Center the chip in the ScrollView
          scrollViewRef.current.scrollTo({
            x: x - 150 + width / 2, // 150 is half the screen width (approx)
            animated: true,
          });
        }
      );
    }
  }, [selectedGroup, muscleGroups]);

  // Debounce search input
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(id);
  }, [search]);

  // Derive equipment and level options
  const equipmentOptions = useMemo(() => {
    const set = new Set();
    allWorkouts.forEach(w => { if (w.equipment) set.add(w.equipment.trim()); });
    return ['All Equipment', ...Array.from(set).filter(Boolean)];
  }, [allWorkouts]);

  const levelOptions = useMemo(() => {
    const set = new Set();
    allWorkouts.forEach(w => { if (w.level) set.add(w.level.trim()); });
    // Preserve a nice order if present
    const ordered = ['All Levels', 'Beginner', 'Intermediate', 'Advanced'];
    const rest = Array.from(set).filter(x => !ordered.includes(x));
    return [...ordered.filter(x => x === 'All Levels' || set.has(x)), ...rest];
  }, [allWorkouts]);

  // Filtered workouts
  const filteredWorkouts = useMemo(() => {
    return allWorkouts.filter(w => {
      const name = (w.workout || w.name || '').toLowerCase();
      const matchesGroup = !selectedGroup || (w.body_part && w.body_part.split(',').map(bp => bp.trim()).includes(selectedGroup));
      const matchesEquipment = selectedEquipment === 'All Equipment' || (w.equipment && w.equipment === selectedEquipment);
      const matchesLevel = selectedLevel === 'All Levels' || (w.level && w.level === selectedLevel);
      const matchesSearch = name.includes(debouncedSearch.toLowerCase());
      return matchesGroup && matchesEquipment && matchesLevel && matchesSearch;
    });
  }, [allWorkouts, debouncedSearch, selectedGroup, selectedEquipment, selectedLevel]);

  // Sorted workouts
  const displayedWorkouts = useMemo(() => {
    const list = [...filteredWorkouts];
    if (sortBy === 'A–Z') {
      list.sort((a, b) => (a.workout || a.name || '').localeCompare(b.workout || b.name || ''));
    } else if (sortBy === 'Muscle') {
      list.sort((a, b) => (a.body_part || '').localeCompare(b.body_part || ''));
    } else if (sortBy === 'Level') {
      const order = { 'Beginner': 0, 'Intermediate': 1, 'Advanced': 2 };
      list.sort((a, b) => (order[a.level] ?? 99) - (order[b.level] ?? 99));
    }
    return list;
  }, [filteredWorkouts, sortBy]);

  // Icon selection based on type or body_part (fallback)
  function getWorkoutIcon(w) {
    if (w.type && w.type.toLowerCase().includes('push')) return 'arm-flex';
    if (w.type && w.type.toLowerCase().includes('pull')) return 'weight-lifter';
    if (w.body_part && w.body_part.toLowerCase().includes('chest')) return 'dumbbell';
    if (w.body_part && w.body_part.toLowerCase().includes('shoulder')) return 'human-male';
    if (w.body_part && w.body_part.toLowerCase().includes('tricep')) return 'arm-flex';
    if (w.body_part && w.body_part.toLowerCase().includes('back')) return 'arrow-left'; // valid MaterialCommunityIcons icon
    if (w.body_part && w.body_part.toLowerCase().includes('legs')) return 'run-fast';
    return 'dumbbell';
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: BG }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1, marginBottom: 8, marginLeft: 18, marginRight: 12 }}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={{ marginRight: 12, padding: 12, zIndex: 10 }}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={28} color="#181A20"/>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontFamily: 'Lexend-SemiBold', fontSize: 22, color: '#181A20' }}>Exercise Library</Text>
        </View>
        <TouchableOpacity
          onPress={() => setSearchExpanded(v => !v)}
          accessibilityLabel={searchExpanded ? 'Close search' : 'Open search'}
          style={{ padding: 12, zIndex: 10 }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name={searchExpanded ? 'close' : 'search'} size={22} color={PRIMARY} />
        </TouchableOpacity>
      </View>
      {/* Subtitle */}
      <Text style={{ fontFamily: 'Manrope-Regular', fontSize: 15, color: '#888', marginLeft: 18, marginBottom: 8 }}>
        Browse exercises and filter by muscle group
      </Text>
      {/* Controls Row: Sort + Grid Toggle */}
      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={styles.sortBtn}
          onPress={() => {
            setSortBy(prev => prev === 'A–Z' ? 'Muscle' : prev === 'Muscle' ? 'Level' : 'A–Z');
          }}
          accessibilityLabel={`Sort by ${sortBy}`}
        >
          <Ionicons name="swap-vertical" size={18} color={PRIMARY} />
          <Text style={styles.sortText}>Sort: {sortBy}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.gridToggle} onPress={() => setGrid(g => !g)} accessibilityLabel={grid ? 'Switch to list view' : 'Switch to grid view'}>
          <Ionicons name={grid ? 'list' : 'grid'} size={18} color={PRIMARY} />
          <Text style={styles.gridText}>{grid ? 'List' : 'Grid'}</Text>
        </TouchableOpacity>
      </View>
      {/* Expandable Search */}
      {searchExpanded && (
        <View style={{ backgroundColor: BG }}>
          <View style={styles.searchBarWrap}>
            <Ionicons name="search" size={20} color={GRAY} style={{ marginLeft: 12, marginRight: 6 }} />
            <TextInput
              style={styles.searchBar}
              placeholder="Search exercises"
              placeholderTextColor="#B0B0B0"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              autoFocus
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
      {/* Filter Chips */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: -12, marginBottom: 6, minHeight: 36 }}
        contentContainerStyle={{ alignItems: 'center', paddingLeft: 16, paddingRight: 16 }}
      >
        {muscleGroups.map((group, idx) => (
          <AnimatedChip
            key={group}
            label={group}
            selected={selectedGroup === group}
            onPress={() => setSelectedGroup(group)}
            chipRef={el => (chipRefs.current[idx] = el)}
          />
        ))}
      </ScrollView>

      {/* Equipment Filters */}
      {equipmentOptions.length > 1 && (
        <View style={{ marginTop: 4 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ minHeight: 44 }}
            contentContainerStyle={{ alignItems: 'center', paddingLeft: 16, paddingRight: 16 }}
          >
            {equipmentOptions.map(opt => (
              <TouchableOpacity key={opt} activeOpacity={0.85} onPress={() => setSelectedEquipment(opt)} style={{ marginRight: 8 }}>
                <View style={[styles.smallChip, selectedEquipment === opt && styles.smallChipActive]}>
                  <Text style={[styles.smallChipText, selectedEquipment === opt && styles.smallChipTextActive]}>{opt}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Level Filters */}
      {levelOptions.length > 1 && (
        <View style={{ marginTop: 6 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ minHeight: 44 }}
            contentContainerStyle={{ alignItems: 'center', paddingLeft: 16, paddingRight: 16 }}
          >
            {levelOptions.map(opt => (
              <TouchableOpacity key={opt} activeOpacity={0.85} onPress={() => setSelectedLevel(opt)} style={{ marginRight: 8 }}>
                <View style={[styles.smallChip, selectedLevel === opt && styles.smallChipActive, opt !== 'All Levels' && { borderColor: LEVEL_COLORS[opt] || '#EDE9FE' }]}>
                  <Text style={[styles.smallChipText, selectedLevel === opt && styles.smallChipTextActive]}>{opt}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      
      {/* Result Count */}
      {!loading && !error && (
        <Text style={styles.resultCount}>{displayedWorkouts.length} results</Text>
      )}

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={{ marginTop: 12, color: GRAY }}>Loading exercises...</Text>
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Text style={{ color: GRAY, textAlign: 'center' }}>{error}</Text>
          <TouchableOpacity style={{ marginTop: 12, backgroundColor: '#7B61FF', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 }} onPress={async () => {
            setError(null); setLoading(true);
            // retry fetch
            try {
              const { data: exerciseData, error: exerciseError } = await supabase
                .from('exercise')
                .select('*');
              
              if (exerciseError) {
                throw exerciseError;
              }
              
              setAllWorkouts(Array.isArray(exerciseData) ? exerciseData : []);
              setLoading(false);
            } catch (_err) {
              setError('Could not load exercises');
              setLoading(false);
            }
          }}>
            <Text style={{ color: '#fff', fontFamily: 'Lexend-SemiBold' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          key={grid ? 'grid' : 'list'}
          data={displayedWorkouts}
          keyExtractor={(item, idx) => item.id ? String(item.id) : String(idx)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, flexGrow: 1, justifyContent: 'flex-start' }}
          numColumns={grid ? 2 : 1}
          columnWrapperStyle={grid ? { gap: 12 } : undefined}
          ListHeaderComponent={<View style={{ height: 4 }} />}
          ListFooterComponent={<View style={{ height: 24 }} />}
          renderItem={({ item }) => (
            grid ? (
              <TouchableOpacity
                activeOpacity={0.95}
                onPress={() => navigation.navigate('ExerciseDetail', { workout: item })}
                style={styles.gridCardWrap}
              >
                {(item.gif_url || item.image_url) ? (
                  <Image source={{ uri: item.gif_url || item.image_url }} style={styles.gridThumb} />
                ) : (
                  <View style={[styles.gridThumb, { alignItems: 'center', justifyContent: 'center' }]}> 
                    <MaterialCommunityIcons name={getWorkoutIcon(item)} size={28} color={PRIMARY} />
                  </View>
                )}
                <Text style={styles.gridTitle} numberOfLines={2}>{item.workout || item.name}</Text>
                <Text style={styles.gridSub} numberOfLines={1}>{[item.body_part, item.equipment].filter(Boolean).join(' • ')}</Text>
              </TouchableOpacity>
            ) : (
              <AnimatedWorkoutCard item={item} getWorkoutIcon={getWorkoutIcon} navigation={navigation} />
            )
          )}
          ListEmptyComponent={<Text style={{ color: GRAY, margin: 20, textAlign: 'center' }}>No matches. Try a different muscle group or search term.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  searchBarWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 16, marginHorizontal: 16, marginBottom: 4, height: 44 },
  searchBar: { flex: 1, fontFamily: 'Manrope-Regular', fontSize: 16, color: '#181A20', backgroundColor: 'transparent', paddingHorizontal: 8 },
  clearBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  chip: { minHeight: 36, minWidth: 60, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 18, paddingHorizontal: 18, paddingVertical: 7, marginVertical: 0, ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 1 } }) },
  chipText: { fontFamily: 'Manrope-Regular', fontSize: 15, color: '#888' },
  chipTextActive: { color: '#7B61FF', fontFamily: 'Manrope-Bold' },
  workoutCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 16, marginBottom: 16, padding: 16, shadowColor: '#181A20', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.10, shadowRadius: 12, elevation: 5, minHeight: 80 },
  iconWrap: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#F3F0FF', alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#F3F0FF' },
  workoutTitle: { fontFamily: 'Lexend-SemiBold', fontSize: 17, color: '#181A20' },
  workoutSub: { fontFamily: 'Manrope-Regular', fontSize: 14, color: '#888', marginTop: 2 },
  levelPill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  levelText: { fontFamily: 'Manrope-Bold', fontSize: 13 },
  addBtn: { backgroundColor: '#F3F0FF', borderRadius: 16, padding: 6 },
  resultCount: { fontFamily: 'Manrope-Regular', fontSize: 12, color: '#9CA3AF', marginLeft: 18, marginBottom: 8 },
  smallChip: { height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB', justifyContent: 'center' },
  smallChipActive: { backgroundColor: '#EDE9FE', borderColor: '#C7B6FF' },
  smallChipText: { fontFamily: 'Manrope-Regular', fontSize: 14, color: '#888' },
  smallChipTextActive: { color: '#7B61FF', fontFamily: 'Manrope-Bold' },
  controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginBottom: 0 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  sortText: { marginLeft: 6, fontFamily: 'Manrope-Regular', fontSize: 14, color: '#181A20' },
  gridToggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  gridText: { marginLeft: 6, fontFamily: 'Manrope-Regular', fontSize: 14, color: '#181A20' },
  gridCardWrap: { flex: 1, backgroundColor: CARD, borderRadius: 16, marginBottom: 12, padding: 12, shadowColor: '#181A20', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  gridThumb: { width: '100%', aspectRatio: 1.6, borderRadius: 12, backgroundColor: '#F3F0FF' },
  gridTitle: { fontFamily: 'Lexend-SemiBold', fontSize: 14, color: '#181A20', marginTop: 8 },
  gridSub: { fontFamily: 'Manrope-Regular', fontSize: 12, color: '#888', marginTop: 2 },
});
