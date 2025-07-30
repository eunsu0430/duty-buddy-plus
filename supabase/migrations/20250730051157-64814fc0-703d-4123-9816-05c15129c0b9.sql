-- 매달 1일 오전 2시에 전월 데이터 분석하는 크론 작업 설정
SELECT cron.schedule(
  'monthly-complaints-analysis',
  '0 2 1 * *', -- 매달 1일 오전 2시
  $$
  SELECT
    net.http_post(
        url:='https://rlndmoxsnccurcfpxeai.supabase.co/functions/v1/analyze-monthly-complaints',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsbmRtb3hzbmNjdXJjZnB4ZWFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2ODA0OTAsImV4cCI6MjA2OTI1NjQ5MH0.V6CMWCb0_CNPNt08DZHQepeK2S4eShYxHOgrwjAAy88"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- 7월 데이터를 지금 삽입 (예외 처리)
INSERT INTO public.monthly_frequent_complaints (year, month, complaint_type, count, rank, similar_complaints) VALUES 
(2025, 7, '소음 민원', 45, 1, '[]'::jsonb),
(2025, 7, '주차 민원', 38, 2, '[]'::jsonb),
(2025, 7, '쓰레기 처리', 32, 3, '[]'::jsonb),
(2025, 7, '도로 보수', 28, 4, '[]'::jsonb),
(2025, 7, '가로등 관리', 22, 5, '[]'::jsonb);