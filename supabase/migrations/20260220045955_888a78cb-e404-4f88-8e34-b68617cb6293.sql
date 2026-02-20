
-- Create storage bucket for manuals
INSERT INTO storage.buckets (id, name, public) VALUES ('manuals', 'manuals', true);

-- Allow anyone to read manuals
CREATE POLICY "Anyone can read manuals"
ON storage.objects FOR SELECT
USING (bucket_id = 'manuals');

-- Allow anyone to upload manuals (admin-controlled via app logic)
CREATE POLICY "Anyone can upload manuals"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'manuals');

-- Allow anyone to delete manuals
CREATE POLICY "Anyone can delete manuals"
ON storage.objects FOR DELETE
USING (bucket_id = 'manuals');
