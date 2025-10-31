# Streak Table Setup Instructions

## 📊 Database Migration Required

A new `streaks` table needs to be created in your Supabase database to store user streak data.

## 🚀 How to Apply the Migration

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Open the file `supabase/migrations/create_streaks_table.sql`
4. Copy all the SQL code
5. Paste it into the SQL Editor
6. Click **Run** to execute the migration

### Option 2: Using Supabase CLI

If you have Supabase CLI installed:

```bash
supabase db push
```

## ✅ What This Creates

### Table: `streaks`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to auth.users |
| `food_streak` | INTEGER | Current food logging streak (days) |
| `exercise_streak` | INTEGER | Current exercise streak (days) |
| `food_last_log_date` | DATE | Last date user logged food |
| `exercise_last_log_date` | DATE | Last date user completed workout |
| `food_max_streak` | INTEGER | Maximum food streak achieved |
| `exercise_max_streak` | INTEGER | Maximum exercise streak achieved |
| `food_freezes_left` | INTEGER | Remaining freeze days for food (resets monthly) |
| `exercise_buffer` | INTEGER | Buffer days for exercise streak |
| `created_at` | TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | Last update time |

### Features:
- ✅ Row Level Security (RLS) enabled
- ✅ Automatic `updated_at` timestamp
- ✅ Unique constraint per user
- ✅ Indexed for fast lookups
- ✅ Proper foreign key relationships

## 🔄 How It Works

### Food Streak:
- **Increments**: When user logs food on consecutive days
- **Protection**: 3 monthly "freeze" days for missed days
- **Reset**: After missing >2 days with no freezes left
- **Updates**: Automatically when food is logged

### Exercise Streak:
- **Increments**: When user completes workout on consecutive days
- **Protection**: 2-day buffer for rest days
- **Reset**: Halves (doesn't go to 0) after buffer expires
- **Updates**: Automatically when workout is completed

## 📱 App Integration

The app now uses these database functions:

- `getFoodStreak(userId)` - Get current food streak
- `updateFoodStreak(userId)` - Update streak when food is logged
- `getExerciseStreak(userId)` - Get current exercise streak
- `updateExerciseStreak(userId)` - Update streak when workout is completed

## 🎯 Testing

After applying the migration:

1. **Test Food Streak**:
   - Log a meal from SavedMealsScreen
   - Return to HomeScreen
   - Streak badge should show "1-day"

2. **Test Exercise Streak**:
   - Complete a workout
   - Go to ExerciseScreen
   - Calendar should show "1-day streak"

3. **Test Persistence**:
   - Close and reopen the app
   - Streaks should still be there!

## 🐛 Troubleshooting

If streaks don't update:

1. Check RLS policies are applied
2. Verify user is authenticated
3. Check console logs for errors
4. Ensure migration ran successfully

## 📝 Notes

- Streaks are stored per user (one row per user)
- Data persists across app restarts
- Freezes reset monthly (manual reset for now)
- Exercise buffer resets after successful workout

