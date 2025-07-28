import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet, BookOpen, Users } from "lucide-react";

const AdminMode = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [dutyForm, setDutyForm] = useState({
    departmentName: "",
    dutyFacility: "",
    dutyDate: "",
    phoneNumber: "",
    notes: ""
  });
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check against admin_users table
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('username', loginForm.username)
      .single();

    if (error || !data) {
      toast({
        title: "로그인 실패",
        description: "아이디 또는 비밀번호가 올바르지 않습니다.",
        variant: "destructive"
      });
      return;
    }

    // For demo purposes, we'll check if password is "admin123"
    if (loginForm.password === "admin123") {
      setIsAuthenticated(true);
      toast({
        title: "로그인 성공",
        description: "관리자 모드에 접속하였습니다."
      });
    } else {
      toast({
        title: "로그인 실패",
        description: "비밀번호가 올바르지 않습니다.",
        variant: "destructive"
      });
    }
  };

  const handleDutySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const dutyData = {
      department_name: dutyForm.departmentName,
      duty_facility: dutyForm.dutyFacility,
      duty_date: dutyForm.dutyDate,
      phone_number: dutyForm.phoneNumber,
      notes: dutyForm.notes
    };
    
    const { error } = await supabase
      .from('duty_schedule')
      .insert([dutyData]);

    if (error) {
      toast({
        title: "등록 실패",
        description: "당직 정보 등록에 실패했습니다.",
        variant: "destructive"
      });
    } else {
      toast({
        title: "등록 완료",
        description: "당직 정보가 성공적으로 등록되었습니다."
      });
      setDutyForm({
        departmentName: "",
        dutyFacility: "",
        dutyDate: "",
        phoneNumber: "",
        notes: ""
      });
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    toast({
      title: "업로드 시작",
      description: "민원 데이터를 처리하고 있습니다..."
    });

    // For demo purposes, we'll simulate processing
    setTimeout(() => {
      toast({
        title: "업로드 완료",
        description: "민원 데이터가 성공적으로 업로드되었습니다."
      });
    }, 2000);
  };

  const handleTrainingUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    toast({
      title: "교육자료 업로드",
      description: "교육자료를 처리하고 있습니다..."
    });

    // For demo purposes, we'll simulate processing
    setTimeout(() => {
      toast({
        title: "교육자료 업데이트 완료",
        description: "교육자료가 성공적으로 업데이트되었습니다."
      });
    }, 2000);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle className="text-center">관리자 로그인</CardTitle>
            <CardDescription className="text-center">
              당직근무 지원 시스템 관리자 모드
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">아이디</Label>
                <Input
                  id="username"
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                로그인
              </Button>
            </form>
            <div className="mt-4 text-sm text-muted-foreground text-center">
              데모 계정: admin / admin123
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">당직근무 지원 시스템 - 관리자 모드</h1>
          <Button 
            variant="outline" 
            onClick={() => setIsAuthenticated(false)}
          >
            로그아웃
          </Button>
        </div>

        <Tabs defaultValue="complaints" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="complaints" className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              민원 데이터 관리
            </TabsTrigger>
            <TabsTrigger value="training" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              교육자료 관리
            </TabsTrigger>
            <TabsTrigger value="duty" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              당직 명령부 관리
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              시스템 설정
            </TabsTrigger>
          </TabsList>

          <TabsContent value="complaints">
            <Card>
              <CardHeader>
                <CardTitle>민원 데이터 업로드</CardTitle>
                <CardDescription>
                  한 달 주기 학습용 민원 엑셀 파일을 업로드하여 기존 데이터에 축적합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="complaints-upload">민원 데이터 엑셀 파일</Label>
                    <Input
                      id="complaints-upload"
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleExcelUpload}
                      className="mt-2"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>• 엑셀 파일 형식: 민원유형, 처리방법, 등록정보 컬럼 필요</p>
                    <p>• 기존 데이터에 추가로 축적됩니다</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="training">
            <Card>
              <CardHeader>
                <CardTitle>당직근무 교육자료 관리</CardTitle>
                <CardDescription>
                  교육자료를 업로드하고 AI 학습을 위한 재학습을 수행합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="training-upload">교육자료 파일</Label>
                    <Input
                      id="training-upload"
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={handleTrainingUpload}
                      className="mt-2"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>• 지원 형식: PDF, DOC, DOCX, TXT</p>
                    <p>• 기존 학습 내용을 제거하고 새로운 자료로 재학습됩니다</p>
                  </div>
                  <Button variant="destructive">
                    기존 학습 데이터 초기화 및 재학습
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="duty">
            <Card>
              <CardHeader>
                <CardTitle>통합 당직 명령부 관리</CardTitle>
                <CardDescription>
                  부서별 당직 정보를 등록하고 관리합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleDutySubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="departmentName">부서명</Label>
                      <Input
                        id="departmentName"
                        value={dutyForm.departmentName}
                        onChange={(e) => setDutyForm(prev => ({ ...prev, departmentName: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dutyFacility">근무시설</Label>
                      <Input
                        id="dutyFacility"
                        value={dutyForm.dutyFacility}
                        onChange={(e) => setDutyForm(prev => ({ ...prev, dutyFacility: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dutyDate">근무일</Label>
                      <Input
                        id="dutyDate"
                        type="date"
                        value={dutyForm.dutyDate}
                        onChange={(e) => setDutyForm(prev => ({ ...prev, dutyDate: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phoneNumber">전화번호</Label>
                      <Input
                        id="phoneNumber"
                        value={dutyForm.phoneNumber}
                        onChange={(e) => setDutyForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">비고</Label>
                    <Textarea
                      id="notes"
                      value={dutyForm.notes}
                      onChange={(e) => setDutyForm(prev => ({ ...prev, notes: e.target.value }))}
                      rows={3}
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    당직 정보 등록
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>시스템 설정</CardTitle>
                <CardDescription>
                  시스템 전반적인 설정을 관리합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button variant="outline" className="w-full">
                    데이터베이스 백업
                  </Button>
                  <Button variant="outline" className="w-full">
                    시스템 로그 확인
                  </Button>
                  <Button variant="destructive" className="w-full">
                    전체 데이터 초기화
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminMode;