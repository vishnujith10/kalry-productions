# Progressive Overload & Workout Analytics System

## 🎯 Overview

This advanced workout tracking system implements **progressive overload**, **rest & recovery monitoring**, and **stagnation detection** to help users maximize their fitness gains while preventing overtraining and plateaus.

## 📚 Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Algorithms](#algorithms)
4. [Database Schema](#database-schema)
5. [Usage](#usage)
6. [Integration](#integration)
7. [API Reference](#api-reference)

---

## ✨ Features

### 1. **Progressive Overload Tracking**
- Monitors weight, reps, sets, and volume progression
- Detects when users are ready to increase intensity
- Provides specific suggestions (add weight, reps, or sets)
- Celebrates progress and achievements

### 2. **Rest & Recovery Monitoring**
- Tracks weekly session frequency per muscle group
- Detects overtraining (>5 sessions/week for same muscle)
- Recommends rest days (<2 rest days/week triggers alert)
- Calculates recovery score (0-100)

### 3. **Stagnation Detection**
- Identifies plateaus (same weight/reps/sets for 3+ sessions)
- Offers actionable advice for breaking plateaus
- Celebrates when users break through plateaus
- Tracks progress streaks

### 4. **Personal Records (PRs)**
- Automatically detects and records PRs
- Tracks max weight, max reps, max volume
- Shows improvement percentages
- Celebrates achievements

### 5. **Smart Feedback**
- Post-workout summaries with insights
- Motivational messages based on progress
- Recovery warnings when needed
- Progression suggestions

---

## 🏗️ Architecture

```
src/algorithms/
├── ProgressiveOverloadEngine.js    # Tracks weight/rep/set progression
├── RestRecoveryEngine.js           # Monitors training load & recovery
├── StagnationDetector.js           # Detects plateaus & suggests solutions
└── WorkoutAnalyticsService.js      # Integrates all engines

src/components/
└── WorkoutFeedbackModal.js         # UI for displaying feedback

Database Tables:
├── exercise_history                # Individual exercise logs
├── personal_records                # PRs for each exercise
├── stagnation_alerts               # Plateau notifications
├── recovery_metrics                # Weekly recovery data
├── workout_achievements            # Achievements & milestones
└── progression_suggestions         # AI-generated suggestions
```

---

## 🧮 Algorithms

### 1. Progressive Overload Algorithm

**Purpose**: Track and suggest progression in resistance training.

**How it works**:
```javascript
// Log each session
progressiveOverloadEngine.logSession('Bench Press', {
  weight: 80,
  reps: 10,
  sets: 3,
  date: new Date()
});

// Get suggestions
const feedback = progressiveOverloadEngine.suggestIncrease('Bench Press');
// Returns: { type: 'stagnation', message: '...', suggestion: '...' }
```

**Stagnation Detection**:
- Checks last 3 sessions
- If all 3 have identical weight/reps/sets → **Stagnation**
- Suggests: +2.5-5kg, +1-2 reps, +1 set, tempo changes, or variations

**Progress Detection**:
- Weight increase → "Progress! You increased your weight by X%"
- Rep increase → "Progress! You did X more reps"
- Volume increase → "Progress! Total volume increased by X%"

### 2. Rest & Recovery Algorithm

**Purpose**: Prevent overtraining and optimize recovery.

**How it works**:
```javascript
// Log sessions
recoveryEngine.logSession('chest', new Date(), 'vigorous', 60);

// Get advice
const advice = recoveryEngine.getRestAdvice();
// Returns: { advice: [...], metrics: {...}, status: 'good' }
```

**Rules**:
- **Critical**: 0 rest days/week → "Take immediate rest!"
- **Warning**: >5 sessions/week for same muscle → "Overtraining risk"
- **Caution**: <2 rest days/week → "Add more rest"
- **Good**: 2-3 rest days, balanced volume
- **Excellent**: Optimal training/rest balance

**Recovery Score Calculation**:
```
Base Score: 100
- No rest days: -30 points
- <2 rest days: -10 points
- >6 total sessions: -10 points
- >70% vigorous sessions: -15 points
+ Optimal muscle group frequency: +5 points per group
```

### 3. Stagnation Detection Algorithm

**Purpose**: Identify plateaus and provide solutions.

**How it works**:
```javascript
// Check for stagnation
const stagnation = stagnationDetector.checkStagnation('Squat', 4);
// Checks last 4 sessions

// Returns if stagnant:
{
  type: 'complete_stagnation',
  severity: 'high',
  message: 'Plateau detected: Squat at 100kg, 8 reps, 3 sets for 4 sessions',
  suggestion: '1️⃣ Add Weight: Increase to 105kg...'
}
```

**Stagnation Types**:
1. **Complete Stagnation**: All metrics identical (high severity)
2. **Weight Stagnation**: Only weight unchanged (medium severity)
3. **Volume Stagnation**: Total volume flat <5% variation (low severity)

**Plateau Break Detection**:
```javascript
// Checks if user broke through a plateau
const plateauBreak = stagnationDetector.checkPlateauBreak('Bench Press');
// Returns: { type: 'plateau_broken', improvements: 'weight (+5%), reps (+2)' }
```

---

## 🗄️ Database Schema

### 1. `exercise_history`
Tracks every exercise session with weight, reps, sets, volume.

```sql
CREATE TABLE exercise_history (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  exercise_name TEXT NOT NULL,
  weight DECIMAL(10, 2),
  reps INTEGER,
  sets INTEGER,
  volume DECIMAL(10, 2), -- weight * reps * sets
  duration INTEGER,
  intensity TEXT,
  workout_id UUID REFERENCES workouts(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. `personal_records`
Stores PRs with automatic updates via trigger.

```sql
CREATE TABLE personal_records (
  id UUID PRIMARY KEY,
  user_id UUID,
  exercise_name TEXT,
  record_type TEXT, -- 'max_weight', 'max_reps', 'max_volume'
  value DECIMAL(10, 2),
  achieved_at TIMESTAMPTZ,
  previous_record DECIMAL(10, 2),
  improvement_percent DECIMAL(5, 2)
);
```

### 3. `stagnation_alerts`
Tracks detected plateaus and notifications.

```sql
CREATE TABLE stagnation_alerts (
  id UUID PRIMARY KEY,
  user_id UUID,
  exercise_name TEXT,
  stagnation_type TEXT, -- 'complete_stagnation', 'weight_stagnation', etc.
  severity TEXT, -- 'low', 'medium', 'high', 'critical'
  sessions_count INTEGER,
  suggestion TEXT,
  is_resolved BOOLEAN DEFAULT FALSE
);
```

### 4. `recovery_metrics`
Weekly recovery scores and training load.

```sql
CREATE TABLE recovery_metrics (
  id UUID PRIMARY KEY,
  user_id UUID,
  week_start DATE,
  total_sessions INTEGER,
  rest_days INTEGER,
  recovery_score INTEGER, -- 0-100
  recovery_rating TEXT, -- 'Critical', 'Poor', 'Fair', 'Good', 'Excellent'
  muscle_group_breakdown JSONB
);
```

---

## 🚀 Usage

### Initialize the Service

```javascript
import { workoutAnalyticsService } from './algorithms/WorkoutAnalyticsService';

// Initialize with user ID (loads history from database)
await workoutAnalyticsService.initialize(userId);
```

### Log a Workout

```javascript
// After completing a workout
await workoutAnalyticsService.logWorkout({
  exercises: [
    {
      name: 'Bench Press',
      sets: [
        { weight: 80, reps: 10 },
        { weight: 80, reps: 9 },
        { weight: 80, reps: 8 }
      ]
    }
  ],
  intensity: 'moderate',
  duration: 45, // minutes
  date: new Date(),
  muscleGroups: ['chest', 'triceps']
});
```

### Get Post-Workout Feedback

```javascript
const feedback = await workoutAnalyticsService.getPostWorkoutSummary({
  exercises: [...],
  intensity: 'moderate',
  duration: 45,
  muscleGroups: ['chest']
});

// feedback contains:
// - achievements: PRs, plateau breaks
// - warnings: Recovery alerts
// - suggestions: Progression tips
```

### Display Feedback Modal

```javascript
import WorkoutFeedbackModal from './components/WorkoutFeedbackModal';

<WorkoutFeedbackModal
  visible={showFeedbackModal}
  onClose={() => setShowFeedbackModal(false)}
  feedback={feedback}
/>
```

---

## 🔌 Integration

### Routine Workout Screen

Already integrated in `src/routinescreen/StartWorkoutScreen.js`:

1. **Imports**:
```javascript
import { workoutAnalyticsService } from '../algorithms/WorkoutAnalyticsService';
import WorkoutFeedbackModal from '../components/WorkoutFeedbackModal';
```

2. **After Workout Save**:
```javascript
// Initialize service
await workoutAnalyticsService.initialize(userId);

// Log workout
await workoutAnalyticsService.logWorkout({...});

// Get feedback
const feedback = await workoutAnalyticsService.getPostWorkoutSummary({...});

// Show modal
setWorkoutFeedback(feedback);
setShowFeedbackModal(true);
```

3. **Render Modal**:
```javascript
<WorkoutFeedbackModal
  visible={showFeedbackModal}
  onClose={() => setShowFeedbackModal(false)}
  feedback={workoutFeedback}
/>
```

### Cardio Workout Screen

**TODO**: Add similar integration to `src/cardioscreen/WorkoutStartScreen.js`

---

## 📖 API Reference

### ProgressiveOverloadEngine

#### `logSession(exercise, { weight, reps, sets, date })`
Logs a workout session for an exercise.

#### `suggestIncrease(exercise)`
Returns progression suggestions.

**Returns**:
```javascript
{
  type: 'progress' | 'stagnation' | 'consistent' | 'info',
  message: string,
  emoji: string,
  suggestion: string
}
```

#### `getProgressSummary(exercise)`
Returns overall progress statistics.

**Returns**:
```javascript
{
  totalSessions: number,
  weightProgress: number,
  weightProgressPercent: string,
  volumeProgress: number,
  daysTracking: number
}
```

#### `checkForPR(exercise, session)`
Checks if current session achieved a PR.

**Returns**:
```javascript
[
  { type: 'weight', message: 'New weight PR!', emoji: '🏆' },
  { type: 'volume', message: 'New volume PR!', emoji: '📊' }
]
```

### RestRecoveryEngine

#### `logSession(muscleGroup, date, intensity, duration)`
Logs a training session.

#### `getRestAdvice(currentDate)`
Returns recovery recommendations.

**Returns**:
```javascript
{
  advice: [
    {
      type: 'overtraining' | 'good_rest' | 'balanced',
      severity: 'low' | 'medium' | 'high' | 'critical',
      message: string,
      suggestion: string,
      emoji: string
    }
  ],
  metrics: {
    totalSessions: number,
    restDays: number,
    muscleGroupBreakdown: object
  },
  status: 'critical' | 'warning' | 'caution' | 'good' | 'excellent'
}
```

#### `getRecoveryScore(currentDate)`
Calculates recovery score (0-100).

**Returns**:
```javascript
{
  score: number,
  rating: 'Critical' | 'Poor' | 'Fair' | 'Good' | 'Excellent',
  emoji: string,
  advice: string
}
```

#### `shouldRestToday(currentDate)`
Recommends if user should rest today.

**Returns**:
```javascript
{
  recommended: boolean,
  reason: string,
  emoji: string
}
```

### StagnationDetector

#### `logExercise(exercise, weight, reps, sets, date)`
Logs an exercise session.

#### `checkStagnation(exercise, threshold)`
Checks for plateaus (default: last 4 sessions).

**Returns**:
```javascript
{
  type: 'complete_stagnation' | 'weight_stagnation' | 'volume_stagnation',
  severity: 'low' | 'medium' | 'high',
  message: string,
  emoji: string,
  suggestion: string
}
```

#### `checkPlateauBreak(exercise)`
Detects if user broke through a plateau.

**Returns**:
```javascript
{
  type: 'plateau_broken',
  message: string,
  improvements: string,
  celebration: string
}
```

#### `getMotivationMessage(exercise)`
Returns motivational message based on progress.

**Returns**:
```javascript
{
  message: string,
  emoji: string,
  type: 'start' | 'progress' | 'consistent' | 'challenge'
}
```

### WorkoutAnalyticsService

#### `initialize(userId)`
Initializes service and loads user's workout history.

#### `logWorkout(workout)`
Logs a completed workout to all engines.

#### `getFeedback(exerciseName?)`
Gets comprehensive feedback (optionally for specific exercise).

#### `getPostWorkoutSummary(workout)`
Gets post-workout summary with achievements, warnings, and suggestions.

#### `getDashboardAnalytics()`
Gets analytics for dashboard display.

---

## 🎨 UI Components

### WorkoutFeedbackModal

Displays post-workout feedback in a beautiful modal.

**Props**:
- `visible` (boolean): Modal visibility
- `onClose` (function): Close handler
- `feedback` (object): Feedback data

**Sections**:
1. **Achievements** (green cards): PRs, plateau breaks
2. **Recovery Alerts** (yellow cards): Overtraining warnings
3. **Progression Tips** (purple cards): Suggestions for improvement

---

## 📊 Example Feedback

### Achievement Example
```
🏆 Achievements
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 New weight PR!
   85kg (previous: 80kg)
   +6.3% improvement

🔥 Plateau broken on Bench Press!
   Improved: weight (+5%), reps (+2)
```

### Warning Example
```
⚠️ Recovery Alerts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 Only 1 rest day this week
   Aim for 1-2 rest days per week
   to optimize recovery and prevent
   burnout.
```

### Suggestion Example
```
💡 Progression Tips
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💪 BENCH PRESS
   You've done 80kg, 10 reps for 3
   sets 3 sessions in a row.
   
   Try one of these:
   1️⃣ Add Weight: 82.5kg
   2️⃣ Add Reps: 12 reps
   3️⃣ Slow Tempo: 3-1-3
```

---

## 🔬 Science-Backed Principles

### Progressive Overload
- **Principle**: Gradually increase training stimulus to force adaptation
- **Methods**: Weight, reps, sets, tempo, rest time, exercise variation
- **Frequency**: Progress every 2-4 weeks for optimal gains
- **References**: 
  - https://www.hevyapp.com/progressive-overload/
  - https://gymaware.com/progressive-overload-the-ultimate-guide/

### Rest & Recovery
- **Optimal Rest Days**: 1-2 per week minimum
- **Muscle Group Frequency**: 2-5 sessions/week optimal
- **Overtraining Signs**: >5 sessions/week same muscle, <1 rest day/week
- **References**:
  - https://sci-fit.net/how-many-rest-days-a-week/

### Stagnation Detection
- **Plateau Definition**: No progress for 3-4 consecutive sessions
- **Break Strategies**: Weight increase, rep increase, tempo manipulation, deload
- **References**:
  - https://fivestarrphysique.com/beginning-bodybuilding/effectively-logging-your-workouts/

---

## 🚧 Future Enhancements

1. **Auto-Detection of RPE** (Rate of Perceived Exertion)
2. **Device-Based Rep Counting** (using phone sensors)
3. **Periodization Planning** (auto-schedule deload weeks)
4. **Exercise Variation Suggestions** (based on stagnation)
5. **Social Features** (compare progress with friends)
6. **AI Coach** (personalized training plans)
7. **Injury Prevention** (detect overuse patterns)
8. **Nutrition Integration** (link diet to performance)

---

## 📝 Database Migration

To set up the database schema, run:

```bash
# Apply the migration
psql -U your_user -d your_database -f WORKOUT_ANALYTICS_SCHEMA.sql
```

Or use Supabase Dashboard:
1. Go to SQL Editor
2. Paste contents of `WORKOUT_ANALYTICS_SCHEMA.sql`
3. Run the migration

---

## 🐛 Troubleshooting

### Service Not Initialized
**Error**: `Service not initialized. Call initialize() first.`

**Solution**:
```javascript
await workoutAnalyticsService.initialize(userId);
```

### No Feedback Shown
**Issue**: Modal shows "Great Workout!" with no insights.

**Cause**: Not enough workout history (need 2+ sessions).

**Solution**: Keep logging workouts. Insights appear after 2-3 sessions.

### PRs Not Detected
**Issue**: Personal records not showing.

**Cause**: Database trigger not working or RLS policy issue.

**Solution**:
1. Check if `exercise_history` table exists
2. Verify trigger `trigger_update_personal_records` is active
3. Check RLS policies allow inserts

---

## 📞 Support

For issues or questions:
1. Check this guide first
2. Review code comments in algorithm files
3. Check database schema documentation
4. Test with sample data

---

## 🎉 Conclusion

This progressive overload system provides **science-backed**, **automated**, and **personalized** workout tracking that helps users:

✅ **Maximize gains** through progressive overload  
✅ **Prevent plateaus** with stagnation detection  
✅ **Optimize recovery** with rest monitoring  
✅ **Stay motivated** with achievements and PRs  
✅ **Train smarter** with AI-powered suggestions  

**Keep pushing, keep progressing!** 💪🔥

