import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { SimilarComplaintsButtons } from "@/components/SimilarComplaintsButtons";
import { supabase } from "@/integrations/supabase/client";
import { Phone, MapPin, Calendar, FileText, Send, MessageCircle, ArrowLeft, Shield, Clock, Thermometer, Home, Settings } from "lucide-react";

interface DutySchedule {
  id: string;
  department_name: string;
  duty_facility: string;
  duty_day: string;
  phone_number: string;
  remarks?: string;
}

interface Message {
  id: string;
  type: 'user' | 'system';
  content: string;
  timestamp: Date;
  similarComplaints?: Array<{
    id: string;
    summary: string;
    content: string;
    serialNumber: string;
    department: string;
    status: string;
    date: string;
    similarity: number;
  }>;
}

interface ComplaintType {
  type: string;
  count: number;
  recentComplaint: string;
  similarComplaints?: any[];
}

interface SimilarComplaint {
  id: string;
  content: string;
  title: string;
  similarity: number;
  metadata: any;
}

interface DetailedComplaint {
  id: string;
  title: string;
  content: string;
  similarity: number;
  metadata: any;
}

const DutyMode = () => {
  const [dutySchedules, setDutySchedules] = useState<DutySchedule[]>([]);
  const [selectedDuty, setSelectedDuty] = useState<DutySchedule | null>(null);
  const [holidays, setHolidays] = useState<any[]>([]);
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
  const [includeComplaintCases, setIncludeComplaintCases] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  // 공휴일 데이터 가져오기
  const fetchHolidays = async () => {
    try {
      const today = new Date();
      const { data, error } = await supabase.functions.invoke('holiday-api', {
        body: {
          year: today.getFullYear(),
          month: today.getMonth() + 1
        }
      });

      if (error) throw error;

      if (data && data.holidays) {
        setHolidays(data.holidays);
      }
    } catch (error) {
      console.error('공휴일 정보를 가져오는데 실패했습니다:', error);
    }
  };

  // 오늘이 공휴일인지 확인하는 함수
  const isTodayHoliday = () => {
    const today = new Date();
    const todayStr = today.getFullYear().toString() + 
                     (today.getMonth() + 1).toString().padStart(2, '0') + 
                     today.getDate().toString().padStart(2, '0');
    
    return holidays.some(holiday => holiday.locdate === parseInt(todayStr));
  };

  // 현재 요일과 당직일을 비교해서 통화가능한지 판단하는 함수
  const isDutyAvailable = (dutyDay: string) => {
    const today = new Date();
    const currentDay = today.getDay(); // 0=일요일, 1=월요일, ..., 6=토요일
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const currentDayName = dayNames[currentDay];
    
    if (!dutyDay) return false;
    
    // 매일 근무하는 경우
    if (dutyDay.includes('매일')) return true;
    
    // 현재 요일이 당직일에 포함되는지 확인
    const isCurrentDayIncluded = dutyDay.includes(currentDayName);
    
    // 공휴일 근무 부서인 경우, 실제 공휴일일 때만 활성화
    const hasHolidayDuty = dutyDay.includes('공휴일');
    const isActualHoliday = isTodayHoliday(); // 실제 공휴일 API 사용
    
    return isCurrentDayIncluded || (hasHolidayDuty && isActualHoliday);
  };

  useEffect(() => {
    fetchDutySchedules();
    fetchWeather();
    fetchHolidays(); // 공휴일 데이터 가져오기 추가
    
    
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
          context: `당직 부서 정보: ${context}`,
          includeComplaintCases: includeComplaintCases
        }
      });

      if (error) throw error;

      // 응답에서 유사민원 데이터 처리
      let similarComplaints = [];
      
      if (data.similarComplaints && data.similarComplaints.length > 0) {
        similarComplaints = data.similarComplaints.map((complaint: any, index: number) => ({
          id: complaint.id || `complaint-${index}`,
          summary: complaint.content ? complaint.content.substring(0, 80) + '...' : '내용 없음',
          content: complaint.content || '상세 내용이 없습니다.',
          serialNumber: complaint.metadata?.serialNumber || '정보없음',
          department: complaint.metadata?.department || '정보없음',
          status: complaint.metadata?.status || '정보없음',
          date: complaint.metadata?.date || '정보없음',
          similarity: (complaint.similarity * 100) || 0
        }));
      }

      const systemMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'system',
        content: data.reply,
        timestamp: new Date(),
        similarComplaints: similarComplaints.length > 0 ? similarComplaints : undefined
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

  const generateComplaintText = async () => {
    if (!complaintForm.type || !complaintForm.location || !complaintForm.description) {
      toast({
        title: "입력 오류",
        description: "모든 필수 항목을 입력해주세요.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      // AI로 민원서식을 정리
      const { data, error } = await supabase.functions.invoke('format-complaint', {
        body: {
          type: complaintForm.type,
          location: complaintForm.location,
          reporter: complaintForm.reporter,
          description: complaintForm.description
        }
      });

      if (error) {
        throw error;
      }

      const finalText = `【민원 등록서】

접수일시: ${currentDateTime}

${data.formattedText}

※ 본 민원은 당직근무 지원 시스템을 통해 자동 생성되었습니다.`;

      navigator.clipboard.writeText(finalText).then(() => {
        toast({
          title: "AI 정리 완료 ✨",
          description: "깔끔하게 정리된 민원 등록 문구가 클립보드에 복사되었습니다."
        });
      });

      // Reset form
      setComplaintForm({
        type: '',
        location: '',
        description: '',
        reporter: ''
      });

    } catch (error) {
      console.error('민원서식 생성 오류:', error);
      
      // AI 처리 실패시 기본 형식으로 복사
      const basicText = `【민원 등록서】

접수일시: ${currentDateTime}
민원유형: ${complaintForm.type}
발생장소: ${complaintForm.location}
신고자: ${complaintForm.reporter || '익명'}

민원내용:
${complaintForm.description}

※ 본 민원은 당직근무 지원 시스템을 통해 자동 생성되었습니다.`;

      navigator.clipboard.writeText(basicText).then(() => {
        toast({
          title: "복사 완료",
          description: "민원 등록 문구가 클립보드에 복사되었습니다.",
          variant: "default"
        });
      });

      // Reset form
      setComplaintForm({
        type: '',
        location: '',
        description: '',
        reporter: ''
      });
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      {/* Header */}
      <div className="border-b bg-card/80 backdrop-blur-sm shadow-sm p-4">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={() => navigate("/")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              홈으로
            </Button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <span>🏢</span>
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                당직근무 지원 시스템 - 당직자 모드
              </span>
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
              variant="default"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
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
          <Card className="h-full rounded-3xl shadow-large bg-gradient-card border-0 overflow-hidden animate-fade-in">
            <CardHeader className="bg-gradient-secondary rounded-t-3xl">
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="bg-primary/20 rounded-xl p-2">
                  <Phone className="w-5 h-5 text-primary" />
                </div>
                부서별 당직 현황
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                부서를 더블클릭하면 상세정보를 확인할 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-280px)]">
                <div className="space-y-3 p-6">
                  {dutySchedules.map((duty, index) => {
                    const isAvailable = isDutyAvailable(duty.duty_day);
                    return (
                      <div
                        key={duty.id}
                        className="p-4 border rounded-2xl cursor-pointer hover:bg-accent transition-all duration-300 hover:scale-105 hover:shadow-soft animate-slide-in group"
                        style={{ animationDelay: `${index * 0.1}s` }}
                        onDoubleClick={() => setSelectedDuty(duty)}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="font-medium text-foreground group-hover:text-primary transition-colors">
                            {duty.department_name}
                          </div>
                          <div className={`w-4 h-4 rounded-full transition-all duration-300 ${
                            isAvailable ? 'bg-primary shadow-soft' : 'bg-destructive'
                          }`} />
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2 mt-2">
                          <Calendar className="w-3 h-3" />
                          <span>{duty.duty_day}</span>
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                          <Phone className="w-3 h-3" />
                          <span>{duty.phone_number}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Center - Chat Interface */}
        <div className={`flex-1 ${showComplaintForm ? 'mr-4' : ''}`}>
          <Card className="h-full flex flex-col rounded-3xl shadow-large bg-gradient-card border-0 overflow-hidden animate-fade-in">
            <CardHeader className="bg-gradient-secondary rounded-t-3xl flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="bg-primary/20 rounded-xl p-2">
                      <MessageCircle className="w-6 h-6 text-primary" />
                    </div>
                    🤖 AI 민원 상담
                  </CardTitle>
                  <CardDescription className="text-base mt-2">
                    민원 종류를 입력하시면 AI가 처리 방법과 등록 정보를 안내해드립니다.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3 bg-white/50 rounded-2xl p-3 backdrop-blur-sm">
                  <label htmlFor="complaint-cases-toggle" className="text-sm font-medium text-foreground">
                    유사민원 참고하기
                  </label>
                  <Switch
                    id="complaint-cases-toggle"
                    checked={includeComplaintCases}
                    onCheckedChange={setIncludeComplaintCases}
                  />
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="flex-1 flex flex-col p-0 min-h-0">
              <ScrollArea className="flex-1 p-6">
                <div className="space-y-4">
                  {chatMessages.map((message, index) => (
                    <div
                      key={message.id}
                      className={`flex animate-slide-in ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div
                        className={`max-w-[80%] p-4 rounded-2xl shadow-soft ${
                          message.type === 'user'
                            ? 'bg-gradient-primary text-white'
                            : 'bg-white border border-border'
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{message.content}</div>
                        {message.type === 'system' && message.similarComplaints && (
                          <SimilarComplaintsButtons complaints={message.similarComplaints} />
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
            <Card className="h-full rounded-3xl shadow-large bg-gradient-card border-0 overflow-hidden animate-fade-in">
              <CardHeader className="bg-gradient-secondary rounded-t-3xl flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-3">
                    <div className="bg-primary/20 rounded-xl p-2">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    민원 등록 서식
                  </CardTitle>
                  <CardDescription className="mt-2">
                    간단한 정보 입력으로 정리된 민원 문구를 생성합니다.
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowComplaintForm(false)}
                  className="h-10 w-10 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-all duration-300"
                >
                  ✕
                </Button>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                <div className="space-y-3">
                  <Label htmlFor="complaint-type" className="text-sm font-medium text-foreground">민원 유형</Label>
                  <Input
                    id="complaint-type"
                    placeholder="예: 정전 민원"
                    value={complaintForm.type}
                    onChange={(e) => setComplaintForm(prev => ({ ...prev, type: e.target.value }))}
                    className="rounded-2xl border-2 border-border/50 focus:border-primary bg-white shadow-soft px-4 py-3"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="complaint-location" className="text-sm font-medium text-foreground">발생 장소</Label>
                  <Input
                    id="complaint-location"
                    placeholder="예: 당진시청"
                    value={complaintForm.location}
                    onChange={(e) => setComplaintForm(prev => ({ ...prev, location: e.target.value }))}
                    className="rounded-2xl border-2 border-border/50 focus:border-primary bg-white shadow-soft px-4 py-3"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="complaint-phone" className="text-sm font-medium text-foreground">신고자 번호</Label>
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
                  disabled={!complaintForm.type || !complaintForm.location || isLoading}
                  className="w-full rounded-2xl bg-gradient-primary hover:bg-primary-hover text-white py-3 shadow-soft transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      AI가 정리 중...
                    </div>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      ✨ AI로 민원 문구 정리하기
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedDuty} onOpenChange={() => setSelectedDuty(null)}>
        <DialogContent className="rounded-3xl shadow-large border-0 bg-gradient-card">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-3">
              <div className="bg-primary/20 rounded-xl p-2">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              당직 상세 정보
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {selectedDuty?.department_name} 당직 정보
            </DialogDescription>
          </DialogHeader>
          {selectedDuty && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white/50 rounded-2xl p-4 backdrop-blur-sm">
                  <Label className="text-sm font-medium text-muted-foreground">부서명</Label>
                  <div className="font-medium text-foreground mt-1">{selectedDuty.department_name}</div>
                </div>
                <div className="bg-white/50 rounded-2xl p-4 backdrop-blur-sm">
                  <Label className="text-sm font-medium text-muted-foreground">근무시설</Label>
                  <div className="font-medium text-foreground mt-1">{selectedDuty.duty_facility}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white/50 rounded-2xl p-4 backdrop-blur-sm">
                  <Label className="text-sm font-medium text-muted-foreground">근무요일</Label>
                  <div className="font-medium text-foreground mt-1">{selectedDuty.duty_day}</div>
                </div>
                <div className="bg-white/50 rounded-2xl p-4 backdrop-blur-sm">
                  <Label className="text-sm font-medium text-muted-foreground">전화번호</Label>
                  <div className="font-medium text-foreground mt-1">{selectedDuty.phone_number}</div>
                </div>
              </div>
              <div className="bg-white/50 rounded-2xl p-4 backdrop-blur-sm">
                <Label className="text-sm font-medium text-muted-foreground">비고</Label>
                <div className="mt-2 p-3 bg-muted/50 rounded-xl">
                  {selectedDuty.remarks || '등록된 비고 사항이 없습니다.'}
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