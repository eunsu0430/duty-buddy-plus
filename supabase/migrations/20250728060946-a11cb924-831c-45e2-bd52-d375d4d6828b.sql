-- Create admin users table for authentication
CREATE TABLE public.admin_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create departments table
CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create duty schedule table (통합 당직 명령부)
CREATE TABLE public.duty_schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  department_name TEXT NOT NULL,
  duty_facility TEXT NOT NULL,
  duty_date DATE NOT NULL,
  phone_number TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create civil complaints data table (민원 데이터)
CREATE TABLE public.civil_complaints_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_type TEXT NOT NULL,
  processing_method TEXT NOT NULL,
  registration_info TEXT,
  month_uploaded INTEGER NOT NULL,
  year_uploaded INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create training materials table
CREATE TABLE public.training_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duty_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.civil_complaints_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_materials ENABLE ROW LEVEL SECURITY;

-- Create policies (allowing public access for now - you can restrict later)
CREATE POLICY "Allow all operations on admin_users" ON public.admin_users FOR ALL USING (true);
CREATE POLICY "Allow all operations on departments" ON public.departments FOR ALL USING (true);
CREATE POLICY "Allow all operations on duty_schedule" ON public.duty_schedule FOR ALL USING (true);
CREATE POLICY "Allow all operations on civil_complaints_data" ON public.civil_complaints_data FOR ALL USING (true);
CREATE POLICY "Allow all operations on training_materials" ON public.training_materials FOR ALL USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_admin_users_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_duty_schedule_updated_at
  BEFORE UPDATE ON public.duty_schedule
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_civil_complaints_data_updated_at
  BEFORE UPDATE ON public.civil_complaints_data
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_training_materials_updated_at
  BEFORE UPDATE ON public.training_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default admin user (password: admin123)
INSERT INTO public.admin_users (username, password_hash) 
VALUES ('admin', '$2a$10$rOzjQQXgVlbZv1j7rWwQ6eKtI5DgYhDZz6OLV8.WBQT8AcY8ggKGi');

-- Insert sample departments
INSERT INTO public.departments (name, description) VALUES
('총무과', '총무 업무 담당'),
('재무과', '재무 및 회계 업무 담당'),
('인사과', '인사 관리 업무 담당'),
('시설관리과', '시설 관리 및 유지보수 담당'),
('보안과', '보안 및 안전 관리 담당');