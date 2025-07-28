import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

export default function AdminMode() {
  const [isUploading, setIsUploading] = useState(false);
  const [trainingTitle, setTrainingTitle] = useState('');
  const [trainingFile, setTrainingFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleTrainingUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!trainingFile || !trainingTitle.trim()) {
      toast({
        title: "오류",
        description: "제목과 파일을 모두 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    
    try {
      let content = '';
      
      if (trainingFile.type === 'application/pdf' || trainingFile.name.endsWith('.pdf')) {
        // PDF 파일의 경우 ArrayBuffer로 읽기
        const arrayBuffer = await trainingFile.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        content = Array.from(uint8Array).map(byte => String.fromCharCode(byte)).join('');
      } else {
        // 텍스트 파일의 경우 기존 방식 사용
        content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsText(trainingFile);
        });
      }

      const { data, error } = await supabase.functions.invoke('vectorize-content', {
        body: {
          content,
          metadata: {
            title: trainingTitle,
            filename: trainingFile.name,
            type: trainingFile.type,
            uploadedAt: new Date().toISOString()
          }
        }
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        toast({
          title: "성공",
          description: "교육자료가 성공적으로 업로드되었습니다.",
        });
        setTrainingTitle('');
        setTrainingFile(null);
        // 파일 입력 초기화
        const fileInput = document.getElementById('training-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        throw new Error(data.error || '업로드 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('교육자료 업로드 오류:', error);
      toast({
        title: "오류",
        description: error instanceof Error ? error.message : "교육자료 업로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const [complaintText, setComplaintText] = useState('');
  const [complaintResult, setComplaintResult] = useState('');

  const handleComplaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!complaintText.trim()) {
      toast({
        title: "오류",
        description: "민원 내용을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    
    try {
      // 여기에 민원 처리 로직을 추가 (예: OpenAI API 호출)
      setComplaintResult('민원 처리 결과: ' + complaintText); // 임시 결과 설정
      toast({
        title: "성공",
        description: "민원이 성공적으로 처리되었습니다.",
      });
      setComplaintText('');
    } catch (error) {
      console.error('민원 처리 오류:', error);
      toast({
        title: "오류",
        description: error instanceof Error ? error.message : "민원 처리 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };
  const [complaintFile, setComplaintFile] = useState<File | null>(null);

  const handleComplaintUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!complaintFile) {
      toast({
        title: "오류",
        description: "파일을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    
    try {
      const arrayBuffer = await complaintFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const { data, error } = await supabase.functions.invoke('vectorize-civil-complaints', {
        body: {
          complaints: jsonData,
          filename: complaintFile.name
        }
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        toast({
          title: "성공",
          description: `${data.processed}개의 민원이 성공적으로 업로드되었습니다.`,
        });
        setComplaintFile(null);
        const fileInput = document.getElementById('complaint-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        throw new Error(data.error || '업로드 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('민원 업로드 오류:', error);
      toast({
        title: "오류",
        description: error instanceof Error ? error.message : "민원 업로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">관리자 모드</h1>
          <p className="text-gray-600">당직근무 지원 시스템 관리</p>
        </div>

        <Tabs defaultValue="training" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="training">교육자료 업로드</TabsTrigger>
            <TabsTrigger value="complaints">민원 데이터 업로드</TabsTrigger>
          </TabsList>

          <TabsContent value="training">
            <Card>
              <CardHeader>
                <CardTitle>교육자료 업로드</CardTitle>
                <CardDescription>
                  PDF 파일 또는 텍스트 파일을 업로드하여 당직근무 교육자료로 활용할 수 있습니다.
                  PDF 파일의 경우 GPT-4o-mini가 텍스트를 추출하여 학습합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleTrainingUpload} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="training-title">제목</Label>
                    <Input
                      id="training-title"
                      type="text"
                      value={trainingTitle}
                      onChange={(e) => setTrainingTitle(e.target.value)}
                      placeholder="교육자료 제목을 입력하세요"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="training-file">파일 선택</Label>
                    <Input
                      id="training-file"
                      type="file"
                      accept=".pdf,.txt"
                      onChange={(e) => setTrainingFile(e.target.files?.[0] || null)}
                      required
                    />
                  </div>
                  
                  <Button type="submit" disabled={isUploading} className="w-full">
                    {isUploading ? '업로드 중...' : '교육자료 업로드'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="complaints">
            <Card>
              <CardHeader>
                <CardTitle>민원 데이터 업로드</CardTitle>
                <CardDescription>
                  엑셀 파일로 민원 데이터를 업로드하여 AI 학습에 활용할 수 있습니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleComplaintUpload} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="complaint-file">엑셀 파일 선택</Label>
                    <Input
                      id="complaint-file"
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(e) => setComplaintFile(e.target.files?.[0] || null)}
                      required
                    />
                  </div>
                  
                  <Button type="submit" disabled={isUploading} className="w-full">
                    {isUploading ? '업로드 중...' : '민원 데이터 업로드'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
