import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import supabase from '../lib/supabase';
import { fetchExercises } from '../lib/workoutApi';
const { width, height } = Dimensions.get('window');

// Filter options for better exercise discovery
const BODY_PARTS = [
  'Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Full Body',
  'Upper Body', 'Lower Body', 'Glutes', 'Abs', 'Biceps', 'Triceps',
  'Quadriceps', 'Hamstrings', 'Calves', 'Forearms', 'Neck'
];

const EQUIPMENT_TYPES = [
  'Bodyweight', 'Dumbbells', 'Barbell', 'Kettlebell', 'Resistance Bands',
  'Cable Machine', 'Smith Machine', 'Bench', 'Pull-up Bar', 'Dip Bars',
  'Medicine Ball', 'Stability Ball', 'Foam Roller', 'Yoga Mat', 'Treadmill',
  'Stationary Bike', 'Elliptical', 'Rowing Machine', 'Stair Stepper',
  'None', 'Other'
];

const EXERCISE_TYPES = ['Strength', 'Cardio', 'Flexibility', 'Balance', 'Plyometric'];
const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms',
  'Abs', 'Obliques', 'Lower Back', 'Glutes', 'Quadriceps', 'Hamstrings',
  'Calves', 'Full Body', 'Core'
];

export default function AllExercisesScreen({ navigation, route }) {
  const [exercises, setExercises] = useState([]);
  const [filteredExercises, setFilteredExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [exerciseTypeFilter, setExerciseTypeFilter] = useState('');
  const [exerciseMuscleFilter, setExerciseMuscleFilter] = useState('');
  const [exerciseBodyPartFilter, setExerciseBodyPartFilter] = useState('');
  const [exerciseEquipmentFilter, setExerciseEquipmentFilter] = useState('');
  
  // Selection states
  const [selectedExerciseIds, setSelectedExerciseIds] = useState([]);
  const [exerciseDetail, setExerciseDetail] = useState(null);
  const [showExerciseDetail, setShowExerciseDetail] = useState(false);

  // 1. Add modal state for each filter
  const [filterModal, setFilterModal] = useState({ visible: false, type: null });
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customExercise, setCustomExercise] = useState({ name: '', type: '', muscle: '', kcal: '' });
  const [savingCustom, setSavingCustom] = useState(false);

  // Fetch exercises from database
  const fetchExercisesFromDB = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching exercises with filters:', {
        type: exerciseTypeFilter || undefined,
        muscle: exerciseMuscleFilter || undefined,
        bodyPart: exerciseBodyPartFilter || undefined,
        equipment: exerciseEquipmentFilter || undefined,
        search: searchQuery || undefined,
      });
      
      const data = await fetchExercises({
        type: exerciseTypeFilter || undefined,
        muscle: exerciseMuscleFilter || undefined,
        bodyPart: exerciseBodyPartFilter || undefined,
        equipment: exerciseEquipmentFilter || undefined,
        search: searchQuery || undefined,
      });
      
      console.log('Fetched exercises:', data?.length || 0, 'exercises');
      if (data && data.length > 0) {
        console.log('Sample exercise:', data[0]);
      }
      
      setExercises(data || []);
    } catch (e) {
      console.error('Error fetching exercises:', e);
      setError('Failed to load exercises.');
    } finally {
      setLoading(false);
    }
  };

  // Load exercises when screen focuses
  useFocusEffect(
    React.useCallback(() => {
      fetchExercisesFromDB();
    }, [])
  );

  // Memoized filter function for better performance
  const filterExercises = React.useCallback((exerciseList, filters) => {
    const { search, type, muscle, bodyPart, equipment } = filters;
    
    // If no filters are applied, return all exercises
    if (!search && !type && !muscle && !bodyPart && !equipment) {
      return exerciseList;
    }
    
    return exerciseList.filter(ex => {
      // Search filter
      if (search && !ex.name?.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      
      // Type filter
      if (type && !ex.type?.toLowerCase().includes(type.toLowerCase())) {
        return false;
      }
      
      // Muscle filter
      if (muscle && 
          !ex.target_muscles?.toLowerCase().includes(muscle.toLowerCase()) &&
          !ex.secondary_muscles?.toLowerCase().includes(muscle.toLowerCase())) {
        return false;
      }
      
      // Body part filter
      if (bodyPart && !ex.body_parts?.toLowerCase().includes(bodyPart.toLowerCase())) {
        return false;
      }
      
      // Equipment filter
      if (equipment && !ex.equipments?.toLowerCase().includes(equipment.toLowerCase())) {
        return false;
      }
      
      return true;
    });
  }, []);

  // Debounced filter effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const filtered = filterExercises(exercises, {
        search: searchQuery,
        type: exerciseTypeFilter,
        muscle: exerciseMuscleFilter,
        bodyPart: exerciseBodyPartFilter,
        equipment: exerciseEquipmentFilter
      });
      setFilteredExercises(filtered);
    }, 150); // 150ms debounce

    return () => clearTimeout(timeoutId);
  }, [exercises, searchQuery, exerciseTypeFilter, exerciseMuscleFilter, exerciseBodyPartFilter, exerciseEquipmentFilter, filterExercises]);

  const toggleSelectExercise = (id) => {
    setSelectedExerciseIds(prev =>
      prev.includes(id) ? prev.filter(eid => eid !== id) : [...prev, id]
    );
  };

  const handleAddSelectedExercises = () => {
    const selected = exercises.filter(ex => selectedExerciseIds.includes(ex.id));
    
    // Navigate back with selected exercises
    if (route.params?.onExercisesSelected) {
      route.params.onExercisesSelected(selected);
    }
    
    navigation.goBack();
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setExerciseTypeFilter('');
    setExerciseMuscleFilter('');
    setExerciseBodyPartFilter('');
    setExerciseEquipmentFilter('');
  };

  // Memoized renderExerciseItem for better performance
  const renderExerciseItem = React.useCallback(({ item }) => (
    <TouchableOpacity
      style={[
        styles.exerciseListItem,
        selectedExerciseIds.includes(item.id) && styles.exerciseListItemSelected
      ]}
      onPress={() => {
        if (route.params?.onSelect) {
          route.params.onSelect(item);
        }
        navigation.goBack();
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={styles.exerciseIconContainer}>
          {item.gif_url ? (
            <Image
              source={{ uri: item.gif_url }}
              style={styles.exerciseGifIcon}
              resizeMode="cover"
            />
          ) : (
            <Ionicons 
              name="fitness" 
              size={24} 
              color="#7C3AED" 
            />
          )}
        </View>
        <View style={styles.exerciseInfo}>
          <Text style={styles.exerciseName}>
            {item.name || 'Unnamed Exercise'}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {item.body_parts && (
              <View style={{ backgroundColor: '#EDE9FE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                <Text style={{ fontSize: 12, color: '#7C3AED', fontWeight: '500' }}>{item.body_parts}</Text>
              </View>
            )}
            {item.type && (
              <View style={{ backgroundColor: '#EDE9FE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                <Text style={{ fontSize: 12, color: '#7C3AED', fontWeight: '500' }}>{item.type}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      <View style={styles.exerciseActions}>
        {selectedExerciseIds.includes(item.id) && (
          <Ionicons name="checkmark-circle" size={20} color="#7B61FF" />
        )}
      </View>
    </TouchableOpacity>
  ), [selectedExerciseIds, route.params, navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Exercises</Text>
        <View style={styles.headerRight}>
          <Text style={styles.selectedCount}>
            {selectedExerciseIds.length} selected
          </Text>
        </View>
      </View>
      {/* Custom Exercise Button */}
      <TouchableOpacity style={{margin:16, backgroundColor:'#7B61FF', borderRadius:10, padding:12, alignItems:'center'}} onPress={()=>setShowCustomModal(true)}>
        <Text style={{color:'#fff', fontWeight:'bold'}}>+ Create Custom Exercise</Text>
      </TouchableOpacity>

      {/* Modern Filter Section */}
      <View style={styles.filterContainer}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#9CA3AF" style={{ marginRight: 12 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search exercises..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity onPress={fetchExercisesFromDB} style={styles.refreshButton}>
              <Ionicons name="refresh" size={18} color="#7B61FF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter Categories */}
        {/* 2. Replace filter chips with compact filter buttons */}
        <View style={styles.compactFilterRow}>
          <TouchableOpacity style={styles.compactFilterBtn} onPress={() => setFilterModal({ visible: true, type: 'type' })}>
            <Ionicons name="options-outline" size={16} color="#7B61FF" style={{ marginRight: 6 }} />
            <Text style={styles.compactFilterBtnText}>Type</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.compactFilterBtn} onPress={() => setFilterModal({ visible: true, type: 'bodyPart' })}>
            <Ionicons name="body-outline" size={16} color="#7B61FF" style={{ marginRight: 6 }} />
            <Text style={styles.compactFilterBtnText}>Body Part</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.compactFilterBtn} onPress={() => setFilterModal({ visible: true, type: 'equipment' })}>
            <Ionicons name="barbell-outline" size={16} color="#7B61FF" style={{ marginRight: 6 }} />
            <Text style={styles.compactFilterBtnText}>Equipment</Text>
          </TouchableOpacity>
        </View>

        {/* Active Filters Display */}
        {(exerciseTypeFilter || exerciseMuscleFilter || exerciseBodyPartFilter || exerciseEquipmentFilter || searchQuery) && (
          <View style={styles.activeFiltersRow}>
            {exerciseTypeFilter && (
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterText}>Type: {exerciseTypeFilter}</Text>
                <TouchableOpacity onPress={() => setExerciseTypeFilter('')}>
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
            {exerciseMuscleFilter && (
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterText}>Muscle: {exerciseMuscleFilter}</Text>
                <TouchableOpacity onPress={() => setExerciseMuscleFilter('')}>
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
            {exerciseBodyPartFilter && (
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterText}>Body: {exerciseBodyPartFilter}</Text>
                <TouchableOpacity onPress={() => setExerciseBodyPartFilter('')}>
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
            {exerciseEquipmentFilter && (
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterText}>Equip: {exerciseEquipmentFilter}</Text>
                <TouchableOpacity onPress={() => setExerciseEquipmentFilter('')}>
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
            {searchQuery && (
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterText}>Search: &quot;{searchQuery}&quot;</Text>
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Exercise List */}
      <View style={styles.exerciseListContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#7B61FF" />
            <Text style={styles.loadingText}>Loading exercises...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={fetchExercisesFromDB} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredExercises}
            keyExtractor={item => item.id.toString()}
            renderItem={renderExerciseItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.exerciseList}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            initialNumToRender={10}
            windowSize={10}
            getItemLayout={(data, index) => ({
              length: 80, // Approximate height of each item
              offset: 80 * index,
              index,
            })}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="fitness-outline" size={48} color="#9CA3AF" />
                <Text style={styles.emptyText}>No exercises found</Text>
                <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
              </View>
            }
          />
        )}
      </View>

      {/* Add Selected Button */}
      {selectedExerciseIds.length > 0 && (
        <View style={styles.bottomButtonContainer}>
          <TouchableOpacity
            style={styles.addSelectedButton}
            onPress={handleAddSelectedExercises}
          >
            <Text style={styles.addSelectedText}>
              Add {selectedExerciseIds.length} Exercise{selectedExerciseIds.length !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Exercise Detail Modal */}
      {showExerciseDetail && exerciseDetail && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{exerciseDetail.name}</Text>
              <TouchableOpacity onPress={() => setShowExerciseDetail(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              {exerciseDetail.type || 'Exercise'} {exerciseDetail.target_muscles ? `• ${exerciseDetail.target_muscles}` : ''}
            </Text>
            {exerciseDetail.description && (
              <Text style={styles.modalDescription}>{exerciseDetail.description}</Text>
            )}
            {exerciseDetail.kcal && (
              <Text style={styles.modalKcal}>Est. {exerciseDetail.kcal} kcal</Text>
            )}
            <TouchableOpacity 
              style={styles.addToWorkoutButton}
              onPress={() => {
                toggleSelectExercise(exerciseDetail.id);
                setShowExerciseDetail(false);
              }}
            >
              <Text style={styles.addToWorkoutText}>
                {selectedExerciseIds.includes(exerciseDetail.id) ? 'Remove from Selection' : 'Add to Selection'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Custom Exercise Modal */}
      {showCustomModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {maxWidth:400}]}> 
            <Text style={styles.modalTitle}>Create Custom Exercise</Text>
            <TextInput style={styles.input} placeholder="Name" value={customExercise.name} onChangeText={t=>setCustomExercise(e=>({...e,name:t}))} />
            <TextInput style={styles.input} placeholder="Type (e.g. Strength, Cardio)" value={customExercise.type} onChangeText={t=>setCustomExercise(e=>({...e,type:t}))} />
            <TextInput style={styles.input} placeholder="Muscle Group" value={customExercise.muscle} onChangeText={t=>setCustomExercise(e=>({...e,muscle:t}))} />
            <TextInput style={styles.input} placeholder="Est. kcal" value={customExercise.kcal} onChangeText={t=>setCustomExercise(e=>({...e,kcal:t}))} keyboardType="numeric" />
            <View style={{flexDirection:'row',marginTop:16}}>
              <TouchableOpacity style={{flex:1,backgroundColor:'#7B61FF',borderRadius:8,padding:12,alignItems:'center',marginRight:8,opacity:savingCustom?0.6:1}} disabled={savingCustom} onPress={async()=>{
                if(!customExercise.name||!customExercise.type){Alert.alert('Name and Type required');return;}
                setSavingCustom(true);
                try{
                  const {data,error}=await supabase.from('exercises').insert([{name:customExercise.name,type:customExercise.type,muscle:customExercise.muscle,kcal:Number(customExercise.kcal)||0,custom:true}]);
                  if(error) throw error;
                  setShowCustomModal(false);
                  setCustomExercise({name:'',type:'',muscle:'',kcal:''});
                  fetchExercisesFromDB();
                }catch(e){
                  Alert.alert('Error',e.message||'Failed to save');
                }finally{
                  setSavingCustom(false);
                }
              }}><Text style={{color:'#fff',fontWeight:'bold'}}>{savingCustom?'Saving...':'Save'}</Text></TouchableOpacity>
              <TouchableOpacity style={{flex:1,backgroundColor:'#E5E7EB',borderRadius:8,padding:12,alignItems:'center'}} onPress={()=>{if(!savingCustom){setShowCustomModal(false);}}}><Text style={{color:'#222'}}>Cancel</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* 3. Add modal for filter selection */}
      {filterModal.visible && (
        <View style={styles.filterModalOverlay}>
          <View style={styles.filterModalContent}>
            <Text style={styles.filterModalTitle}>
              {filterModal.type === 'type' && 'Select Type'}
              {filterModal.type === 'bodyPart' && 'Select Body Part'}
              {filterModal.type === 'equipment' && 'Select Equipment'}
            </Text>
            <ScrollView style={{ maxHeight: 320, width: '100%' }}>
              {(filterModal.type === 'type' ? EXERCISE_TYPES : filterModal.type === 'bodyPart' ? BODY_PARTS : EQUIPMENT_TYPES).map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.filterModalOption,
                    (filterModal.type === 'type' && exerciseTypeFilter === opt) ||
                    (filterModal.type === 'bodyPart' && exerciseBodyPartFilter === opt) ||
                    (filterModal.type === 'equipment' && exerciseEquipmentFilter === opt)
                      ? styles.filterModalOptionSelected : null
                  ]}
                  onPress={() => {
                    if (filterModal.type === 'type') setExerciseTypeFilter(exerciseTypeFilter === opt ? '' : opt);
                    if (filterModal.type === 'bodyPart') setExerciseBodyPartFilter(exerciseBodyPartFilter === opt ? '' : opt);
                    if (filterModal.type === 'equipment') setExerciseEquipmentFilter(exerciseEquipmentFilter === opt ? '' : opt);
                    setFilterModal({ visible: false, type: null });
                  }}
                >
                  <Text style={styles.filterModalOptionText}>{opt}</Text>
                  {((filterModal.type === 'type' && exerciseTypeFilter === opt) ||
                    (filterModal.type === 'bodyPart' && exerciseBodyPartFilter === opt) ||
                    (filterModal.type === 'equipment' && exerciseEquipmentFilter === opt)) && (
                    <Ionicons name="checkmark" size={18} color="#7B61FF" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.filterModalCancel} onPress={() => setFilterModal({ visible: false, type: null })}>
              <Text style={styles.filterModalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerRight: {
    minWidth: 80,
  },
  selectedCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7B61FF',
    textAlign: 'right',
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    marginRight: 8,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  compactFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 4,
  },
  compactFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginHorizontal: 2,
  },
  compactFilterBtnText: {
    color: '#1F2937',
    fontWeight: '600',
    fontSize: 14,
  },
  filterModalOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  filterModalContent: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 24,
    width: '80%',
    maxWidth: 340,
    alignItems: 'center',
  },
  filterModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 18,
  },
  filterModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: '#F3F4F6',
  },
  filterModalOptionSelected: {
    backgroundColor: '#7B61FF22',
  },
  filterModalOptionText: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  filterModalCancel: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  filterModalCancelText: {
    color: '#7B61FF',
    fontWeight: '600',
    fontSize: 16,
  },
  filterScrollView: {
    marginBottom: 16,
  },
  filterSection: {
    marginRight: 24,
    minWidth: 120,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#7B61FF',
    borderColor: '#7B61FF',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  activeFiltersContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  activeFiltersTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  activeFiltersChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7B61FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 8,
  },
  activeFilterText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  clearAllButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  exerciseListContainer: {
    flex: 1,
  },
  exerciseList: {
    padding: 20,
  },
  exerciseListItem: {
    padding: 16,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  exerciseListItemSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#7B61FF',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  exerciseIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  exerciseGifIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 17,
    color: '#1F2937',
    fontWeight: '600',
    marginBottom: 4,
  },
  exerciseDetails: {
    color: '#6B7280',
    fontSize: 14,
  },
  exerciseActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#7B61FF',
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
  },
  bottomButtonContainer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  addSelectedButton: {
    backgroundColor: '#7B61FF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addSelectedText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 16,
  },
  modalDescription: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 16,
  },
  modalKcal: {
    fontSize: 15,
    color: '#7B61FF',
    fontWeight: '600',
    marginBottom: 20,
  },
  addToWorkoutButton: {
    backgroundColor: '#7B61FF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addToWorkoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  activeFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 6,
    marginLeft: 2,
    flexWrap: 'wrap',
  },
  input: {
    width: '100%',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
    fontSize: 16,
    color: '#1F2937',
  },
}); 