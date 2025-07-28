import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Phone, MapPin, Calendar, FileText, Send, MessageCircle, ArrowLeft } from "lucide-react";

interface DutySchedule {
  id: string;
  department_name: string;
  duty_facility: string;
  duty_day: string;
  phone_number: string;
  notes?: string;
}

interface Message {
  id: string;
  type: 'user' | 'system';
  content: string;
  timestamp: Date;
  similarCases?: SimilarCase[];
}

interface SimilarCase {
  id: number;
  summary: string;
  fullContent: string;
  serialNumber: string;
  department: string;
  status: string;
  date: string;
  similarity: number;
}

const DutyMode = () => {
  const [dutySchedules, setDutySchedules] = useState<DutySchedule[]>([]);
  const [selectedDuty, setSelectedDuty] = useState<DutySchedule | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'system',
      content: '안녕하세요! 당직근무 지원 시스템입니다. 민원 종류를 입력하시면 AI가 처리 방법과 등록 정보를 안내해드리겠습니다.',
      timestamp: new Date()
    }
  ]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [complaintForm, setComplaintForm] = useState({
    type: '',
    location: '',
    description: '',
    reporter: ''
  });
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [weather, setWeather] = useState({ temperature: 22, description: '맑음' });
  const [isLoading, setIsLoading] = useState(false);
  const [showComplaintForm, setShowComplaintForm] = useState(false);
  const [selectedCase, setSelectedCase] = useState<SimilarCase | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDutySchedules();
    fetchWeather();
    
    // Update time every minute
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 60000);

    // Update weather every 10 minutes
    const weatherTimer = setInterval(fetchWeather, 600000);

    return () => {
      clearInterval(timer);
      clearInterval(weatherTimer);
    };
  }, []);

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

  const fetchDutySchedules = async () => {
    const { data, error } = await supabase
      .from('duty_schedule')
      .select('*')
      .order('duty_day', { ascending: true });

    if (error) {
      toast({
        title: "데이터 로딩 실패",
        description: "당직 정보를 불러오는데 실패했습니다.",
        variant: "destructive"
      });
    } else {
      setDutySchedules(data || []);
    }
  };

  const handleSendMessage = async () => {
    if (!currentMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: currentMessage,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Get context from duty schedules for better AI responses
      const context = dutySchedules.map(duty => 
        `${duty.department_name}: ${duty.phone_number} (${duty.duty_facility})`
      ).join(', ');

      const { data, error } = await supabase.functions.invoke('chat-bot', {
        body: { 
          message: currentMessage,
          context: `당직 부서 정보: ${context}`
        }
      });

      if (error) throw error;

      const systemMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'system',
        content: data.reply,
        timestamp: new Date(),
        similarCases: data.similarCases || []
      };
      
      setChatMessages(prev => [...prev, systemMessage]);
    } catch (error) {
      console.error('AI 응답 오류:', error);
      
      // Fallback to local response
      const fallbackResponse = generateSystemResponse(currentMessage);
      const systemMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'system',
        content: fallbackResponse,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, systemMessage]);
      
      toast({
        title: "AI 연결 오류",
        description: "기본 응답으로 처리되었습니다. 인터넷 연결을 확인해주세요.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }

    setCurrentMessage('');
  };

  const generateSystemResponse = (userInput: string): string => {
    const input = userInput.toLowerCase();
    
    if (input.includes('소음') || input.includes('층간소음')) {
      return `🔊 소음 민원 처리 방법:
1. 현장 확인 및 소음 측정
2. 당사자 면담 실시
3. 소음 저감 방안 협의
4. 필요시 환경부 신고 안내

📋 등록 정보:
- 민원 유형: 소음 민원
- 처리 담당: 환경관리과
- 예상 처리 기간: 3-5일
- 관련 법령: 소음진동관리법`;
    }
    
    if (input.includes('쓰레기') || input.includes('환경')) {
      return `🗑️ 환경/쓰레기 민원 처리 방법:
1. 현장 확인 및 사진 촬영
2. 책임자 확인 및 연락
3. 정리 일정 협의
4. 재발 방지 대책 논의

📋 등록 정보:
- 민원 유형: 환경 민원
- 처리 담당: 환경위생과
- 예상 처리 기간: 1-3일
- 관련 법령: 폐기물관리법`;
    }
    
    if (input.includes('시설') || input.includes('수리') || input.includes('고장')) {
      return `🔧 시설 관련 민원 처리 방법:
1. 현장 점검 및 고장 원인 파악
2. 수리 업체 연락 및 일정 조율
3. 임시 조치 방안 마련
4. 수리 완료 후 재점검

📋 등록 정보:
- 민원 유형: 시설 민원
- 처리 담당: 시설관리과
- 예상 처리 기간: 1-7일
- 긴급도: 높음`;
    }

    return `📝 일반 민원 처리 방법:
1. 민원 내용 상세 확인
2. 관련 부서 연계
3. 처리 방안 검토
4. 결과 통보

담당 부서 연락처를 확인하여 신속한 처리를 도와드리겠습니다.`;
  };

  const generateComplaintText = () => {
    if (!complaintForm.type || !complaintForm.location || !complaintForm.description) {
      toast({
        title: "입력 오류",
        description: "모든 필수 항목을 입력해주세요.",
        variant: "destructive"
      });
      return;
    }

    const complaintText = `【민원 등록서】

접수일시: ${currentDateTime.toLocaleString('ko-KR')}
민원유형: ${complaintForm.type}
발생장소: ${complaintForm.location}
신고자: ${complaintForm.reporter || '익명'}

민원내용:
${complaintForm.description}

처리요청사항:
- 현장 확인 및 신속한 처리
- 처리 결과 회신 요청
- 재발 방지 대책 수립

※ 본 민원은 당직근무 지원 시스템을 통해 자동 생성되었습니다.`;

    navigator.clipboard.writeText(complaintText).then(() => {
      toast({
        title: "복사 완료",
        description: "민원 등록 문구가 클립보드에 복사되었습니다."
      });
    });

    // Reset form
    setComplaintForm({
      type: '',
      location: '',
      description: '',
      reporter: ''
    });
  };

  return (
    <div className="h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      {/* Header */}
      <div className="border-b bg-card/80 backdrop-blur-sm shadow-sm p-4">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={() => navigate(-1)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              뒤로가기
            </Button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              🏢 당직근무 지원 시스템 - 당직자 모드
            </h1>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{currentDateTime.toLocaleDateString('ko-KR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                weekday: 'long'
              })}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>🌤️ 당진시 {weather.description} {weather.temperature}°C</span>
            </div>
            <Button
              onClick={() => setShowComplaintForm(!showComplaintForm)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              민원등록서식
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 p-4 max-w-7xl mx-auto w-full h-[calc(100vh-112px)]">
        {/* Left Sidebar - Department List (Fixed) */}
        <div className="w-80 flex-shrink-0">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                부서별 당직 현황
              </CardTitle>
              <CardDescription>
                부서를 더블클릭하면 상세정보를 확인할 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-280px)]">
                <div className="space-y-2 p-4">
                  {dutySchedules.map((duty) => (
                    <div
                      key={duty.id}
                      className="p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                      onDoubleClick={() => setSelectedDuty(duty)}
                    >
                      <div className="font-medium">{duty.department_name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                        <Calendar className="w-3 h-3" />
                        {duty.duty_day}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Phone className="w-3 h-3" />
                        {duty.phone_number}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Center - Chat Interface */}
        <div className={`flex-1 ${showComplaintForm ? 'mr-4' : ''}`}>
          <Card className="h-full flex flex-col shadow-lg">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-xl">
                <MessageCircle className="w-6 h-6 text-primary" />
                🤖 AI 민원 상담
              </CardTitle>
              <CardDescription className="text-base">
                민원 종류를 입력하시면 AI가 처리 방법과 등록 정보를 안내해드립니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0 min-h-0">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {chatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          message.type === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{message.content}</div>
                        
                        {/* 유사민원 버튼들 */}
                        {message.type === 'system' && message.similarCases && message.similarCases.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <div className="text-sm font-medium text-primary">📋 유사민원 사례</div>
                            <div className="grid gap-2">
                              {message.similarCases.map((similarCase) => (
                                <Button
                                  key={similarCase.id}
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedCase(similarCase)}
                                  className="justify-start text-left h-auto p-3 hover:bg-accent/50"
                                >
                                  <div className="space-y-1">
                                    <div className="font-medium text-sm">
                                      사례 {similarCase.id}: {similarCase.summary}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {similarCase.department} • 유사도 {similarCase.similarity}%
                                    </div>
                                  </div>
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="text-xs opacity-70 mt-1">
                          {message.timestamp.toLocaleTimeString('ko-KR')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="border-t bg-card p-4 flex-shrink-0">
                <div className="flex gap-3">
                  <Input
                    placeholder="🗣️ 민원 종류나 상황을 자세히 입력하세요... (예: 아파트 101동에서 밤 11시부터 계속 층간소음이 발생하고 있습니다)"
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
                    disabled={isLoading}
                    className="text-base h-12"
                  />
                  <Button 
                    onClick={handleSendMessage} 
                    disabled={isLoading}
                    className="h-12 px-6 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary"
                  >
                    {isLoading ? (
                      <div className="animate-spin w-5 h-5 border-2 border-current border-t-transparent rounded-full" />
                    ) : (
                      <>
                        <Send className="w-5 h-5 mr-1" />
                        전송
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar - Complaint Form Toggle */}
        {showComplaintForm && (
          <div className="w-80 flex-shrink-0">
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    민원 등록 서식
                  </CardTitle>
                  <CardDescription>
                    간단한 정보 입력으로 정리된 민원 문구를 생성합니다.
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowComplaintForm(false)}
                  className="h-8 w-8 p-0"
                >
                  ✕
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="complaint-type">민원 유형</Label>
                  <Input
                    id="complaint-type"
                    placeholder="예: 정전 민원"
                    value={complaintForm.type}
                    onChange={(e) => setComplaintForm(prev => ({ ...prev, type: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="complaint-location">발생 장소</Label>
                  <Input
                    id="complaint-location"
                    placeholder="예: 당진시청"
                    value={complaintForm.location}
                    onChange={(e) => setComplaintForm(prev => ({ ...prev, location: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="complaint-phone">신고자 번호</Label>
                  <Input
                    id="complaint-phone"
                    placeholder="010-1234-5678"
                    value={complaintForm.reporter}
                    onChange={(e) => setComplaintForm(prev => ({ ...prev, reporter: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="complaint-description">상세 내용</Label>
                  <Textarea
                    id="complaint-description"
                    placeholder="당진시청 2층 세무과 사무실에 오전 9시부터 정전이 발생하여 업무에 지장이 있습니다. 빠른 조치 부탁드립니다."
                    rows={4}
                    value={complaintForm.description}
                    onChange={(e) => setComplaintForm(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <Button 
                  onClick={generateComplaintText} 
                  className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  📋 민원 등록 문구 생성
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedDuty} onOpenChange={() => setSelectedDuty(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>당직 상세 정보</DialogTitle>
            <DialogDescription>
              {selectedDuty?.department_name} 당직 정보
            </DialogDescription>
          </DialogHeader>
          {selectedDuty && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>부서명</Label>
                  <div className="font-medium">{selectedDuty.department_name}</div>
                </div>
                <div>
                  <Label>근무시설</Label>
                  <div className="font-medium">{selectedDuty.duty_facility}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>근무요일</Label>
                  <div className="font-medium">
                    {selectedDuty.duty_day}
                  </div>
                </div>
                <div>
                  <Label>전화번호</Label>
                  <div className="font-medium">{selectedDuty.phone_number}</div>
                </div>
              </div>
              {selectedDuty.notes && (
                <div>
                  <Label>비고</Label>
                  <div className="mt-1 p-2 bg-muted rounded">{selectedDuty.notes}</div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Similar Case Detail Dialog */}
      <Dialog open={!!selectedCase} onOpenChange={() => setSelectedCase(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              유사민원 상세 정보
            </DialogTitle>
            <DialogDescription>
              선택하신 유사민원의 상세 내용입니다.
            </DialogDescription>
          </DialogHeader>
          {selectedCase && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">민원번호</Label>
                  <div className="text-lg font-mono">{selectedCase.serialNumber}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium">처리 부서</Label>
                  <div>{selectedCase.department}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">처리 상태</Label>
                  <div className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                    selectedCase.status === '완료' || selectedCase.status === '처리완료' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {selectedCase.status}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">처리 날짜</Label>
                  <div>{selectedCase.date}</div>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">유사도</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full" 
                      style={{ width: `${selectedCase.similarity}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium">{selectedCase.similarity}%</span>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">민원 내용</Label>
                <div className="mt-2 p-4 bg-muted rounded-lg max-h-60 overflow-y-auto">
                  <div className="whitespace-pre-wrap text-sm">
                    {selectedCase.fullContent}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DutyMode;