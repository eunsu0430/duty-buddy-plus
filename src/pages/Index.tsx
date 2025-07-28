import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Users, Calendar, Cloud, Thermometer } from "lucide-react";
import { useState, useEffect } from "react";

const Index = () => {
  const currentDateTime = new Date();
  const [weather, setWeather] = useState({ temperature: 22, description: '맑음' });

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const response = await fetch('https://rlndmoxsnccurcfpxeai.supabase.co/functions/v1/weather-api');
        if (response.ok) {
          const weatherData = await response.json();
          setWeather(weatherData);
        }
      } catch (error) {
        console.error('날씨 정보를 가져오는데 실패했습니다:', error);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 600000); // 10분마다 업데이트
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <div className="border-b bg-card/80 backdrop-blur-sm shadow-sm p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                당직근무 지원 시스템
              </h1>
              <p className="text-muted-foreground text-lg">AI 기반 스마트 당직 관리 솔루션</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4" />
                <span>{currentDateTime.toLocaleDateString('ko-KR', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  weekday: 'long'
                })}</span>
              </div>
              <div className="flex items-center gap-2 text-sm mt-1">
                <Thermometer className="w-4 h-4" />
                <span>당진시 {weather.description} {weather.temperature}°C</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Admin Mode Card */}
          <Card className="hover:shadow-xl hover:scale-105 transition-all duration-300 border-2 hover:border-primary/20 bg-gradient-to-br from-card to-card/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg">
                  <Shield className="w-7 h-7 text-primary-foreground" />
                </div>
                관리자 모드
              </CardTitle>
              <CardDescription className="text-base">
                시스템 관리 및 AI 학습을 위한 관리자 전용 모드입니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  로그인 시 비밀번호 인증
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  민원 엑셀 데이터 업로드
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  교육자료 관리 및 AI 재학습
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  통합 당직 명령부 관리
                </div>
              </div>
              <Link to="/admin" className="block">
                <Button className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-300">
                  🔐 관리자 모드 접속
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Duty Officer Mode Card */}
          <Card className="hover:shadow-xl hover:scale-105 transition-all duration-300 border-2 hover:border-secondary/20 bg-gradient-to-br from-card to-card/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-3 rounded-xl bg-gradient-to-br from-secondary to-secondary/80 shadow-lg">
                  <Users className="w-7 h-7 text-secondary-foreground" />
                </div>
                당직자 모드
              </CardTitle>
              <CardDescription className="text-base">
                AI 상담과 민원 처리를 위한 당직자 전용 모드입니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  부서별 당직 현황 및 연락처
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  AI 기반 민원 상담 지원
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  자동 민원 등록 서식 생성
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  실시간 날씨 및 일정 정보
                </div>
              </div>
              <Link to="/duty" className="block">
                <Button variant="secondary" className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-secondary to-secondary/90 hover:from-secondary/90 hover:to-secondary shadow-lg hover:shadow-xl transition-all duration-300">
                  👥 당직자 모드 접속
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* System Features */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-6 text-center">시스템 주요 기능</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">지능형 민원 처리</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  AI 기반 민원 상담으로 신속하고 정확한 처리 방법을 안내합니다.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">통합 당직 관리</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  모든 부서의 당직 정보를 한 곳에서 관리하고 조회할 수 있습니다.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">자동화된 문서 작성</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  간단한 정보 입력으로 완성도 높은 민원 등록 문서를 생성합니다.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
