-- Workout Analytics Schema
-- Tables for tracking progressive overload, stagnation, and recovery metrics

-- ============================================================================
-- 1. Exercise History Table
-- Tracks individual exercise performance over time
-- ============================================================================
CREATE TABLE IF NOT EXISTS exercise_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  weight DECIMAL(10, 2), -- in kg
  reps INTEGER,
  sets INTEGER,
  volume DECIMAL(10, 2), -- weight * reps * sets
  duration INTEGER, -- in seconds
  intensity TEXT CHECK (intensity IN ('light', 'moderate', 'vigorous')),
  notes TEXT,
  workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes for fast queries
  CONSTRAINT exercise_history_user_id_idx UNIQUE (user_id, exercise_name, created_at)
);

CREATE INDEX IF NOT EXISTS idx_exercise_history_user_exercise 
  ON exercise_history(user_id, exercise_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_exercise_history_created_at 
  ON exercise_history(created_at DESC);

-- ============================================================================
-- 2. Personal Records Table
-- Tracks personal bests for each exercise
-- ============================================================================
CREATE TABLE IF NOT EXISTS personal_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('max_weight', 'max_reps', 'max_volume', 'max_duration')),
  value DECIMAL(10, 2) NOT NULL,
  weight DECIMAL(10, 2),
  reps INTEGER,
  sets INTEGER,
  achieved_at TIMESTAMPTZ NOT NULL,
  previous_record DECIMAL(10, 2),
  improvement_percent DECIMAL(5, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One record per type per exercise per user
  CONSTRAINT unique_pr_per_exercise UNIQUE (user_id, exercise_name, record_type)
);

CREATE INDEX IF NOT EXISTS idx_personal_records_user 
  ON personal_records(user_id, exercise_name);

-- ============================================================================
-- 3. Stagnation Alerts Table
-- Tracks detected plateaus and when users were notified
-- ============================================================================
CREATE TABLE IF NOT EXISTS stagnation_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  stagnation_type TEXT NOT NULL CHECK (stagnation_type IN ('complete_stagnation', 'weight_stagnation', 'volume_stagnation')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  sessions_count INTEGER NOT NULL,
  days_stagnant INTEGER,
  current_weight DECIMAL(10, 2),
  current_reps INTEGER,
  current_sets INTEGER,
  suggestion TEXT,
  notified_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stagnation_alerts_user 
  ON stagnation_alerts(user_id, is_resolved, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stagnation_alerts_exercise 
  ON stagnation_alerts(user_id, exercise_name, is_resolved);

-- ============================================================================
-- 4. Recovery Metrics Table
-- Tracks weekly recovery scores and training load
-- ============================================================================
CREATE TABLE IF NOT EXISTS recovery_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  total_sessions INTEGER DEFAULT 0,
  rest_days INTEGER DEFAULT 0,
  total_duration INTEGER DEFAULT 0, -- in minutes
  vigorous_sessions INTEGER DEFAULT 0,
  recovery_score INTEGER CHECK (recovery_score >= 0 AND recovery_score <= 100),
  recovery_rating TEXT CHECK (recovery_rating IN ('Critical', 'Poor', 'Fair', 'Good', 'Excellent')),
  muscle_group_breakdown JSONB, -- { "chest": 3, "back": 2, ... }
  warnings JSONB, -- Array of warning objects
  advice JSONB, -- Array of advice objects
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One record per week per user
  CONSTRAINT unique_week_per_user UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_recovery_metrics_user_week 
  ON recovery_metrics(user_id, week_start DESC);

-- ============================================================================
-- 5. Workout Achievements Table
-- Tracks achievements like PRs, plateau breaks, streaks
-- ============================================================================
CREATE TABLE IF NOT EXISTS workout_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_type TEXT NOT NULL CHECK (achievement_type IN ('pr', 'plateau_break', 'streak', 'milestone', 'consistency')),
  exercise_name TEXT,
  title TEXT NOT NULL,
  description TEXT,
  emoji TEXT,
  value DECIMAL(10, 2), -- PR value, streak count, etc.
  metadata JSONB, -- Additional data
  achieved_at TIMESTAMPTZ DEFAULT NOW(),
  is_viewed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workout_achievements_user 
  ON workout_achievements(user_id, achieved_at DESC);

CREATE INDEX IF NOT EXISTS idx_workout_achievements_unviewed 
  ON workout_achievements(user_id, is_viewed) WHERE is_viewed = FALSE;

-- ============================================================================
-- 6. Progressive Overload Suggestions Table
-- Stores AI-generated suggestions for progression
-- ============================================================================
CREATE TABLE IF NOT EXISTS progression_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('weight_increase', 'rep_increase', 'set_increase', 'tempo_change', 'variation', 'deload')),
  current_weight DECIMAL(10, 2),
  current_reps INTEGER,
  current_sets INTEGER,
  suggested_weight DECIMAL(10, 2),
  suggested_reps INTEGER,
  suggested_sets INTEGER,
  rationale TEXT,
  priority INTEGER DEFAULT 0, -- Higher = more important
  is_applied BOOLEAN DEFAULT FALSE,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days')
);

