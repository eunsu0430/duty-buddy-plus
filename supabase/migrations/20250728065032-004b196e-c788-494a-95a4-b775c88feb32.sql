-- Create vectorized training materials table
CREATE TABLE public.training_vectors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  vector NUMERIC[] NOT NULL, -- Store OpenAI embeddings as numeric array
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.training_vectors ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access
CREATE POLICY "Allow all operations on training_vectors" 
ON public.training_vectors 
FOR ALL 
USING (true);

-- Add updated_at trigger
CREATE TRIGGER update_training_vectors_updated_at
BEFORE UPDATE ON public.training_vectors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update duty_schedule table to simplify fields
ALTER TABLE public.duty_schedule 
DROP COLUMN IF EXISTS notes,
ADD COLUMN IF NOT EXISTS duty_day TEXT; -- 요일 (월요일, 화요일 등)

-- Update duty_schedule table structure for better management
ALTER TABLE public.duty_schedule 
DROP COLUMN IF EXISTS duty_date;

-- Add index for vector similarity search
CREATE INDEX idx_training_vectors_content ON public.training_vectors USING gin(to_tsvector('korean', content));