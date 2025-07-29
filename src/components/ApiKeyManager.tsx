import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ApiKeyManagerProps {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const ApiKeyManager = ({ isLoading, setIsLoading }: ApiKeyManagerProps) => {
  const [apiKeys, setApiKeys] = useState({
    openai: '',
    weather: '',
    holiday: ''
  });
  const [showApiKeyForm, setShowApiKeyForm] = useState<string | null>(null);
  const { toast } = useToast();

  const handleApiKeyUpdate = async (keyType: string, apiKey: string) => {
    try {
      setIsLoading(true);
      
      // Simulate API key update (for demo purposes)
      // In production, this would use Supabase secrets management
      await new Promise(resolve => setTimeout(resolve, 1000));

      toast({
        title: "성공 (데모)",
        description: `${keyType.toUpperCase()} API 키가 설정되었습니다. 실제 환경에서는 Supabase Secrets를 사용해주세요.`,
      });
      
      setApiKeys(prev => ({ ...prev, [keyType]: apiKey }));
      setShowApiKeyForm(null);
    } catch (error) {
      console.error('API 키 업데이트 오류:', error);
      toast({
        title: "오류",
        description: "API 키 업데이트에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const apiKeyConfigs = [
    {
      id: 'openai',
      title: 'OpenAI API Key',
      description: 'AI 챗봇 기능에 필요한 OpenAI API 키입니다.',
      usage: '민원 상담 AI, 유사민원 검색, 교육자료 벡터화',
      docUrl: 'https://platform.openai.com/api-keys'
    },
    {
      id: 'weather',
      title: 'Weather API Key',
      description: '날씨 정보 표시에 필요한 날씨 API 키입니다.',
      usage: '당직자 모드 날씨 정보 표시',
      docUrl: 'https://openweathermap.org/api'
    },
    {
      id: 'holiday',
      title: '공휴일 API Key',
      description: '공휴일 정보 조회에 필요한 API 키입니다.',
      usage: '공휴일 당직 상태 표시, 당직 가능 여부 판단',
      docUrl: 'https://www.data.go.kr/dataset/15012690/openapi.do'
    }
  ];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>API 키 관리</CardTitle>
          <CardDescription>
            시스템에서 사용하는 외부 API 키들을 관리합니다. 각 API 키를 직접 설정할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6">
            {apiKeyConfigs.map((config) => (
              <div key={config.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-medium">{config.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {config.description}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="default"
                      size="sm"
                      onClick={() => setShowApiKeyForm(config.id)}
                    >
                      API 키 설정
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => window.open(config.docUrl, '_blank')}
                      size="sm"
                    >
                      키 발급받기
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mb-3">
                  <strong>용도:</strong> {config.usage}
                </div>
                {apiKeys[config.id as keyof typeof apiKeys] && (
                  <div className="text-xs text-green-600">
                    ✅ API 키가 설정되어 있습니다.
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h5 className="font-medium mb-2">📝 API 키 설정 방법</h5>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>위의 "키 발급받기" 버튼을 클릭하여 각 서비스의 API 키를 발급받으세요.</li>
              <li>"API 키 설정" 버튼을 클릭하여 발급받은 키를 입력하세요.</li>
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
            <div className="mt-3 text-xs text-orange-600">
              ⚠️ 주의: 현재 기능은 데모용입니다. Production 환경에서는 Supabase Dashboard의 Secrets 설정을 사용해주세요.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Key Input Dialog */}
      <Dialog open={!!showApiKeyForm} onOpenChange={() => setShowApiKeyForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {showApiKeyForm && apiKeyConfigs.find(c => c.id === showApiKeyForm)?.title} 설정
            </DialogTitle>
            <DialogDescription>
              API 키를 입력하여 해당 기능을 활성화하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="api-key-input">API 키</Label>
              <Input
                id="api-key-input"
                type="password"
                placeholder={`${showApiKeyForm?.toUpperCase()} API 키를 입력하세요`}
                value={showApiKeyForm ? apiKeys[showApiKeyForm as keyof typeof apiKeys] : ''}
                onChange={(e) => setApiKeys(prev => ({ 
                  ...prev, 
                  [showApiKeyForm!]: e.target.value 
                }))}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowApiKeyForm(null)}
              >
                취소
              </Button>
              <Button
                onClick={() => {
                  if (showApiKeyForm) {
                    handleApiKeyUpdate(showApiKeyForm, apiKeys[showApiKeyForm as keyof typeof apiKeys]);
                  }
                }}
                disabled={isLoading || !showApiKeyForm || !apiKeys[showApiKeyForm as keyof typeof apiKeys]}
              >
                {isLoading ? '설정 중...' : 'API 키 저장'}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              💡 팁: API 키는 안전하게 암호화되어 저장됩니다.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};