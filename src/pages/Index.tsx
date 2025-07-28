import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Users, Calendar, Cloud } from "lucide-react";

const Index = () => {
  const currentDateTime = new Date();
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold mb-2">당직근무 지원 시스템</h1>
              <p className="text-muted-foreground">효율적인 당직근무와 민원 처리를 위한 통합 솔루션</p>
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
                <Cloud className="w-4 h-4" />
                <span>맑음 22°C</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Admin Mode Card */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                관리자 모드
              </CardTitle>
              <CardDescription>
                시스템 관리 및 데이터 업로드를 위한 관리자 전용 모드입니다.
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
                <Button className="w-full">
                  관리자 모드 접속
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Duty Officer Mode Card */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary/10">
                  <Users className="w-6 h-6 text-secondary" />
                </div>
                당직자 모드
              </CardTitle>
              <CardDescription>
                당직근무 중 민원 처리와 정보 조회를 위한 당직자 전용 모드입니다.
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
                <Button variant="secondary" className="w-full">
                  당직자 모드 접속
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
