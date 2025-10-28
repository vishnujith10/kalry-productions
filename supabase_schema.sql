-- Create user_food_logs table for Kalry app (matches backend expectations)
CREATE TABLE IF NOT EXISTS public.user_food_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    meal_type TEXT NOT NULL,
    food_name TEXT NOT NULL,
    calories DECIMAL(8,2) NOT NULL,
    protein DECIMAL(8,2) DEFAULT 0,
    carbohydrates DECIMAL(8,2) DEFAULT 0,
    fat DECIMAL(8,2) DEFAULT 0,
    photo_url TEXT, -- Add photo URL field for food images
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_user_food_logs_user_id ON public.user_food_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_food_logs_created_at ON public.user_food_logs(created_at);

-- Add photo_url column to existing user_food_logs table if it doesn't exist
ALTER TABLE public.user_food_logs ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_food_logs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (since we're using local_user for now)
CREATE POLICY "Allow all operations for user_food_logs" ON public.user_food_logs
    FOR ALL USING (true); 

-- Steps table: stores daily step data per user
create table if not exists steps (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  date date not null,
  steps integer not null,
  calories numeric,
  distance numeric,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Ensure one entry per user per day
create unique index if not exists unique_user_date on steps (user_id, date);

-- Step goals table: stores per-user daily step goal
create table if not exists step_goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null unique,
  goal integer not null default 10000,
  updated_at timestamp with time zone default timezone('utc'::text, now())
); 

-- Enable RLS for step_goals
drop policy if exists "Enable read access for all users" on step_goals;
alter table step_goals enable row level security;

create policy "Users can read their own step goal"
  on step_goals for select
  using (auth.uid() = user_id);

create policy "Users can upsert their own step goal"
  on step_goals for insert, update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id); 

-- Enable RLS for sleep_logs
drop policy if exists "Enable read access for all users" on sleep_logs;
alter table sleep_logs enable row level security;

create policy "Users can read their own sleep logs"
  on sleep_logs for select
  using (auth.uid() = user_id);

create policy "Users can upsert their own sleep logs"
  on sleep_logs for insert, update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Enable RLS for sleep_goals
drop policy if exists "Enable read access for all users" on sleep_goals;
alter table sleep_goals enable row level security;

create policy "Users can read their own sleep goal"
  on sleep_goals for select
  using (auth.uid() = user_id);

create policy "Users can upsert their own sleep goal"
  on sleep_goals for insert, update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id); 

-- =============================
-- Weight Tracking Tables
-- =============================

-- Weight logs table: stores individual weight entries per user
CREATE TABLE IF NOT EXISTS public.weight_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users NOT NULL,
    date DATE NOT NULL,
    weight DECIMAL(8,2) NOT NULL,
    note TEXT,
    emoji TEXT DEFAULT '😊',
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Ensure one entry per user per day (optional constraint)
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_date_weight ON public.weight_logs (user_id, date);

-- Enable RLS for weight_logs
ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for weight_logs
CREATE POLICY "Users can access their own weight logs" ON public.weight_logs
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============================

-- 1. Workouts table
CREATE TABLE IF NOT EXISTS public.workouts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES auth.users NOT NULL,
    date date NOT NULL DEFAULT CURRENT_DATE,
    duration integer, -- in seconds
    total_kcal integer,
    notes text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 2. Workout Exercises table
CREATE TABLE IF NOT EXISTS public.workout_exercises (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    workout_id uuid REFERENCES public.workouts(id) ON DELETE CASCADE,
    exercise_id integer REFERENCES public.exercises(id),
    "order" integer,
    total_sets integer,
    total_reps integer,
    total_weight integer,
    total_kcal integer
);

-- 3. Sets table
CREATE TABLE IF NOT EXISTS public.sets (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    workout_exercise_id uuid REFERENCES public.workout_exercises(id) ON DELETE CASCADE,
    set_number integer,
    reps integer,
    weight integer,
    rpe integer,
    duration varchar(10), -- e.g. '5:00' for cardio
    speed numeric, -- for cardio exercises (km/h)
    distance numeric, -- for cardio exercises (km)
    completed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 4. Routines table (optional, for templates)
CREATE TABLE IF NOT EXISTS public.routines (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES auth.users NOT NULL,
    name varchar(100),
    description text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 5. Routine Exercises table (optional, for templates)
CREATE TABLE IF NOT EXISTS public.routine_exercises (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    routine_id uuid REFERENCES public.routines(id) ON DELETE CASCADE,
    exercise_id integer REFERENCES public.exercises(id),
    "order" integer,
    default_sets integer,
    default_reps integer,
    default_weight integer
);

-- =============================
-- Saved Meals Table
-- =============================

CREATE TABLE IF NOT EXISTS public.saved_meal (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES auth.users NOT NULL,
    dish_name text NOT NULL,
    description text,
    calories numeric DEFAULT 0,
    protein numeric DEFAULT 0,
    carbs numeric DEFAULT 0,
    fat numeric DEFAULT 0,
    fiber numeric DEFAULT 0,
    photo_url text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Enable RLS for saved_meal
ALTER TABLE public.saved_meal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their own saved meals" ON public.saved_meal
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============================
-- Row Level Security (RLS) Policies
-- =============================

-- Workouts RLS
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their own workouts" ON public.workouts
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Workout Exercises RLS
ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their own workout_exercises" ON public.workout_exercises
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.workouts w WHERE w.id = workout_id AND w.user_id = auth.uid())
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.workouts w WHERE w.id = workout_id AND w.user_id = auth.uid())
    );

-- Sets RLS
ALTER TABLE public.sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their own sets" ON public.sets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.workout_exercises we
            JOIN public.workouts w ON we.workout_id = w.id
            WHERE we.id = workout_exercise_id AND w.user_id = auth.uid()
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workout_exercises we
            JOIN public.workouts w ON we.workout_id = w.id
            WHERE we.id = workout_exercise_id AND w.user_id = auth.uid()
        )
    );

-- Routines RLS
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their own routines" ON public.routines
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Routine Exercises RLS
ALTER TABLE public.routine_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their own routine_exercises" ON public.routine_exercises
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.routines r WHERE r.id = routine_id AND r.user_id = auth.uid())
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.routines r WHERE r.id = routine_id AND r.user_id = auth.uid())
    ); 