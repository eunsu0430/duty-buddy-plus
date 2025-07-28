-- Remove foreign key constraint and drop departments table
ALTER TABLE public.duty_schedule DROP CONSTRAINT IF EXISTS duty_schedule_department_id_fkey;
ALTER TABLE public.duty_schedule DROP COLUMN IF EXISTS department_id;
DROP TABLE IF EXISTS public.departments;