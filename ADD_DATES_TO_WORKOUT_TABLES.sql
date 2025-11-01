-- Add date/timestamp columns to workout tables for better tracking
-- This helps identify which exercises and sets belong to which workout session

-- ============================================================================
-- 1. Add date column to daily_routine_exercises table
-- ============================================================================

-- Add date column (matches the workout date)
ALTER TABLE daily_routine_exercises 
ADD COLUMN IF NOT EXISTS date DATE;

-- Add created_at timestamp (when the record was created)
ALTER TABLE daily_routine_exercises 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Update existing records to copy date from parent workout
UPDATE daily_routine_exercises dre
SET date = w.date
FROM workouts w
WHERE dre.workout_id = w.id
AND dre.date IS NULL;

-- Update existing records to copy created_at from parent workout
UPDATE daily_routine_exercises dre
SET created_at = w.created_at
FROM workouts w
WHERE dre.workout_id = w.id
AND dre.created_at IS NULL;

-- ============================================================================
-- 2. Add date column to sets table
-- ============================================================================

-- Add date column (matches the workout date)
ALTER TABLE sets 
ADD COLUMN IF NOT EXISTS date DATE;

-- Add created_at timestamp (when the record was created)
ALTER TABLE sets 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Update existing sets to copy date from parent workout
UPDATE sets s
SET date = w.date
FROM daily_routine_exercises dre
JOIN workouts w ON dre.workout_id = w.id
WHERE s.workout_exercise_id = dre.id
AND s.date IS NULL;

-- Update existing sets to copy created_at from parent workout
UPDATE sets s
SET created_at = w.created_at
FROM daily_routine_exercises dre
JOIN workouts w ON dre.workout_id = w.id
WHERE s.workout_exercise_id = dre.id
AND s.created_at IS NULL;

-- ============================================================================
-- 3. Add body_parts column to daily_routine_exercises (for muscle tracking)
-- ============================================================================

-- Add body_parts column to track which muscles were worked
ALTER TABLE daily_routine_exercises 
ADD COLUMN IF NOT EXISTS body_parts TEXT;

-- Update existing records to copy body_parts from exercise table
UPDATE daily_routine_exercises dre
SET body_parts = e.body_parts
FROM exercise e
WHERE dre.exercise_id = e.id
AND dre.body_parts IS NULL;

-- ============================================================================
-- 4. Create indexes for better query performance
-- ============================================================================

-- Index on date for daily_routine_exercises
CREATE INDEX IF NOT EXISTS idx_daily_routine_exercises_date 
ON daily_routine_exercises(date DESC);

-- Index on created_at for daily_routine_exercises
CREATE INDEX IF NOT EXISTS idx_daily_routine_exercises_created_at 
ON daily_routine_exercises(created_at DESC);

-- Index on date for sets
CREATE INDEX IF NOT EXISTS idx_sets_date 
ON sets(date DESC);

-- Index on created_at for sets
CREATE INDEX IF NOT EXISTS idx_sets_created_at 
ON sets(created_at DESC);

-- Composite index for user queries
CREATE INDEX IF NOT EXISTS idx_daily_routine_exercises_workout_date 
ON daily_routine_exercises(workout_id, date DESC);

-- ============================================================================
-- 5. Create trigger to auto-populate dates on insert
-- ============================================================================

-- Function to auto-set date from parent workout
CREATE OR REPLACE FUNCTION set_exercise_date_from_workout()
RETURNS TRIGGER AS $$
BEGIN
  -- Set date from parent workout if not provided
  IF NEW.date IS NULL THEN
    SELECT date INTO NEW.date
    FROM workouts
    WHERE id = NEW.workout_id;
  END IF;
  
  -- Set created_at if not provided
  IF NEW.created_at IS NULL THEN
    NEW.created_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for daily_routine_exercises
DROP TRIGGER IF EXISTS trigger_set_exercise_date ON daily_routine_exercises;
CREATE TRIGGER trigger_set_exercise_date
BEFORE INSERT ON daily_routine_exercises
FOR EACH ROW
EXECUTE FUNCTION set_exercise_date_from_workout();

-- Function to auto-set date from parent exercise
CREATE OR REPLACE FUNCTION set_set_date_from_exercise()
RETURNS TRIGGER AS $$
BEGIN
  -- Set date from parent exercise if not provided
  IF NEW.date IS NULL THEN
    SELECT date INTO NEW.date
    FROM daily_routine_exercises
    WHERE id = NEW.workout_exercise_id;
  END IF;
  
  -- Set created_at if not provided
  IF NEW.created_at IS NULL THEN
    NEW.created_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for sets
DROP TRIGGER IF EXISTS trigger_set_set_date ON sets;
CREATE TRIGGER trigger_set_set_date
BEFORE INSERT ON sets
FOR EACH ROW
EXECUTE FUNCTION set_set_date_from_exercise();

-- ============================================================================
-- 6. Verification Queries (run these to check the migration worked)
-- ============================================================================

-- Check if columns were added
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'daily_routine_exercises' 
-- AND column_name IN ('date', 'created_at', 'body_parts');

-- Check if columns were added to sets
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'sets' 
-- AND column_name IN ('date', 'created_at');

-- Check sample data
-- SELECT id, exercise_name, date, created_at, body_parts 
-- FROM daily_routine_exercises 
-- ORDER BY created_at DESC 
-- LIMIT 5;

-- Check sample sets data
-- SELECT id, set_number, reps, weight, date, created_at 
-- FROM sets 
-- ORDER BY created_at DESC 
-- LIMIT 5;

-- ============================================================================
-- DONE! 
-- ============================================================================
-- Now your tables have:
-- 1. date column - to see which day the workout was performed
-- 2. created_at column - exact timestamp when record was created
-- 3. body_parts column - which muscles were worked (for analytics)
-- 4. Auto-population triggers - dates set automatically on insert
-- 5. Indexes - for fast queries
-- ============================================================================

