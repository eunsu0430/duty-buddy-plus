import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface IPAccessControlProps {
  children: React.ReactNode;
}

const IPAccessControl = ({ children }: IPAccessControlProps) => {
  const [isAccessAllowed, setIsAccessAllowed] = useState<boolean | null>(null);
  const [userIP, setUserIP] = useState<string>('');

  useEffect(() => {
    checkIPAccess();
  }, []);

  const checkIPAccess = async () => {
    try {
      // 여러 IP 확인 서비스를 시도
      let ip = '';
      
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        ip = data.ip;
      } catch {
        try {
          const response = await fetch('https://ipapi.co/json/');
          const data = await response.json();
          ip = data.ip;
        } catch {
          // 마지막 시도
          const response = await fetch('https://httpbin.org/ip');
          const data = await response.json();
          ip = data.origin;
        }
      }
      
      setUserIP(ip);
      
      // 허용된 IP 범위 체크
      const isAllowed = checkAllowedIP(ip);
      setIsAccessAllowed(isAllowed);
      
    } catch (error) {
      console.error('IP 확인 실패:', error);
      // IP 확인 실패 시 기본적으로 차단
      setIsAccessAllowed(false);
    }
  };

  const checkAllowedIP = (ip: string): boolean => {
    // 허용된 IP 패턴들
    const allowedPatterns = [
      /^108\.15\./, // 108.15.로 시작하는 IP
      /^192\.168\.2\.8$/, // 정확히 192.168.2.8
      /^127\.0\.0\.1$/, // localhost (개발용)
      /^::1$/, // IPv6 localhost (개발용)
    ];

    return allowedPatterns.some(pattern => pattern.test(ip));
  };

  // 로딩 중
  if (isAccessAllowed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>접속 확인 중...</CardTitle>
            <CardDescription>IP 주소를 확인하고 있습니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 접근 차단
  if (!isAccessAllowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-[500px]">
          <CardHeader>
            <CardTitle className="text-red-600">⛔ 접근 권한이 없습니다</CardTitle>
            <CardDescription>
              이 홈페이지는 특정 IP에서만 접근 가능한 홈페이지입니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">현재 접속 IP:</p>
              <p className="text-lg font-mono">{userIP}</p>
            </div>
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                <strong>허용된 IP 범위:</strong>
              </p>
              <ul className="text-sm text-red-700 mt-2 space-y-1">
                <li>• 108.15.xxx.xxx (내부 네트워크)</li>
                <li>• 192.168.2.8 (지정 IP)</li>
              </ul>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              접근 권한이 필요하시면 시스템 관리자에게 문의하세요.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 접근 허용
  return <>{children}</>;
};

export default IPAccessControl;