/**
 * DATA ACCURACY & SYNCHRONIZATION SYSTEM
 * Addresses: Sync issues, calorie discrepancies, crash recovery
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export class DataSyncEngine {
  constructor() {
    // Priority hierarchy for data sources
    this.sourcePriority = {
      'user_manual': 1,      // Highest trust
      'verified_database': 2, // USDA, verified sources
      'user_contributed': 3,  // Community database
      'estimated': 4,         // AI/ML estimates
      'generic_database': 5   // Lowest trust
    };
    
    this.syncQueue = [];
    this.syncInterval = null;
    this.retryAttempts = 3;
  }

  // Resolve conflicting calorie data from multiple sources
  resolveCalorieConflict(foodName, sources) {
    // Sort by priority
    const sortedSources = sources.sort((a, b) => 
      this.sourcePriority[a.type] - this.sourcePriority[b.type]
    );
    
    const calorieValues = sources.map(s => s.calories);
    const min = Math.min(...calorieValues);
    const max = Math.max(...calorieValues);
    const avg = calorieValues.reduce((sum, val) => sum + val, 0) / calorieValues.length;
    
    // Calculate variance
    const variance = max - min;
    const percentVariance = (variance / avg) * 100;
    
    // High variance = show range
    if (percentVariance > 20) {
      return {
        displayValue: `${min}-${max} cal`,
        primaryValue: sortedSources[0].calories, // Use highest priority for calculations
        confidence: 'low',
        explanation: `Calorie estimates vary by source. We're showing the range.`,
        sources: sortedSources.map(s => ({
          name: s.name,
          calories: s.calories,
          type: s.type
        })),
        userAction: {
          prompt: 'Which seems most accurate to you?',
          options: sortedSources.map(s => `${s.calories} cal (${s.name})`)
        }
      };
    }
    
    // Low variance = use highest priority source
    return {
      displayValue: `${sortedSources[0].calories} cal`,
      primaryValue: sortedSources[0].calories,
      confidence: 'high',
      source: sortedSources[0].name,
      explanation: variance > 50 ? `Other sources showed ${min}-${max} cal` : null
    };
  }

  // Auto-save with debouncing
  autoSave(data, key) {
    // Clear previous timer
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
    
    // Save to local storage immediately (sync)
    try {
      AsyncStorage.setItem(`draft_${key}`, JSON.stringify({
        data,
        timestamp: Date.now(),
        key
      }));
    } catch (e) {
      console.error('Local save failed:', e);
    }
    
    // Debounce cloud sync (async)
    this.autoSaveTimer = setTimeout(() => {
      this.queueCloudSync(data, key);
    }, 500); // 500ms after user stops typing
  }

  // Queue system for cloud sync (prevents data loss)
  queueCloudSync(data, key) {
    const syncItem = {
      id: Date.now() + Math.random(),
      data,
      key,
      timestamp: Date.now(),
      attempts: 0,
      status: 'pending'
    };
    
    this.syncQueue.push(syncItem);
    this.processSyncQueue();
  }

  async processSyncQueue() {
    if (this.isSyncing) return; // Prevent concurrent syncs
    
    this.isSyncing = true;
    
    const pendingItems = this.syncQueue.filter(item => 
      item.status === 'pending' && item.attempts < this.retryAttempts
    );
    
    for (const item of pendingItems) {
      try {
        await this.syncToCloud(item.data, item.key);
        item.status = 'synced';
        
        // Remove from local storage once synced
        AsyncStorage.removeItem(`draft_${item.key}`);
        
      } catch (error) {
        item.attempts++;
        item.status = item.attempts >= this.retryAttempts ? 'failed' : 'pending';
        item.lastError = error.message;
        
        console.error(`Sync failed for ${item.key} (attempt ${item.attempts}):`, error);
      }
    }
    
    // Remove successfully synced items
    this.syncQueue = this.syncQueue.filter(item => item.status !== 'synced');
    
    this.isSyncing = false;
    
    // Retry failed items after delay
    if (this.syncQueue.length > 0) {
      setTimeout(() => this.processSyncQueue(), 5000); // Retry in 5s
    }
  }

  async syncToCloud(data, key) {
    // Replace with your actual Supabase sync
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate 10% failure rate for testing
        if (Math.random() > 0.9) {
          reject(new Error('Network error'));
        } else {
          resolve({ success: true });
        }
      }, 1000);
    });
  }

  // Crash recovery
  async recoverUnsavedData() {
    const recovered = [];
    
    try {
      // Get all keys from AsyncStorage
      const keys = await AsyncStorage.getAllKeys();
      const draftKeys = keys.filter(key => key.startsWith('draft_'));
      
      for (const key of draftKeys) {
        try {
          const itemData = await AsyncStorage.getItem(key);
          if (itemData) {
            const item = JSON.parse(itemData);
            const ageMinutes = (Date.now() - item.timestamp) / 1000 / 60;
            
            // Only recover recent drafts (< 24 hours old)
            if (ageMinutes < 1440) {
              recovered.push({
                key: item.key,
                data: item.data,
                ageMinutes: Math.round(ageMinutes)
              });
            } else {
              // Clean up old drafts
              await AsyncStorage.removeItem(key);
            }
          }
        } catch (e) {
          console.error('Failed to parse draft:', e);
        }
      }
    } catch (e) {
      console.error('Failed to recover unsaved data:', e);
    }
    
    return recovered;
  }

  // Exercise calorie calculation (accurate using METs)
  calculateExerciseCalories(exercise, userWeight, duration) {
    // MET (Metabolic Equivalent of Task) values
    const MET_VALUES = {
      // Cardio
      walking_slow: 2.5,
      walking_moderate: 3.5,
      walking_fast: 4.5,
      running_5mph: 8.0,
      running_6mph: 9.8,
      running_7mph: 11.0,
      running_8mph: 11.8,
      cycling_leisure: 4.0,
      cycling_moderate: 8.0,
      cycling_vigorous: 12.0,
      swimming_leisure: 6.0,
      swimming_vigorous: 10.0,
      
      // Strength
      weight_training_light: 3.0,
      weight_training_moderate: 5.0,
      weight_training_vigorous: 6.0,
      
      // Sports
      basketball: 6.5,
      soccer: 7.0,
      tennis: 7.3,
      yoga: 2.5,
      pilates: 3.0
    };
    
    const met = MET_VALUES[exercise.type] || 5.0; // Default moderate intensity
    
    // Formula: Calories = MET × weight(kg) × duration(hours)
    const hours = duration / 60;
    const baseCalories = met * userWeight * hours;
    
    // Adjust for heart rate if available (more accurate)
    if (exercise.avgHeartRate && exercise.maxHeartRate) {
      const intensityFactor = exercise.avgHeartRate / exercise.maxHeartRate;
      const adjustedCalories = baseCalories * (0.8 + (intensityFactor * 0.4));
      
      return {
        calories: Math.round(adjustedCalories),
        range: {
          min: Math.round(adjustedCalories * 0.85),
          max: Math.round(adjustedCalories * 1.15)
        },
        confidence: 'high',
        method: 'MET + Heart Rate',
        displayText: `Burned approximately ${Math.round(adjustedCalories)} cal (range: ${Math.round(adjustedCalories * 0.85)}-${Math.round(adjustedCalories * 1.15)})`
      };
    }
    
    // Without heart rate data
    return {
      calories: Math.round(baseCalories),
      range: {
        min: Math.round(baseCalories * 0.75),
        max: Math.round(baseCalories * 1.25)
      },
      confidence: 'medium',
      method: 'MET estimation',
      displayText: `Burned approximately ${Math.round(baseCalories)} cal`,
      note: 'Connect a heart rate monitor for more accurate tracking'
    };
  }

  // Handle exercise calories in daily goal
  handleExerciseCalories(baseGoal, exerciseCalories, userPreference) {
    const options = {
      // Don't eat back exercise calories (most accurate for weight loss)
      maintain_deficit: {
        adjustedGoal: baseGoal, // No change
        explanation: 'Exercise creates additional deficit for faster progress',
        totalBudget: baseGoal.target
      },
      
      // Eat back 50% (conservative approach)
      eat_half_back: {
        adjustedGoal: {
          min: baseGoal.min + (exerciseCalories.calories * 0.5),
          target: baseGoal.target + (exerciseCalories.calories * 0.5),
          max: baseGoal.max + (exerciseCalories.calories * 0.5)
        },
        explanation: 'Eating back half of exercise calories maintains steady progress',
        totalBudget: baseGoal.target + (exerciseCalories.calories * 0.5)
      },
      
      // Eat back all exercise calories (maintenance)
      eat_all_back: {
        adjustedGoal: {
          min: baseGoal.min + exerciseCalories.calories,
          target: baseGoal.target + exerciseCalories.calories,
          max: baseGoal.max + exerciseCalories.calories
        },
        explanation: 'Eating exercise calories back maintains current weight',
        totalBudget: baseGoal.target + exerciseCalories.calories
      }
    };
    
    return options[userPreference] || options.maintain_deficit;
  }

  // Show sync status to user
  getSyncStatus() {
    const pending = this.syncQueue.filter(i => i.status === 'pending').length;
    const failed = this.syncQueue.filter(i => i.status === 'failed').length;
    
    if (failed > 0) {
      return {
        status: 'error',
        message: `${failed} items failed to sync. Check your connection.`,
        action: 'Retry now'
      };
    }
    
    if (pending > 0) {
      return {
        status: 'syncing',
        message: `Syncing ${pending} items...`,
        action: null
      };
    }
    
    return {
      status: 'synced',
      message: 'All data synced ✓',
      action: null
    };
  }
}
