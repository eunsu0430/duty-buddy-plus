-- Create civil_complaints_data table
CREATE TABLE public.civil_complaints_data (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  filename text,
  processing_method text NOT NULL,
  complaint_type text NOT NULL,
  month_uploaded integer NOT NULL,
  year_uploaded integer NOT NULL,
  registration_info text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.civil_complaints_data ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (since this is admin data)
CREATE POLICY "Allow all operations on civil_complaints_data" 
ON public.civil_complaints_data 
FOR ALL 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_civil_complaints_data_updated_at
BEFORE UPDATE ON public.civil_complaints_data
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();