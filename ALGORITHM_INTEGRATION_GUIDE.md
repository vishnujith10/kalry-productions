# Kalry Algorithm Integration Guide

This guide explains how to integrate the four production-ready algorithms into your Kalry fitness app to solve the major user problems.

## 🎯 What These Algorithms Solve

### 1. **Adaptive Goal-Setting Algorithm**
- **Problem**: Unrealistic calorie goals, one-size-fits-all approach
- **Solution**: Dynamic goals based on biology, context, and adherence patterns
- **Features**: BMR calculation, biological adjustments, flexible ranges

### 2. **Compassionate Feedback System**
- **Problem**: Shame, demotivation, judgmental language
- **Solution**: Positive, educational feedback that celebrates progress
- **Features**: Banned words list, streak forgiveness, supportive messaging

### 3. **Data Accuracy & Synchronization**
- **Problem**: Sync issues, calorie discrepancies, data loss
- **Solution**: Auto-save, crash recovery, conflict resolution
- **Features**: Priority-based data sources, MET exercise calculations

### 4. **Context-Aware Personalization**
- **Problem**: Lack of life context, rigid routines
- **Solution**: Adaptive plans based on daily check-ins and life situations
- **Features**: Life situation profiles, pattern detection, weekly summaries

## 🚀 Quick Start

### 1. Install the Algorithm Files

The algorithms are already created in your `src/algorithms/` directory:
- `AdaptiveGoalEngine.js`
- `CompassionateFeedbackEngine.js`
- `DataSyncEngine.js`
- `ContextualPersonalizationEngine.js`
- `KalryAlgorithmManager.js` (orchestrates all algorithms)

### 2. Basic Integration

```javascript
import { KalryAlgorithmManager } from '../algorithms/KalryAlgorithmManager';

// Initialize with user profile
const userProfile = {
  weight: 70,
  height: 170,
  age: 25,
  gender: 'female',
  activityLevel: 'moderate',
  goal: 'weightLoss',
  // ... other profile data
};

const algorithmManager = new KalryAlgorithmManager(userProfile);
```

### 3. Daily Flow

```javascript
// 1. Start daily routine (checks for crash recovery, shows check-in)
const result = await algorithmManager.startDailyRoutine();

// 2. Process daily check-in responses
const context = await algorithmManager.processDailyCheckIn(responses);

// 3. Log food with compassionate feedback
const foodResult = await algorithmManager.logFood(foodData);

// 4. Generate end-of-day summary
const summary = await algorithmManager.generateEndOfDaySummary(actualCalories);
```

## 📱 Integration Examples

### ProgressScreen Integration

```javascript
// In ProgressScreen.js
import { AdaptiveGoalEngine } from '../algorithms/AdaptiveGoalEngine';

// Initialize adaptive goal engine
const goalEngine = new AdaptiveGoalEngine(userProfile);
const dailyGoal = goalEngine.generateDailyGoal(dailyCheckIn);

// Display adaptive goal in UI
<View style={styles.goalCard}>
  <Text>Today's Goal: {dailyGoal.min}-{dailyGoal.max} calories</Text>
  <Text>{dailyGoal.displayMessage}</Text>
</View>
```

### HomeScreen Integration

```javascript
// In HomeScreen.js
import { CompassionateFeedbackEngine } from '../algorithms/CompassionateFeedbackEngine';

// Generate compassionate feedback for food logging
const feedbackEngine = new CompassionateFeedbackEngine();
const feedback = feedbackEngine.generateFoodFeedback(foodData);

// Show positive feedback instead of generic success message
Alert.alert("Food Logged! 🍽️", feedback.message);
```

### Daily Check-in Integration

```javascript
// Use the DailyCheckInModal component
import { DailyCheckInModal } from '../components/DailyCheckInModal';

<DailyCheckInModal
  visible={showCheckIn}
  onClose={() => setShowCheckIn(false)}
  onComplete={handleCheckInComplete}
  userProfile={userProfile}
/>
```

## 🗄️ Database Schema Updates

To fully support these algorithms, you'll need to add these fields to your Supabase schema:

### user_profile table additions:
```sql
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS weight DECIMAL(5,2);
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS height DECIMAL(5,2);
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS gender VARCHAR(10);
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS activity_level VARCHAR(20);
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS goal VARCHAR(20);
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS medical_conditions TEXT[];
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS medications TEXT[];
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS is_breastfeeding BOOLEAN DEFAULT FALSE;
```

