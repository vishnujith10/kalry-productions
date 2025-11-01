# 🚀 How to Add Date Columns to Your Tables

## Step-by-Step Instructions

### **Option 1: Using Supabase Dashboard (Recommended)**

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and Paste This SQL**
   - Open the file `ADD_DATES_TO_WORKOUT_TABLES.sql`
   - Copy ALL the contents
   - Paste into the SQL Editor

4. **Run the Migration**
   - Click the "Run" button (or press Ctrl+Enter)
   - Wait for "Success" message

5. **Verify**
   - Run this query to check:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'daily_routine_exercises' 
   AND column_name IN ('date', 'created_at', 'body_parts');
   ```
   - You should see 3 rows returned

---

### **Option 2: Quick Fix (Run This SQL Now)**

If you want to do it quickly, just copy and paste this into Supabase SQL Editor:

```sql
-- Add date columns to daily_routine_exercises
ALTER TABLE daily_routine_exercises 
ADD COLUMN IF NOT EXISTS date DATE;

ALTER TABLE daily_routine_exercises 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE daily_routine_exercises 
ADD COLUMN IF NOT EXISTS body_parts TEXT;

-- Update existing records
UPDATE daily_routine_exercises dre
SET date = w.date,
    created_at = w.created_at
FROM workouts w
WHERE dre.workout_id = w.id
AND dre.date IS NULL;

-- Add date columns to sets
ALTER TABLE sets 
ADD COLUMN IF NOT EXISTS date DATE;

ALTER TABLE sets 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Update existing sets
UPDATE sets s
SET date = w.date,
    created_at = w.created_at
FROM daily_routine_exercises dre
JOIN workouts w ON dre.workout_id = w.id
WHERE s.workout_exercise_id = dre.id
AND s.date IS NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_daily_routine_exercises_date 
ON daily_routine_exercises(date DESC);

CREATE INDEX IF NOT EXISTS idx_sets_date 
ON sets(date DESC);

-- Create trigger for auto-populating dates
CREATE OR REPLACE FUNCTION set_exercise_date_from_workout()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.date IS NULL THEN
    SELECT date INTO NEW.date
    FROM workouts
    WHERE id = NEW.workout_id;
  END IF;
  
  IF NEW.created_at IS NULL THEN
    NEW.created_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_exercise_date ON daily_routine_exercises;
CREATE TRIGGER trigger_set_exercise_date
BEFORE INSERT ON daily_routine_exercises
FOR EACH ROW
EXECUTE FUNCTION set_exercise_date_from_workout();

-- Create trigger for sets
CREATE OR REPLACE FUNCTION set_set_date_from_exercise()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.date IS NULL THEN
    SELECT date INTO NEW.date
    FROM daily_routine_exercises
    WHERE id = NEW.workout_exercise_id;
  END IF;
  
  IF NEW.created_at IS NULL THEN
    NEW.created_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_set_date ON sets;
CREATE TRIGGER trigger_set_set_date
BEFORE INSERT ON sets
FOR EACH ROW
EXECUTE FUNCTION set_set_date_from_exercise();
```

---

### **After Running the Migration**

1. **Test it** - Complete a new workout in the app
2. **Check the database** - Run this query:
   ```sql
   SELECT exercise_name, date, created_at, body_parts 
   FROM daily_routine_exercises 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```
3. **You should see** - The new columns with data! ✅

---

## ⚠️ Important Notes

- **Safe to run multiple times** - All commands use `IF NOT EXISTS` so it won't break if run twice
- **Existing data** - All your old workouts will get dates from their parent workout records
- **Future workouts** - Will automatically get dates via triggers
- **No app restart needed** - Changes take effect immediately

---

## 🐛 Troubleshooting

### Error: "column already exists"
- This is fine! It means the column was already added
- The migration will skip it and continue

### Error: "permission denied"
- Make sure you're logged in as the project owner
- Try using the Supabase Dashboard instead of CLI

### Columns still not showing
- Refresh your database schema in Supabase Dashboard
- Check the "Table Editor" → "daily_routine_exercises" → Click the table name to see columns

---

## ✅ Verification Checklist

After running the migration, verify:

- [ ] `daily_routine_exercises` has `date` column
- [ ] `daily_routine_exercises` has `created_at` column
- [ ] `daily_routine_exercises` has `body_parts` column
- [ ] `sets` has `date` column
- [ ] `sets` has `created_at` column
- [ ] Existing records have dates populated
- [ ] New workouts automatically get dates

---

**Once done, your app will work perfectly with the analytics system!** 🎉

