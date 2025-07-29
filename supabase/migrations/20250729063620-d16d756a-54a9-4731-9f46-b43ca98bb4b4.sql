-- Create access logs table to track IP access attempts
CREATE TABLE public.access_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  access_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  access_granted BOOLEAN NOT NULL DEFAULT false,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for access logs (allow all operations for now)
CREATE POLICY "Allow all operations on access_logs" 
ON public.access_logs 
FOR ALL 
USING (true);