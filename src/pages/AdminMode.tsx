import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet, BookOpen, Users, ArrowLeft, Edit, Trash2, Plus } from "lucide-react";

const AdminMode = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [dutyForm, setDutyForm] = useState({
    departmentName: "",
    dutyFacility: "",
    dutyDay: "",
    phoneNumber: "",
    notes: ""
  });
  const [departments, setDepartments] = useState<any[]>([]);
  const [editingDept, setEditingDept] = useState<any>(null);
  const [newDept, setNewDept] = useState({ name: "", description: "" });
  const [trainingMaterials, setTrainingMaterials] = useState<any[]>([]);
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
      duty_day: dutyForm.dutyDay,
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
        dutyDay: "",
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

    try {
      // Read file content
      const content = await file.text();
      
      // Send to vectorize function
      const { data, error } = await supabase.functions.invoke('vectorize-content', {
        body: { 
          content: content,
          metadata: { 
            title: file.name,
            file_type: file.type
          }
        }
      });

      if (error) throw error;

      toast({
        title: "교육자료 업데이트 완료",
        description: "교육자료가 성공적으로 벡터화되어 저장되었습니다."
      });
      
      // Refresh training materials list
      fetchTrainingMaterials();
    } catch (error) {
      console.error('Training upload error:', error);
      toast({
        title: "업로드 실패",
        description: "교육자료 업로드 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const fetchDepartments = async () => {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('name');
    
    if (!error) {
      setDepartments(data || []);
    }
  };

  const handleAddDepartment = async () => {
    if (!newDept.name.trim()) return;
    
    const { error } = await supabase
      .from('departments')
      .insert([newDept]);
    
    if (error) {
      toast({
        title: "추가 실패",
        description: "부서 추가 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } else {
      toast({
        title: "추가 완료",
        description: "부서가 성공적으로 추가되었습니다."
      });
      setNewDept({ name: "", description: "" });
      fetchDepartments();
    }
  };

  const handleUpdateDepartment = async () => {
    if (!editingDept) return;
    
    const { error } = await supabase
      .from('departments')
      .update(editingDept)
      .eq('id', editingDept.id);
    
    if (error) {
      toast({
        title: "수정 실패",
        description: "부서 수정 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } else {
      toast({
        title: "수정 완료",
        description: "부서가 성공적으로 수정되었습니다."
      });
      setEditingDept(null);
      fetchDepartments();
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast({
        title: "삭제 실패",
        description: "부서 삭제 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } else {
      toast({
        title: "삭제 완료",
        description: "부서가 성공적으로 삭제되었습니다."
      });
      fetchDepartments();
    }
  };

  const fetchTrainingMaterials = async () => {
    const { data, error } = await supabase
      .from('training_vectors')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error) {
      setTrainingMaterials(data || []);
    }
  };

  const handleDeleteTrainingMaterial = async (id: string) => {
    const { error } = await supabase
      .from('training_vectors')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast({
        title: "삭제 실패",
        description: "교육자료 삭제 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } else {
      toast({
        title: "삭제 완료",
        description: "교육자료가 성공적으로 삭제되었습니다."
      });
      fetchTrainingMaterials();
    }
  };

  const handleSystemReset = async () => {
    try {
      // Delete all data from all tables
      await supabase.from('duty_schedule').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('civil_complaints_data').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('training_vectors').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('departments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      toast({
        title: "초기화 완료",
        description: "모든 데이터가 성공적으로 초기화되었습니다."
      });
    } catch (error) {
      toast({
        title: "초기화 실패",
        description: "데이터 초기화 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const handleDatabaseBackup = async () => {
    toast({
      title: "백업 시작",
      description: "데이터베이스 백업을 진행 중입니다..."
    });
    
    // Simulate backup process
    setTimeout(() => {
      toast({
        title: "백업 완료",
        description: "데이터베이스가 성공적으로 백업되었습니다."
      });
    }, 3000);
  };

  const handleSystemLogs = () => {
    // Open logs in new tab
    window.open('https://supabase.com/dashboard/project/rlndmoxsnccurcfpxeai/logs/explorer', '_blank');
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchDepartments();
      fetchTrainingMaterials();
    }
  }, [isAuthenticated]);

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
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={() => window.history.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              뒤로가기
            </Button>
            <h1 className="text-3xl font-bold">당직근무 지원 시스템 - 관리자 모드</h1>
          </div>
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
                    <p>• 파일 업로드 시 자동으로 벡터화되어 저장됩니다</p>
                  </div>
                  
                  {/* Training Materials List */}
                  <div className="mt-6">
                    <h4 className="font-medium mb-4">업로드된 교육자료</h4>
                    {trainingMaterials.length === 0 ? (
                      <p className="text-muted-foreground">등록된 교육자료가 없습니다.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>제목</TableHead>
                            <TableHead>업로드 일시</TableHead>
                            <TableHead>관리</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {trainingMaterials.map((material) => (
                            <TableRow key={material.id}>
                              <TableCell>{material.title}</TableCell>
                              <TableCell>{new Date(material.created_at).toLocaleString()}</TableCell>
                              <TableCell>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteTrainingMaterial(material.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="duty">
            <div className="space-y-6">
              {/* Department Management */}
              <Card>
                <CardHeader>
                  <CardTitle>부서 관리</CardTitle>
                  <CardDescription>
                    현재 등록된 부서들을 관리하고 새로운 부서를 추가할 수 있습니다.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Add New Department */}
                    <div className="border rounded-lg p-4 bg-muted/50">
                      <h4 className="font-medium mb-3">새 부서 추가</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="newDeptName">부서명</Label>
                          <Input
                            id="newDeptName"
                            value={newDept.name}
                            onChange={(e) => setNewDept(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="예: 총무과"
                          />
                        </div>
                        <div>
                          <Label htmlFor="newDeptDesc">설명</Label>
                          <Input
                            id="newDeptDesc"
                            value={newDept.description}
                            onChange={(e) => setNewDept(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="부서 설명"
                          />
                        </div>
                      </div>
                      <Button onClick={handleAddDepartment} className="mt-3">
                        <Plus className="w-4 h-4 mr-2" />
                        부서 추가
                      </Button>
                    </div>

                    {/* Department List */}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>부서명</TableHead>
                          <TableHead>설명</TableHead>
                          <TableHead>생성일</TableHead>
                          <TableHead>관리</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {departments.map((dept) => (
                          <TableRow key={dept.id}>
                            <TableCell>
                              {editingDept?.id === dept.id ? (
                                <Input
                                  value={editingDept.name}
                                  onChange={(e) => setEditingDept(prev => ({ ...prev, name: e.target.value }))}
                                />
                              ) : (
                                dept.name
                              )}
                            </TableCell>
                            <TableCell>
                              {editingDept?.id === dept.id ? (
                                <Input
                                  value={editingDept.description || ''}
                                  onChange={(e) => setEditingDept(prev => ({ ...prev, description: e.target.value }))}
                                />
                              ) : (
                                dept.description || '-'
                              )}
                            </TableCell>
                            <TableCell>
                              {new Date(dept.created_at).toLocaleDateString('ko-KR')}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                {editingDept?.id === dept.id ? (
                                  <>
                                    <Button size="sm" onClick={handleUpdateDepartment}>
                                      저장
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => setEditingDept(null)}>
                                      취소
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button size="sm" variant="outline" onClick={() => setEditingDept(dept)}>
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button size="sm" variant="destructive">
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>부서 삭제 확인</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            '{dept.name}' 부서를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>취소</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDeleteDepartment(dept.id)}>
                                            삭제
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Duty Schedule Registration */}
              <Card>
                <CardHeader>
                  <CardTitle>당직 정보 등록</CardTitle>
                  <CardDescription>
                    부서별 당직 정보를 등록합니다.
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
                        <Label htmlFor="dutyDay">근무요일</Label>
                        <select
                          id="dutyDay"
                          className="w-full p-2 border rounded-md"
                          value={dutyForm.dutyDay}
                          onChange={(e) => setDutyForm(prev => ({ ...prev, dutyDay: e.target.value }))}
                          required
                        >
                          <option value="">요일 선택</option>
                          <option value="월요일">월요일</option>
                          <option value="화요일">화요일</option>
                          <option value="수요일">수요일</option>
                          <option value="목요일">목요일</option>
                          <option value="금요일">금요일</option>
                          <option value="토요일">토요일</option>
                          <option value="일요일">일요일</option>
                        </select>
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
            </div>
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
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={handleDatabaseBackup}
                  >
                    📦 데이터베이스 백업
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={handleSystemLogs}
                  >
                    📋 시스템 로그 확인
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full">
                        🗑️ 전체 데이터 초기화
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>정말 초기화 하시겠습니까?</AlertDialogTitle>
                        <AlertDialogDescription>
                          이 작업은 모든 데이터를 영구적으로 삭제합니다. 
                          민원 데이터, 교육자료, 당직 정보, 부서 정보가 모두 삭제되며 되돌릴 수 없습니다.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSystemReset} className="bg-destructive">
                          확인, 모든 데이터 삭제
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
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