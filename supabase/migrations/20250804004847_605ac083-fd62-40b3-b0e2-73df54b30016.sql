-- Drop existing table and recreate with new structure
DROP TABLE IF EXISTS monthly_frequent_complaints;

-- Create new table with separate columns for similar complaints
CREATE TABLE public.monthly_frequent_complaints (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month integer NOT NULL,
  year integer NOT NULL,
  complaint_type text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  rank integer NOT NULL,
  similar_complaint_1 jsonb DEFAULT NULL,
  similar_complaint_2 jsonb DEFAULT NULL,
  similar_complaint_3 jsonb DEFAULT NULL,
  similar_complaint_4 jsonb DEFAULT NULL,
  similar_complaint_5 jsonb DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.monthly_frequent_complaints ENABLE ROW LEVEL SECURITY;

-- Create policy for all operations
CREATE POLICY "Allow all operations on monthly_frequent_complaints" 
ON public.monthly_frequent_complaints 
FOR ALL 
USING (true);

-- Create index for better performance
CREATE INDEX idx_monthly_complaints_year_month ON public.monthly_frequent_complaints(year, month);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_monthly_frequent_complaints_updated_at
BEFORE UPDATE ON public.monthly_frequent_complaints
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();