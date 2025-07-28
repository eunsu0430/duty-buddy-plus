-- Add filename column to civil_complaints_data table
ALTER TABLE public.civil_complaints_data 
ADD COLUMN filename text;