-- Create table for storing vectorized training materials
CREATE TABLE public.training_vectors (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    content TEXT NOT NULL,
    embedding VECTOR(1536),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.training_vectors ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (since this is admin managed)
CREATE POLICY "Allow all operations on training_vectors"
ON public.training_vectors
FOR ALL
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_training_vectors_updated_at
BEFORE UPDATE ON public.training_vectors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();