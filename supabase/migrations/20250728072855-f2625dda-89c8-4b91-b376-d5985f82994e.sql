-- Insert default admin user that persists
INSERT INTO public.admin_users (id, username, password_hash) 
VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'admin',
  '$2b$10$K7L/R3X9XmqIQJ8lRvqOTe8rZXVqJH5KGJ2P9XmqIQJ8lRvqOTe8r'
) 
ON CONFLICT (username) DO NOTHING;