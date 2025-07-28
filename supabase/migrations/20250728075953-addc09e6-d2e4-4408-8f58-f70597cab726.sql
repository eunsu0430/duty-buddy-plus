-- Fix vector column types to use pgvector's vector type
ALTER TABLE public.civil_complaints_vectors 
ALTER COLUMN vector TYPE vector(1536);

ALTER TABLE public.training_vectors 
ALTER COLUMN vector TYPE vector(1536);