-- Create streaks table to track user streaks
CREATE TABLE IF NOT EXISTS public.streaks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    food_streak INTEGER DEFAULT 0 NOT NULL,
    exercise_streak INTEGER DEFAULT 0 NOT NULL,
    food_last_log_date DATE,
    exercise_last_log_date DATE,
    food_max_streak INTEGER DEFAULT 0 NOT NULL,
    exercise_max_streak INTEGER DEFAULT 0 NOT NULL,
    food_freezes_left INTEGER DEFAULT 3 NOT NULL,
    exercise_buffer INTEGER DEFAULT 2 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_streaks_user_id ON public.streaks(user_id);

-- Enable Row Level Security
ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own streaks"
    ON public.streaks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own streaks"
    ON public.streaks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own streaks"
    ON public.streaks FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own streaks"
    ON public.streaks FOR DELETE
    USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_streaks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_streaks_updated_at_trigger
    BEFORE UPDATE ON public.streaks
    FOR EACH ROW
    EXECUTE FUNCTION update_streaks_updated_at();

-- Grant permissions
GRANT ALL ON public.streaks TO authenticated;
GRANT ALL ON public.streaks TO service_role;

