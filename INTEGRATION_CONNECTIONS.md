# 🔗 **Algorithm Integration Connections Guide**

## **Required Connections for Kalry Algorithms**

### ✅ **Already Connected:**

1. **ProgressScreen** - Adaptive goals integrated
2. **HomeScreen** - Compassionate feedback integrated  
3. **MainDashboardScreen** - Daily check-in modal integrated

### 🔧 **Additional Connections Needed:**

## **1. VoiceCalorieScreen Integration**

Add compassionate feedback to voice calorie logging:

```javascript
// In src/caloriescreen/VoiceCalorieScreen.js
import { CompassionateFeedbackEngine } from '../algorithms/CompassionateFeedbackEngine';

// In the voice processing function
const feedbackEngine = new CompassionateFeedbackEngine();
const feedback = feedbackEngine.generateFoodFeedback(processedFoodData);

// Show compassionate feedback instead of generic success
Alert.alert("Voice Logged! 🎤", feedback.message);
```

## **2. PhotoCalorieScreen Integration**

Add compassionate feedback to photo calorie logging:

```javascript
// In src/caloriescreen/PhotoCalorieScreen.js
import { CompassionateFeedbackEngine } from '../algorithms/CompassionateFeedbackEngine';

// In the photo processing function
const feedbackEngine = new CompassionateFeedbackEngine();
const feedback = feedbackEngine.generateFoodFeedback(processedFoodData);

// Show compassionate feedback
Alert.alert("Photo Logged! 📸", feedback.message);
```

## **3. JournalScreen Integration**

Add adaptive goals and compassionate feedback:

```javascript
// In src/homescreens/JournalScreen.js
import { AdaptiveGoalEngine } from '../algorithms/AdaptiveGoalEngine';
import { CompassionateFeedbackEngine } from '../algorithms/CompassionateFeedbackEngine';

// Show adaptive goal in journal
const goalEngine = new AdaptiveGoalEngine(userProfile);
const dailyGoal = goalEngine.generateDailyGoal(dailyCheckIn);

// Display in UI
<Text>Today's Goal: {dailyGoal.min}-{dailyGoal.max} calories</Text>
```

## **4. Database Schema Updates**

Run these SQL commands in your Supabase dashboard:

```sql
-- Add algorithm support fields to user_profile
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS weight DECIMAL(5,2);
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS height DECIMAL(5,2);
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS gender VARCHAR(10);
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS activity_level VARCHAR(20);
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS goal VARCHAR(20);
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS medical_conditions TEXT[];
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS medications TEXT[];
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS is_breastfeeding BOOLEAN DEFAULT FALSE;

-- Create daily check-ins table
CREATE TABLE IF NOT EXISTS daily_checkins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  date DATE NOT NULL,
  responses JSONB NOT NULL,
  context JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create adaptive goals table
CREATE TABLE IF NOT EXISTS adaptive_goals (
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

## **5. App.js Integration**

Add algorithm initialization to your main App.js:

```javascript
// In App.js
import { KalryAlgorithmManager } from './src/algorithms/KalryAlgorithmManager';

// Initialize algorithms when user logs in
const initializeAlgorithms = (userProfile) => {
  return new KalryAlgorithmManager(userProfile);
};
```

## **6. Navigation Integration**

Add algorithm screens to your navigation:

```javascript
// In your navigation setup
import { KalryAlgorithmIntegration } from './src/examples/KalryAlgorithmIntegration';

// Add to your stack navigator
<Stack.Screen 
  name="AlgorithmTest" 
  component={KalryAlgorithmIntegration} 
/>
```

## **7. Notification Integration**

Add compassionate notifications:

```javascript
// In your notification service
import { CompassionateFeedbackEngine } from './src/algorithms/CompassionateFeedbackEngine';

const feedbackEngine = new CompassionateFeedbackEngine();
const notification = feedbackEngine.generateNotification('mealReminder', context);

// Send notification with compassionate message
sendNotification(notification.message);
```

## **8. Settings Screen Integration**

Add algorithm preferences to settings:

```javascript
// In SettingsScreen.js
import { AdaptiveGoalEngine } from '../algorithms/AdaptiveGoalEngine';

// Add settings for:
// - Goal preferences (weight loss, maintenance, gain)
// - Activity level
// - Medical conditions
// - Medication effects
// - Exercise calorie preferences
```

## **9. Weekly Review Integration**

Add weekly review to ProgressScreen:

```javascript
// In ProgressScreen.js
const handleWeeklyReview = async () => {
  const result = await algorithmManager.generateWeeklyReview();
  
  if (result.success) {
    Alert.alert(
      'Weekly Review',
      `${result.summary.celebration}\n\nTop Priority: ${result.summary.topPriority}`,
      [{ text: 'Keep it up!', style: 'default' }]
    );
  }
};
```

## **10. End-of-Day Integration**

Add end-of-day summary to MainDashboardScreen:

```javascript
// In MainDashboardScreen.js
const handleEndOfDay = async () => {
  const actualCalories = calculateTotalCalories();
  const result = await algorithmManager.generateEndOfDaySummary(actualCalories, []);
  
  if (result.success) {
    Alert.alert(
      'End of Day Summary',
      `${result.feedback.message}\n\nStreak: ${result.streak.message}`,
      [{ text: 'Awesome!', style: 'default' }]
    );
  }
};
```

## **🎯 Priority Order:**

1. **High Priority** (Core functionality):
   - Database schema updates
   - VoiceCalorieScreen integration
   - PhotoCalorieScreen integration

2. **Medium Priority** (Enhanced features):
   - JournalScreen integration
   - Settings screen integration
   - Weekly review integration

3. **Low Priority** (Nice-to-have):
   - Notification integration
   - End-of-day integration
   - Algorithm test screen

## **🧪 Testing:**

Use the `KalryAlgorithmIntegration` component to test all algorithms:

```javascript
// Add to your navigation for testing
import { KalryAlgorithmIntegration } from './src/examples/KalryAlgorithmIntegration';

// Test with sample user profile
const testUserProfile = {
  weight: 70,
  height: 170,
  age: 25,
  gender: 'female',
  activityLevel: 'moderate',
  goal: 'weightLoss'
};

<KalryAlgorithmIntegration userProfile={testUserProfile} />
```

## **📱 User Experience:**

After integration, users will experience:

1. **Morning**: Daily check-in modal appears
2. **Food Logging**: Compassionate feedback instead of generic messages
3. **Progress Tracking**: Adaptive goals that adjust to their context
4. **Data Safety**: Auto-save prevents data loss
5. **Personalization**: Plans adapt to their life situations

## **🔧 Maintenance:**

- Monitor algorithm performance
- Update banned words list based on user feedback
- Refine life situation profiles
- Adjust algorithm parameters based on user data

**Your Kalry app will now have production-ready algorithms that solve the four major user problems!** 🎉
