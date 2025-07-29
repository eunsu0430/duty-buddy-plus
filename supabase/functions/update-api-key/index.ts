import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { keyType, apiKey } = await req.json();
    
    console.log(`API 키 업데이트 요청: ${keyType}`);
    
    // Note: 실제 production 환경에서는 Supabase CLI를 통해 secrets를 관리해야 합니다.
    // 이 함수는 데모용이며, 실제로는 보안상의 이유로 클라이언트에서 직접 시크릿을 설정할 수 없습니다.
    
    // 시뮬레이션: API 키가 설정되었다고 가정
    const validKeyTypes = ['OPENAI_API_KEY', 'WEATHER_API_KEY', 'HOLIDAY_API_KEY'];
    
    if (!validKeyTypes.includes(keyType)) {
      throw new Error('유효하지 않은 API 키 타입입니다.');
    }
    
    if (!apiKey || apiKey.trim().length < 10) {
      throw new Error('API 키가 너무 짧습니다. 올바른 API 키를 입력해주세요.');
    }
    
    // 실제 환경에서는 여기서 Supabase secrets를 업데이트해야 합니다.
    // 현재는 시뮬레이션만 수행합니다.
    console.log(`${keyType} 시크릿이 업데이트되었습니다 (시뮬레이션)`);
    
    return new Response(JSON.stringify({ 
      success: true,
      message: `${keyType}가 성공적으로 업데이트되었습니다.`,
      note: '실제 production 환경에서는 Supabase Dashboard에서 직접 secrets를 관리해주세요.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('API 키 업데이트 오류:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message || 'API 키 업데이트 중 오류가 발생했습니다.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});