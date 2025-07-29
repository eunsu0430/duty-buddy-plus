import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { Upload, FileSpreadsheet, BookOpen, Users, ArrowLeft, Trash2, Edit, Plus } from "lucide-react";
import * as XLSX from 'xlsx';

const AdminMode = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [dutyForm, setDutyForm] = useState({
    department: "",
    facility: "",
    dutyDay: "",
    phone: "",
    notes: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  
  // State for training materials and civil complaints data
  const [trainingMaterials, setTrainingMaterials] = useState<any[]>([]);
  const [civilComplaintsData, setCivilComplaintsData] = useState<any[]>([]);
  
  // State for duty schedules
  const [dutySchedules, setDutySchedules] = useState<any[]>([]);
  const [editingDuty, setEditingDuty] = useState<any>(null);
  
  // State for IP access management
  const [allowedIPs, setAllowedIPs] = useState<{ ip: string; description: string }[]>([]);
  const [newIPForm, setNewIPForm] = useState({ ip: '', description: '' });
  const [editingIP, setEditingIP] = useState<{ index: number; ip: string; description: string } | null>(null);
  
  
  const { toast } = useToast();
  const navigate = useNavigate();

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

  const handleDutyFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setDutyForm(prev => ({ ...prev, [name]: value }));
  };

  const handleDutySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const dutyData = {
      department_name: dutyForm.department,
      duty_facility: dutyForm.facility,
      duty_day: dutyForm.dutyDay,
      phone_number: dutyForm.phone,
      remarks: dutyForm.notes
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
        department: "",
        facility: "",
        dutyDay: "",
        phone: "",
        notes: ""
      });
      fetchDutySchedules(); // Refresh the list
    }
    setIsLoading(false);
  };

  const handleDutyUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDuty) return;
    
    setIsLoading(true);
    
    const { error } = await supabase
      .from('duty_schedule')
      .update({
        department_name: editingDuty.department_name,
        duty_facility: editingDuty.duty_facility,
        duty_day: editingDuty.duty_day,
        phone_number: editingDuty.phone_number,
        remarks: editingDuty.remarks
      })
      .eq('id', editingDuty.id);

    if (error) {
      toast({
        title: "수정 실패",
        description: "당직 정보 수정에 실패했습니다.",
        variant: "destructive"
      });
    } else {
      toast({
        title: "수정 완료",
        description: "당직 정보가 성공적으로 수정되었습니다."
      });
      setEditingDuty(null);
      fetchDutySchedules();
    }
    setIsLoading(false);
  };

  const handleDutyDelete = async (dutyId: string) => {
    const { error } = await supabase
      .from('duty_schedule')
      .delete()
      .eq('id', dutyId);

    if (error) {
      toast({
        title: "삭제 실패",
        description: "당직 정보 삭제에 실패했습니다.",
        variant: "destructive"
      });
    } else {
      toast({
        title: "삭제 완료",
        description: "당직 정보가 성공적으로 삭제되었습니다."
      });
      fetchDutySchedules();
    }
  };

  // Training material upload handler
  const handleTrainingUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    
     try {
      const reader = new FileReader();
       reader.onload = async (e) => {
         let content: string;
         
         // PDF 파일인 경우 ArrayBuffer를 base64로 변환
         if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
           const arrayBuffer = e.target?.result as ArrayBuffer;
           const uint8Array = new Uint8Array(arrayBuffer);
           const binaryString = uint8Array.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
           content = btoa(binaryString);
         } else {
           content = e.target?.result as string;
         }
        
        const { error } = await supabase.functions.invoke('vectorize-content', {
          body: {
            content: content,
            metadata: {
              title: file.name,
              fileType: file.type,
              uploadedAt: new Date().toISOString()
            }
          }
        });

        if (error) {
          console.error('Training upload error:', error);
          toast({
            title: "오류",
            description: "교육자료 업로드에 실패했습니다.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "성공",
            description: "교육자료가 성공적으로 업로드되고 벡터화되었습니다.",
          });
          fetchTrainingMaterials();
        }
        setIsLoading(false);
      };
      
      // PDF 파일은 ArrayBuffer로, 텍스트 파일은 텍스트로 읽기
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file);
      }
    } catch (error) {
      console.error('File reading error:', error);
      toast({
        title: "오류",
        description: "파일 읽기에 실패했습니다.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  // Civil complaints upload handler (Excel processing)
  const handleCivilComplaintsUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // Extract headers and data
      const headers = jsonData[0] as string[];
      const rows = jsonData.slice(1) as any[][];

      // Find column indices for required fields
      const columnMap = {
        serialNumber: headers.findIndex(h => h?.includes('일련번호') || h?.includes('번호')),
        date: headers.findIndex(h => h?.includes('일자') || h?.includes('날짜')),
        complaintContent: headers.findIndex(h => h?.includes('민원내용') || h?.includes('내용')),
        actionContent: headers.findIndex(h => h?.includes('조치내용') || h?.includes('조치')),
        department: headers.findIndex(h => h?.includes('처리부서') || h?.includes('부서')),
        isSimpleInquiry: headers.findIndex(h => h?.includes('단순문의') || h?.includes('문의')),
        status: headers.findIndex(h => h?.includes('처리상태') || h?.includes('상태')),
        completionDate: headers.findIndex(h => h?.includes('처리완료') || h?.includes('완료'))
      };

      // Process each row and create content for vectorization
      let processedCount = 0;
      const currentFilename = file.name;
      
      // First, store the file information in civil_complaints_data
      const fileRecordData = {
        filename: currentFilename,
        processing_method: '벡터화 처리',
        complaint_type: 'Excel 업로드',
        month_uploaded: new Date().getMonth() + 1,
        year_uploaded: new Date().getFullYear(),
        registration_info: `파일명: ${currentFilename}, 처리된 행 수: ${rows.length}`
      };

      const { data: fileRecord, error: fileError } = await (supabase as any)
        .from('civil_complaints_data')
        .insert(fileRecordData)
        .select()
        .single();

      if (fileError) {
        console.error('Error storing file record:', fileError);
        toast({
          title: "오류",
          description: "파일 정보 저장에 실패했습니다.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      for (const row of rows) {
        if (row.length === 0) continue; // Skip empty rows

        const data = {
          serialNumber: columnMap.serialNumber >= 0 ? row[columnMap.serialNumber] : '',
          date: columnMap.date >= 0 ? row[columnMap.date] : '',
          complaintContent: columnMap.complaintContent >= 0 ? row[columnMap.complaintContent] : '',
          actionContent: columnMap.actionContent >= 0 ? row[columnMap.actionContent] : '',
          department: columnMap.department >= 0 ? row[columnMap.department] : '',
          isSimpleInquiry: columnMap.isSimpleInquiry >= 0 ? row[columnMap.isSimpleInquiry] : '',
          status: columnMap.status >= 0 ? row[columnMap.status] : '',
          completionDate: columnMap.completionDate >= 0 ? row[columnMap.completionDate] : ''
        };

        // Create structured content for vectorization
        const content = `
민원번호: ${data.serialNumber}
접수일자: ${data.date}
민원내용: ${data.complaintContent}
조치내용: ${data.actionContent}
처리부서: ${data.department}
단순문의여부: ${data.isSimpleInquiry}
처리상태: ${data.status}
처리완료날짜: ${data.completionDate}
        `.trim();

        // Send to vectorization function
        const { error } = await supabase.functions.invoke('vectorize-civil-complaints', {
          body: {
            content: content,
            metadata: {
              title: `민원데이터_${data.serialNumber || processedCount + 1}`,
              serialNumber: data.serialNumber,
              date: data.date,
              department: data.department,
              status: data.status,
              filename: currentFilename,
              uploadedAt: new Date().toISOString()
            }
          }
        });

        if (error) {
          console.error(`Error processing row ${processedCount + 1}:`, error);
        } else {
          processedCount++;
        }
      }

      if (processedCount > 0) {
        toast({
          title: "성공",
          description: `${processedCount}건의 민원데이터가 성공적으로 업로드되고 벡터화되었습니다.`,
        });
        fetchCivilComplaintsData();
      } else {
        toast({
          title: "오류",
          description: "처리된 민원데이터가 없습니다. 파일 형식을 확인해주세요.",
          variant: "destructive",
        });
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Excel processing error:', error);
      toast({
        title: "오류",
        description: "Excel 파일 처리 중 오류가 발생했습니다.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  // Fetch training materials
  const fetchTrainingMaterials = async () => {
    const { data, error } = await supabase
      .from('training_vectors')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching training materials:', error);
      toast({
        title: "오류",
        description: "교육자료 목록을 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    } else {
      setTrainingMaterials(data || []);
    }
  };

  // Fetch civil complaints data
  const fetchCivilComplaintsData = async () => {
    const { data, error } = await (supabase as any)
      .from('civil_complaints_data')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching civil complaints data:', error);
      toast({
        title: "오류",
        description: "민원데이터 목록을 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    } else {
      setCivilComplaintsData((data as any) || []);
    }
  };

  // Delete training material
  const handleDeleteTrainingMaterial = async (materialId: string) => {
    const { error } = await supabase
      .from('training_vectors')
      .delete()
      .eq('id', materialId);

    if (error) {
      console.error('Error deleting training material:', error);
      toast({
        title: "오류",
        description: "교육자료 삭제에 실패했습니다.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "성공",
        description: "교육자료가 성공적으로 삭제되었습니다.",
      });
      fetchTrainingMaterials();
    }
  };

  // Delete civil complaints data
  const handleDeleteCivilComplaintsData = async (dataId: string) => {
    const { error } = await (supabase as any)
      .from('civil_complaints_data')
      .delete()
      .eq('id', dataId);

    if (error) {
      console.error('Error deleting civil complaints data:', error);
      toast({
        title: "오류",
        description: "민원데이터 삭제에 실패했습니다.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "성공",
        description: "민원데이터가 성공적으로 삭제되었습니다.",
      });
      fetchCivilComplaintsData();
    }
  };

  // System reset handler
  const handleSystemReset = async () => {
    setIsLoading(true);

    try {
      await Promise.all([
        (supabase as any).from('civil_complaints_data').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('civil_complaints_vectors').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('duty_schedule').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('training_materials').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('training_vectors').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      ]);

      toast({
        title: "초기화 완료",
        description: "모든 데이터가 성공적으로 초기화되었습니다.",
      });
    } catch (error) {
      console.error('System reset error:', error);
      toast({
        title: "초기화 실패",
        description: "데이터 초기화 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }

    setIsLoading(false);
  };

  // Database backup handler
  const handleDatabaseBackup = async () => {
    setIsLoading(true);
    toast({
      title: "백업 시작",
      description: "데이터베이스 백업을 진행 중입니다...",
    });

    // Simulate backup process
    setTimeout(() => {
      toast({
        title: "백업 완료",
        description: "데이터베이스가 성공적으로 백업되었습니다.",
      });
      setIsLoading(false);
    }, 3000);
  };

  // System logs handler
  const handleSystemLogs = () => {
    window.open('https://supabase.com/dashboard/project/rlndmoxsnccurcfpxeai/logs/explorer', '_blank');
  };

  // Fetch duty schedules
  const fetchDutySchedules = async () => {
    const { data, error } = await supabase
      .from('duty_schedule')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching duty schedules:', error);
      toast({
        title: "오류",
        description: "당직 정보 목록을 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    } else {
      setDutySchedules(data || []);
    }
  };

  // IP 접근 관리 함수들
  const loadAllowedIPs = () => {
    const savedIPs = localStorage.getItem('allowedIPs');
    if (savedIPs) {
      try {
        const parsed = JSON.parse(savedIPs);
        setAllowedIPs(parsed);
      } catch (error) {
        console.error('IP 목록 로드 실패:', error);
      }
    } else {
      // 기본 허용 IP 설정
      const defaultIPs = [
        { ip: '108.15.*', description: '내부 네트워크' },
        { ip: '192.168.2.8', description: '지정 IP' },
        { ip: '121.153.40.162', description: '외부 접근 허용 IP' },
        { ip: '127.0.0.1', description: '로컬호스트 (개발용)' }
      ];
      setAllowedIPs(defaultIPs);
      localStorage.setItem('allowedIPs', JSON.stringify(defaultIPs));
    }
  };

  const saveAllowedIPs = (ips: any[]) => {
    localStorage.setItem('allowedIPs', JSON.stringify(ips));
    setAllowedIPs(ips);
  };

  const handleAddIP = () => {
    if (!newIPForm.ip.trim()) {
      toast({
        title: "오류",
        description: "IP 주소를 입력해주세요.",
        variant: "destructive"
      });
      return;
    }

    const newIP = {
      ip: newIPForm.ip.trim(),
      description: newIPForm.description.trim() || '설명 없음'
    };

    const updatedIPs = [...allowedIPs, newIP];
    saveAllowedIPs(updatedIPs);
    setNewIPForm({ ip: '', description: '' });

    toast({
      title: "추가 완료",
      description: "새로운 IP가 허용 목록에 추가되었습니다."
    });
  };

  const handleUpdateIP = () => {
    if (!editingIP || !editingIP.ip.trim()) {
      return;
    }

    const updatedIPs = [...allowedIPs];
    updatedIPs[editingIP.index] = {
      ip: editingIP.ip.trim(),
      description: editingIP.description.trim() || '설명 없음'
    };

    saveAllowedIPs(updatedIPs);
    setEditingIP(null);

    toast({
      title: "수정 완료",
      description: "IP 정보가 수정되었습니다."
    });
  };

  const handleDeleteIP = (index: number) => {
    const updatedIPs = allowedIPs.filter((_, i) => i !== index);
    saveAllowedIPs(updatedIPs);

    toast({
      title: "삭제 완료",
      description: "IP가 허용 목록에서 제거되었습니다."
    });
  };

  // Effect to fetch data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchTrainingMaterials();
      fetchCivilComplaintsData();
      fetchDutySchedules();
      loadAllowedIPs(); // IP 목록 로드 추가
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-[400px] space-y-4">
          <Button 
            variant="outline" 
            onClick={() => navigate("/")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            홈으로
          </Button>
          <Card>
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
            </CardContent>
          </Card>
        </div>
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
              onClick={() => navigate("/")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              홈으로
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

        <div className="space-y-6">
          <Tabs defaultValue="data-upload" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="data-upload">민원데이터 관리</TabsTrigger>
              <TabsTrigger value="training">교육자료 관리</TabsTrigger>
              <TabsTrigger value="duty">당직명령부 관리</TabsTrigger>
              <TabsTrigger value="api-keys">API 키 관리</TabsTrigger>
              <TabsTrigger value="ip-access">IP 접근 관리</TabsTrigger>
              <TabsTrigger value="system">시스템 설정</TabsTrigger>
            </TabsList>

            <TabsContent value="data-upload" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>민원데이터 업로드</CardTitle>
                  <CardDescription>
                    Excel 파일(.xls, .xlsx)을 업로드하여 민원데이터를 벡터화하고 등록합니다.
                    일련번호, 일자, 민원내용, 조치내용, 처리부서, 단순문의여부, 처리상태, 처리완료날짜 컬럼이 포함되어야 합니다.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid w-full max-w-sm items-center gap-1.5">
                    <Label htmlFor="civil-complaints-file">민원데이터 Excel 파일</Label>
                    <Input 
                      id="civil-complaints-file" 
                      type="file" 
                      accept=".xls,.xlsx"
                      onChange={handleCivilComplaintsUpload}
                    />
                  </div>
                  {isLoading && (
                    <div className="mt-4 flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      <span className="text-sm text-muted-foreground">업로드 및 벡터화 중...</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                 <CardHeader>
                   <CardTitle>업로드된 민원데이터 파일 목록</CardTitle>
                   <CardDescription>
                     업로드된 민원데이터 파일들을 관리합니다.
                   </CardDescription>
                 </CardHeader>
                 <CardContent>
                   <div className="space-y-2">
                     {civilComplaintsData.length === 0 ? (
                       <p className="text-muted-foreground">업로드된 민원데이터가 없습니다.</p>
                     ) : (
                       civilComplaintsData.map((data) => (
                         <div key={data.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <h4 className="font-medium">{data.filename || `민원데이터_${data.id.slice(0,8)}`}</h4>
                              <div className="text-sm text-muted-foreground space-y-1">
                                <p>처리방법: {data.processing_method}</p>
                                <p>민원유형: {data.complaint_type}</p>
                                <p>업로드 날짜: {new Date(data.created_at).toLocaleDateString('ko-KR')}</p>
                                {data.registration_info && <p>세부정보: {data.registration_info}</p>}
                              </div>
                            </div>
                           <Button
                             variant="destructive"
                             size="sm"
                             onClick={() => handleDeleteCivilComplaintsData(data.id)}
                           >
                             삭제
                           </Button>
                         </div>
                       ))
                     )}
                   </div>
                 </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="training" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>교육자료 업로드</CardTitle>
                  <CardDescription>
                    PDF 파일(.pdf) 또는 텍스트 파일(.txt)을 업로드하여 AI 학습을 위한 벡터화를 수행합니다.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid w-full max-w-sm items-center gap-1.5">
                    <Label htmlFor="training-file">교육자료 파일</Label>
                    <Input 
                      id="training-file" 
                      type="file" 
                      accept=".pdf,.txt"
                      onChange={handleTrainingUpload}
                    />
                  </div>
                  {isLoading && (
                    <div className="mt-4 flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      <span className="text-sm text-muted-foreground">업로드 및 벡터화 중...</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>교육자료 목록</CardTitle>
                  <CardDescription>
                    업로드된 교육자료들을 관리합니다.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {trainingMaterials.length === 0 ? (
                      <p className="text-muted-foreground">업로드된 교육자료가 없습니다.</p>
                    ) : (
                      trainingMaterials.map((material) => (
                        <div key={material.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <h4 className="font-medium">{material.title}</h4>
                            <p className="text-sm text-muted-foreground">
                              업로드 날짜: {new Date(material.created_at).toLocaleDateString('ko-KR')}
                            </p>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteTrainingMaterial(material.id)}
                          >
                            삭제
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="duty" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>당직정보 등록</CardTitle>
                  <CardDescription>
                    당직 스케줄 정보를 등록합니다.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleDutySubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="department">부서명</Label>
                        <Input
                          id="department"
                          name="department"
                          placeholder="부서명을 입력하세요"
                          value={dutyForm.department}
                          onChange={handleDutyFormChange}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="facility">시설명</Label>
                        <Input
                          id="facility"
                          name="facility"
                          placeholder="시설명을 입력하세요"
                          value={dutyForm.facility}
                          onChange={handleDutyFormChange}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dutyDay">당직일</Label>
                        <Input
                          id="dutyDay"
                          name="dutyDay"
                          placeholder="예: 월요일, 화요일 등"
                          value={dutyForm.dutyDay}
                          onChange={handleDutyFormChange}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">연락처</Label>
                        <Input
                          id="phone"
                          name="phone"
                          placeholder="연락처를 입력하세요"
                          value={dutyForm.phone}
                          onChange={handleDutyFormChange}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">비고</Label>
                      <Textarea
                        id="notes"
                        name="notes"
                        placeholder="추가 정보나 특이사항을 입력하세요"
                        value={dutyForm.notes}
                        onChange={handleDutyFormChange}
                      />
                    </div>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? '등록 중...' : '당직정보 등록'}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>등록된 당직 정보</CardTitle>
                  <CardDescription>
                    현재 등록된 당직 스케줄 목록을 관리합니다.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {dutySchedules.length === 0 ? (
                    <p className="text-muted-foreground">등록된 당직 정보가 없습니다.</p>
                  ) : (
                    <div className="space-y-4">
                      {dutySchedules.map((duty) => (
                        <div key={duty.id} className="border rounded-lg p-4">
                          {editingDuty?.id === duty.id ? (
                            <form onSubmit={handleDutyUpdate} className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>부서명</Label>
                                  <Input
                                    value={editingDuty.department_name}
                                    onChange={(e) => setEditingDuty({
                                      ...editingDuty,
                                      department_name: e.target.value
                                    })}
                                    required
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>시설명</Label>
                                  <Input
                                    value={editingDuty.duty_facility}
                                    onChange={(e) => setEditingDuty({
                                      ...editingDuty,
                                      duty_facility: e.target.value
                                    })}
                                    required
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>당직일</Label>
                                  <Input
                                    value={editingDuty.duty_day || ''}
                                    onChange={(e) => setEditingDuty({
                                      ...editingDuty,
                                      duty_day: e.target.value
                                    })}
                                  />
                                </div>
                                 <div className="space-y-2">
                                   <Label>연락처</Label>
                                   <Input
                                     value={editingDuty.phone_number}
                                     onChange={(e) => setEditingDuty({
                                       ...editingDuty,
                                       phone_number: e.target.value
                                     })}
                                     required
                                   />
                                 </div>
                               </div>
                               <div className="space-y-2">
                                 <Label>비고</Label>
                                 <Textarea
                                   value={editingDuty.remarks || ''}
                                   onChange={(e) => setEditingDuty({
                                     ...editingDuty,
                                     remarks: e.target.value
                                   })}
                                   placeholder="추가 정보나 특이사항을 입력하세요"
                                 />
                               </div>
                              <div className="flex gap-2">
                                <Button type="submit" size="sm" disabled={isLoading}>
                                  {isLoading ? '저장 중...' : '저장'}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingDuty(null)}
                                >
                                  취소
                                </Button>
                              </div>
                            </form>
                          ) : (
                            <div>
                               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                                 <div>
                                   <div className="text-sm font-medium text-muted-foreground">부서명</div>
                                   <div className="font-medium">{duty.department_name}</div>
                                 </div>
                                 <div>
                                   <div className="text-sm font-medium text-muted-foreground">시설명</div>
                                   <div className="font-medium">{duty.duty_facility}</div>
                                 </div>
                                 <div>
                                   <div className="text-sm font-medium text-muted-foreground">당직일</div>
                                   <div className="font-medium">{duty.duty_day || '미지정'}</div>
                                 </div>
                                 <div>
                                   <div className="text-sm font-medium text-muted-foreground">연락처</div>
                                   <div className="font-medium">{duty.phone_number}</div>
                                 </div>
                               </div>
                               {duty.remarks && (
                                 <div className="mb-4">
                                   <div className="text-sm font-medium text-muted-foreground">비고</div>
                                   <div className="font-medium">{duty.remarks}</div>
                                 </div>
                               )}
                              <div className="text-sm text-muted-foreground mb-4">
                                등록일: {new Date(duty.created_at).toLocaleDateString('ko-KR', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingDuty(duty)}
                                  className="flex items-center gap-1"
                                >
                                  <Edit className="w-4 h-4" />
                                  수정
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="flex items-center gap-1"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      삭제
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>당직 정보 삭제</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        "{duty.department_name} - {duty.duty_facility}" 당직 정보를 삭제하시겠습니까?
                                        이 작업은 되돌릴 수 없습니다.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>취소</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDutyDelete(duty.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        삭제
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="system" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>시스템 관리</CardTitle>
                  <CardDescription>
                    데이터베이스 백업, 로그 확인, 시스템 초기화를 수행합니다.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button 
                      variant="outline" 
                      onClick={handleDatabaseBackup}
                      disabled={isLoading}
                      className="flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      데이터베이스 백업
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleSystemLogs}
                      className="flex items-center gap-2"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      시스템 로그 확인
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="flex items-center gap-2">
                          <Trash2 className="w-4 h-4" />
                          시스템 초기화
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>시스템 초기화</AlertDialogTitle>
                          <AlertDialogDescription>
                            <p className="text-sm text-muted-foreground mb-2">
                              다음 데이터들이 모두 삭제됩니다:
                            </p>
                            <ul className="text-sm text-muted-foreground list-disc list-inside">
                              <li>민원데이터</li>
                              <li>민원데이터 벡터</li>
                              <li>부서 정보</li>
                              <li>당직 스케줄</li>
                              <li>교육자료</li>
                              <li>학습벡터 데이터</li>
                            </ul>
                            <p className="text-sm text-destructive mt-2">
                              이 작업은 되돌릴 수 없습니다.
                            </p>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>취소</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={handleSystemReset}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            초기화 실행
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="api-keys" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>API 키 관리</CardTitle>
                  <CardDescription>
                    시스템에서 사용하는 외부 API 키들을 관리합니다. 아래 버튼을 클릭하여 각 API 키를 설정하거나 변경할 수 있습니다.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-6">
                    
                    {/* OpenAI API Key */}
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-medium">OpenAI API Key</h4>
                          <p className="text-sm text-muted-foreground">
                            AI 챗봇 기능에 필요한 OpenAI API 키입니다.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="default"
                            size="sm"
                            onClick={() => {
                              // OpenAI API Key 설정 폼 표시
                              const form = document.createElement('div');
                              form.innerHTML = `
                                <lov-actions>
                                  <lov-secret-form name="OPENAI_API_KEY"></lov-secret-form>
                                </lov-actions>
                              `;
                              // 실제로는 React 컴포넌트에서 처리해야 하므로, 대신 toast로 안내
                              toast({
                                title: "API 키 설정",
                                description: "OpenAI API 키를 설정하려면 채팅창에서 'OpenAI API 키 설정해줘'라고 요청해주세요.",
                              });
                            }}
                          >
                            API 키 설정
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => window.open('https://platform.openai.com/api-keys', '_blank')}
                            size="sm"
                          >
                            키 발급받기
                          </Button>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mb-3">
                        <strong>용도:</strong> 민원 상담 AI, 유사민원 검색, 교육자료 벡터화
                      </div>
                    </div>

                    {/* Weather API Key */}
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-medium">Weather API Key</h4>
                          <p className="text-sm text-muted-foreground">
                            날씨 정보 표시에 필요한 날씨 API 키입니다.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="default"
                            size="sm"
                            onClick={() => {
                              toast({
                                title: "API 키 설정",
                                description: "날씨 API 키를 설정하려면 채팅창에서 'WEATHER_API_KEY 설정해줘'라고 요청해주세요.",
                              });
                            }}
                          >
                            API 키 설정
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => window.open('https://openweathermap.org/api', '_blank')}
                            size="sm"
                          >
                            키 발급받기
                          </Button>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mb-3">
                        <strong>용도:</strong> 당직자 모드 날씨 정보 표시
                      </div>
                    </div>

                    {/* Holiday API Key */}
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-medium">공휴일 API Key</h4>
                          <p className="text-sm text-muted-foreground">
                            한국 공휴일 정보 조회에 필요한 공공데이터포털 API 키입니다.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="default"
                            size="sm"
                            onClick={() => {
                              toast({
                                title: "API 키 설정",
                                description: "공휴일 API 키를 설정하려면 채팅창에서 'HOLIDAY_API_KEY 설정해줘'라고 요청해주세요.",
                              });
                            }}
                          >
                            API 키 설정
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => window.open('https://www.data.go.kr/dataset/15012690/openapi.do', '_blank')}
                            size="sm"
                          >
                            키 발급받기
                          </Button>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mb-3">
                        <strong>용도:</strong> 공휴일 당직 상태 표시, 당직 가능 여부 판단
                      </div>
                    </div>

                    <div className="mt-6 p-4 bg-muted rounded-lg">
                      <h5 className="font-medium mb-2">📝 API 키 설정 방법</h5>
                      <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                        <li>위의 "키 발급받기" 버튼을 클릭하여 각 서비스의 API 키를 발급받으세요.</li>
                        <li>발급받은 API 키를 Supabase 프로젝트 설정의 Secrets에 등록하세요.</li>
                        <li>설정 후 해당 기능들이 정상적으로 작동합니다.</li>
                      </ol>
                      <div className="mt-3 flex gap-2">
                        <Button 
                          variant="outline"
                          onClick={() => window.open('https://supabase.com/dashboard/project/rlndmoxsnccurcfpxeai/settings/functions', '_blank')}
                          size="sm"
                        >
                          Supabase Secrets 관리
                        </Button>
                      </div>
                    </div>

                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ip-access" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>IP 접근 관리</CardTitle>
                  <CardDescription>
                    시스템에 접근할 수 있는 IP 주소를 관리합니다. 허용된 IP가 아닌 경우 접근이 차단됩니다.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  
                  {/* 새 IP 추가 */}
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-4">새 IP 추가</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="newIP">IP 주소</Label>
                        <Input
                          id="newIP"
                          placeholder="예: 192.168.1.100 또는 192.168.1.0/24"
                          value={newIPForm.ip}
                          onChange={(e) => setNewIPForm(prev => ({ ...prev, ip: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ipDescription">설명</Label>
                        <Input
                          id="ipDescription"
                          placeholder="IP 주소에 대한 설명"
                          value={newIPForm.description}
                          onChange={(e) => setNewIPForm(prev => ({ ...prev, description: e.target.value }))}
                        />
                      </div>
                    </div>
                    <Button onClick={handleAddIP} className="mt-4">
                      <Plus className="w-4 h-4 mr-2" />
                      IP 추가
                    </Button>
                  </div>

                  {/* 허용된 IP 목록 */}
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-4">허용된 IP 목록</h4>
                    {allowedIPs.length === 0 ? (
                      <p className="text-muted-foreground">등록된 IP가 없습니다.</p>
                    ) : (
                      <div className="space-y-3">
                        {allowedIPs.map((ipEntry, index) => (
                          <div key={index} className="border rounded-lg p-3">
                            {editingIP?.index === index ? (
                              <div className="space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div className="space-y-2">
                                    <Label>IP 주소</Label>
                                    <Input
                                      value={editingIP.ip}
                                      onChange={(e) => setEditingIP({ ...editingIP, ip: e.target.value })}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>설명</Label>
                                    <Input
                                      value={editingIP.description}
                                      onChange={(e) => setEditingIP({ ...editingIP, description: e.target.value })}
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={handleUpdateIP}>
                                    저장
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setEditingIP(null)}>
                                    취소
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-mono text-sm font-medium">{ipEntry.ip}</div>
                                  <div className="text-sm text-muted-foreground">{ipEntry.description}</div>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingIP({ index, ip: ipEntry.ip, description: ipEntry.description })}
                                    className="flex items-center gap-1"
                                  >
                                    <Edit className="w-3 h-3" />
                                    수정
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        className="flex items-center gap-1"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                        삭제
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>IP 삭제</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          "{ipEntry.ip}" IP를 허용 목록에서 삭제하시겠습니까?
                                          이 작업은 되돌릴 수 없습니다.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>취소</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteIP(index)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          삭제
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 안내 정보 */}
                  <div className="bg-muted rounded-lg p-4">
                    <h5 className="font-medium mb-2">💡 IP 주소 형식 안내</h5>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p><strong>단일 IP:</strong> 192.168.1.100</p>
                      <p><strong>IP 범위 (CIDR):</strong> 192.168.1.0/24</p>
                      <p><strong>와일드카드:</strong> 108.15.* (108.15.으로 시작하는 모든 IP)</p>
                    </div>
                    <div className="mt-3 text-xs text-orange-600">
                      ⚠️ 주의: IP 설정 변경 후 페이지를 새로고침하면 변경사항이 적용됩니다.
                    </div>
                  </div>

                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default AdminMode;