CREATE INDEX IF NOT EXISTS idx_progression_suggestions_user 
  ON progression_suggestions(user_id, is_applied, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_progression_suggestions_active 
  ON progression_suggestions(user_id, exercise_name, is_applied) 
  WHERE is_applied = FALSE AND expires_at > NOW();

-- ============================================================================
-- Functions and Triggers
-- ============================================================================

-- Function to update personal records automatically
CREATE OR REPLACE FUNCTION update_personal_records()
RETURNS TRIGGER AS $$
BEGIN
  -- Check for max weight PR
  INSERT INTO personal_records (user_id, exercise_name, record_type, value, weight, reps, sets, achieved_at, previous_record, improvement_percent)
  SELECT 
    NEW.user_id,
    NEW.exercise_name,
    'max_weight',
    NEW.weight,
    NEW.weight,
    NEW.reps,
    NEW.sets,
    NEW.created_at,
    COALESCE((SELECT value FROM personal_records WHERE user_id = NEW.user_id AND exercise_name = NEW.exercise_name AND record_type = 'max_weight'), 0),
    CASE 
      WHEN (SELECT value FROM personal_records WHERE user_id = NEW.user_id AND exercise_name = NEW.exercise_name AND record_type = 'max_weight') > 0
      THEN ((NEW.weight - (SELECT value FROM personal_records WHERE user_id = NEW.user_id AND exercise_name = NEW.exercise_name AND record_type = 'max_weight')) / (SELECT value FROM personal_records WHERE user_id = NEW.user_id AND exercise_name = NEW.exercise_name AND record_type = 'max_weight') * 100)
      ELSE 0
    END
  WHERE NEW.weight > COALESCE((SELECT value FROM personal_records WHERE user_id = NEW.user_id AND exercise_name = NEW.exercise_name AND record_type = 'max_weight'), 0)
  ON CONFLICT (user_id, exercise_name, record_type) 
  DO UPDATE SET 
    previous_record = personal_records.value,
    value = EXCLUDED.value,
    weight = EXCLUDED.weight,
    reps = EXCLUDED.reps,
    sets = EXCLUDED.sets,
    achieved_at = EXCLUDED.achieved_at,
    improvement_percent = EXCLUDED.improvement_percent,
    updated_at = NOW();

  -- Check for max volume PR
  INSERT INTO personal_records (user_id, exercise_name, record_type, value, weight, reps, sets, achieved_at, previous_record, improvement_percent)
  SELECT 
    NEW.user_id,
    NEW.exercise_name,
    'max_volume',
    NEW.volume,
    NEW.weight,
    NEW.reps,
    NEW.sets,
    NEW.created_at,
    COALESCE((SELECT value FROM personal_records WHERE user_id = NEW.user_id AND exercise_name = NEW.exercise_name AND record_type = 'max_volume'), 0),
    CASE 
      WHEN (SELECT value FROM personal_records WHERE user_id = NEW.user_id AND exercise_name = NEW.exercise_name AND record_type = 'max_volume') > 0
      THEN ((NEW.volume - (SELECT value FROM personal_records WHERE user_id = NEW.user_id AND exercise_name = NEW.exercise_name AND record_type = 'max_volume')) / (SELECT value FROM personal_records WHERE user_id = NEW.user_id AND exercise_name = NEW.exercise_name AND record_type = 'max_volume') * 100)
      ELSE 0
    END
  WHERE NEW.volume > COALESCE((SELECT value FROM personal_records WHERE user_id = NEW.user_id AND exercise_name = NEW.exercise_name AND record_type = 'max_volume'), 0)
  ON CONFLICT (user_id, exercise_name, record_type) 
  DO UPDATE SET 
    previous_record = personal_records.value,
    value = EXCLUDED.value,
    weight = EXCLUDED.weight,
    reps = EXCLUDED.reps,
    sets = EXCLUDED.sets,
    achieved_at = EXCLUDED.achieved_at,
    improvement_percent = EXCLUDED.improvement_percent,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update PRs when new exercise history is added
CREATE TRIGGER trigger_update_personal_records
AFTER INSERT ON exercise_history
FOR EACH ROW
EXECUTE FUNCTION update_personal_records();

-- Function to calculate recovery score
CREATE OR REPLACE FUNCTION calculate_recovery_score(p_user_id UUID, p_week_start DATE)
RETURNS INTEGER AS $$
DECLARE
  v_score INTEGER := 100;
  v_total_sessions INTEGER;
  v_rest_days INTEGER;
  v_vigorous_sessions INTEGER;
BEGIN
  SELECT 
    total_sessions,
    rest_days,
    vigorous_sessions
  INTO v_total_sessions, v_rest_days, v_vigorous_sessions
  FROM recovery_metrics
  WHERE user_id = p_user_id AND week_start = p_week_start;

  -- Deduct points for insufficient rest
  IF v_rest_days < 1 THEN
    v_score := v_score - 30;
  ELSIF v_rest_days < 2 THEN
    v_score := v_score - 10;
  END IF;

  -- Deduct points for high volume
  IF v_total_sessions > 6 THEN
    v_score := v_score - 10;
  END IF;

  -- Deduct points for too many vigorous sessions
  IF v_vigorous_sessions > 4 THEN
    v_score := v_score - 15;
  END IF;

  -- Clamp between 0-100
  v_score := GREATEST(0, LEAST(100, v_score));

  RETURN v_score;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE exercise_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE stagnation_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE progression_suggestions ENABLE ROW LEVEL SECURITY;

-- Policies for exercise_history
CREATE POLICY "Users can view their own exercise history"
  ON exercise_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own exercise history"
  ON exercise_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own exercise history"
  ON exercise_history FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own exercise history"
  ON exercise_history FOR DELETE
  USING (auth.uid() = user_id);

-- Policies for personal_records
CREATE POLICY "Users can view their own PRs"
  ON personal_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own PRs"
  ON personal_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own PRs"
  ON personal_records FOR UPDATE
  USING (auth.uid() = user_id);

-- Policies for stagnation_alerts
CREATE POLICY "Users can view their own stagnation alerts"
  ON stagnation_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stagnation alerts"
  ON stagnation_alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stagnation alerts"
  ON stagnation_alerts FOR UPDATE
  USING (auth.uid() = user_id);

-- Policies for recovery_metrics
CREATE POLICY "Users can view their own recovery metrics"
  ON recovery_metrics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recovery metrics"
  ON recovery_metrics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recovery metrics"
  ON recovery_metrics FOR UPDATE
  USING (auth.uid() = user_id);

-- Policies for workout_achievements
CREATE POLICY "Users can view their own achievements"
  ON workout_achievements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own achievements"
  ON workout_achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own achievements"
  ON workout_achievements FOR UPDATE
  USING (auth.uid() = user_id);

-- Policies for progression_suggestions
CREATE POLICY "Users can view their own suggestions"
  ON progression_suggestions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own suggestions"
  ON progression_suggestions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own suggestions"
  ON progression_suggestions FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Sample Queries for Testing
-- ============================================================================

-- Get user's exercise history for a specific exercise
-- SELECT * FROM exercise_history 
-- WHERE user_id = 'user-uuid' AND exercise_name = 'Bench Press'
-- ORDER BY created_at DESC LIMIT 10;

-- Get all personal records for a user
-- SELECT * FROM personal_records 
-- WHERE user_id = 'user-uuid'
-- ORDER BY achieved_at DESC;

-- Get active stagnation alerts
-- SELECT * FROM stagnation_alerts 
-- WHERE user_id = 'user-uuid' AND is_resolved = FALSE
-- ORDER BY severity DESC, created_at DESC;

-- Get current week's recovery metrics
-- SELECT * FROM recovery_metrics 
-- WHERE user_id = 'user-uuid' 
-- AND week_start = date_trunc('week', CURRENT_DATE)::DATE;

-- Get unviewed achievements
-- SELECT * FROM workout_achievements 
-- WHERE user_id = 'user-uuid' AND is_viewed = FALSE
-- ORDER BY achieved_at DESC;

-- Get active progression suggestions
-- SELECT * FROM progression_suggestions 
-- WHERE user_id = 'user-uuid' AND is_applied = FALSE 
-- AND expires_at > NOW()
-- ORDER BY priority DESC, created_at DESC;

