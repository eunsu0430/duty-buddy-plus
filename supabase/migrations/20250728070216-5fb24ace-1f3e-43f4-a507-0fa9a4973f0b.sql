-- Create table for civil complaints vectors
CREATE TABLE public.civil_complaints_vectors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  vector FLOAT8[] NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.civil_complaints_vectors ENABLE ROW LEVEL SECURITY;

-- Create policy for civil complaints vectors
CREATE POLICY "Allow all operations on civil_complaints_vectors" 
ON public.civil_complaints_vectors 
FOR ALL 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_civil_complaints_vectors_updated_at
BEFORE UPDATE ON public.civil_complaints_vectors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();