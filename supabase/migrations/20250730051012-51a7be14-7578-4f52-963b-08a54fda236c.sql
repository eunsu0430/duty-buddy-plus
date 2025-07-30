-- 월별 빈발 민원유형 저장 테이블 생성
CREATE TABLE public.monthly_frequent_complaints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  complaint_type TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  rank INTEGER NOT NULL,
  similar_complaints JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(year, month, rank)
);

-- RLS 정책 활성화
ALTER TABLE public.monthly_frequent_complaints ENABLE ROW LEVEL SECURITY;

-- 모든 작업 허용 정책
CREATE POLICY "Allow all operations on monthly_frequent_complaints" 
ON public.monthly_frequent_complaints 
FOR ALL 
USING (true);

-- 업데이트 시간 자동 갱신 트리거
CREATE TRIGGER update_monthly_frequent_complaints_updated_at
BEFORE UPDATE ON public.monthly_frequent_complaints
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- pg_cron과 pg_net 확장 활성화 (스케줄링을 위해)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;