### New tables for algorithm data:
```sql
-- Daily check-in responses
CREATE TABLE daily_checkins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  date DATE NOT NULL,
  responses JSONB NOT NULL,
  context JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Life situation profiles
CREATE TABLE life_situations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  situation_type VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adaptive goal history
CREATE TABLE adaptive_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  date DATE NOT NULL,
  min_calories INTEGER NOT NULL,
  target_calories INTEGER NOT NULL,
  max_calories INTEGER NOT NULL,
  breakdown JSONB,
  reasons JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🎨 UI Components

### Daily Check-in Modal
The `DailyCheckInModal` component provides a beautiful, user-friendly interface for daily check-ins:

- **Sleep tracking**: Number input with +/- controls
- **Energy/Stress levels**: Select from predefined options
- **Mood scale**: 1-10 scale with emoji labels
- **Life situations**: Multi-select checkboxes
- **Progress indicator**: Shows completion progress

### Adaptive Goal Display
Shows personalized calorie goals with explanations:

```javascript
{adaptiveGoal && (
  <View style={styles.goalCard}>
    <Text>Today's Adaptive Goal</Text>
    <Text>{adaptiveGoal.min}-{adaptiveGoal.max} calories</Text>
    <Text>{adaptiveGoal.displayMessage}</Text>
    {adaptiveGoal.reasons.map((reason, index) => (
      <Text key={index}>• {reason.message}</Text>
    ))}
  </View>
)}
```

## 🔧 Configuration Options

### Adaptive Goal Engine
```javascript
const goalEngine = new AdaptiveGoalEngine({
  ...userProfile,
  learningRate: 0.1,        // ML adjustment rate
  historyWindow: 14,        // Days to consider for patterns
});
```

### Compassionate Feedback Engine
```javascript
const feedbackEngine = new CompassionateFeedbackEngine();
// Automatically includes banned words list and tone profiles
```

### Data Sync Engine
```javascript
const syncEngine = new DataSyncEngine();
syncEngine.retryAttempts = 3;        // Retry failed syncs
syncEngine.CACHE_DURATION = 5000;    // Cache duration in ms
```

### Contextual Personalization Engine
```javascript
const personalizationEngine = new ContextualPersonalizationEngine(userProfile);
// Automatically includes all life situation profiles
```

## 📊 Algorithm Features

### Adaptive Goal Engine Features:
- ✅ Mifflin-St Jeor BMR calculation
- ✅ TDEE with activity multipliers
- ✅ Biological adjustments (menstrual cycle, breastfeeding, medical conditions)
- ✅ Daily context adjustments (sleep, stress, energy)
- ✅ Adherence-based learning
- ✅ Weight trend analysis
- ✅ Flexible calorie ranges (±150 cal)

### Compassionate Feedback Engine Features:
- ✅ Banned words validation
- ✅ Positive food feedback
- ✅ Forgiving streak system
- ✅ Welcome back messages
- ✅ Over/under goal feedback
- ✅ Non-nagging notifications

### Data Sync Engine Features:
- ✅ Auto-save with debouncing
- ✅ Crash recovery
- ✅ Conflict resolution
- ✅ MET-based exercise calculations
- ✅ Background sync
- ✅ Wearable data integration

### Contextual Personalization Engine Features:
- ✅ Life situation profiles (sick, travel, stress, etc.)
- ✅ Daily check-in processing
- ✅ Pattern detection
- ✅ Weekly summaries
- ✅ Insight generation
- ✅ Holistic daily planning

## 🧪 Testing

### Test Individual Algorithms:
```javascript
// Test adaptive goal generation
const goal = goalEngine.generateDailyGoal({
  sleepHours: 6,
  stressLevel: 'high',
  energyLevel: 'low',
  situation: 'sick'
});

// Test compassionate feedback
const feedback = feedbackEngine.generateFoodFeedback({
  name: 'Pizza',
  calories: 300,
  protein: 12,
  carbs: 35,
  fat: 10
});

// Test data sync
const syncStatus = syncEngine.getSyncStatus();
```

### Test Complete Integration:
```javascript
// Use the KalryAlgorithmIntegration example component
import { KalryAlgorithmIntegration } from '../examples/KalryAlgorithmIntegration';

// This provides a complete testing interface
```

## 🚀 Production Deployment

### 1. Environment Variables
Add these to your `.env` file:
```
# Algorithm configuration
KALRY_ALGORITHM_VERSION=1.0.0
KALRY_ENABLE_ADAPTIVE_GOALS=true
KALRY_ENABLE_COMPASSIONATE_FEEDBACK=true
KALRY_ENABLE_DATA_SYNC=true
KALRY_ENABLE_PERSONALIZATION=true
```

### 2. Performance Optimization
- Cache algorithm results in AsyncStorage
- Debounce auto-save operations
- Use background sync for non-critical data
- Implement algorithm result caching

### 3. Monitoring
- Track algorithm performance metrics
- Monitor user engagement with check-ins
- Log algorithm decision-making for debugging
- Track sync success rates

## 🎯 Expected Results

After implementing these algorithms, you should see:

1. **Higher User Retention**: Compassionate feedback reduces shame and increases motivation
2. **Better Goal Achievement**: Adaptive goals are more realistic and achievable
3. **Reduced Data Loss**: Auto-save and crash recovery prevent frustration
4. **Improved Personalization**: Context-aware plans adapt to real life situations
5. **Increased Engagement**: Daily check-ins create habit formation

## 🔄 Maintenance

### Regular Updates:
- Update banned words list based on user feedback
- Refine life situation profiles
- Adjust algorithm parameters based on user data
- Add new biological factors as research emerges

### Monitoring:
- Track algorithm effectiveness metrics
- Monitor user satisfaction with personalized goals
- Analyze check-in completion rates
- Review sync success rates

## 📞 Support

For questions or issues with the algorithm integration:
1. Check the example implementations in `src/examples/`
2. Review the algorithm source code for detailed documentation
3. Test individual components before full integration
4. Monitor console logs for algorithm decision-making

These algorithms are production-ready and will significantly improve your users' experience with Kalry! 🎉
