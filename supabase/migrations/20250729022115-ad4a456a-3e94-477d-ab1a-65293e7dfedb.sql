-- IP 접근 관리 테이블 생성
CREATE TABLE public.allowed_ips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.allowed_ips ENABLE ROW LEVEL SECURITY;

-- 모든 작업 허용 정책
CREATE POLICY "Allow all operations on allowed_ips" 
ON public.allowed_ips 
FOR ALL 
USING (true);

-- 업데이트 시간 자동 갱신 트리거
CREATE TRIGGER update_allowed_ips_updated_at
BEFORE UPDATE ON public.allowed_ips
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 기본 허용 IP 삽입
INSERT INTO public.allowed_ips (ip_address, description) VALUES 
('210.95.187.140', '허용된 IP');