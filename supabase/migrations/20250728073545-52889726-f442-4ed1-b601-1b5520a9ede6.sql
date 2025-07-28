-- Insert or update admin account
INSERT INTO public.admin_users (username, password_hash) 
VALUES ('admin', 'admin123')
ON CONFLICT (username) 
DO UPDATE SET password_hash = 'admin123';