import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { year, month } = await req.json();
    
    // 공공데이터포털 한국천문연구원 특일정보 API 호출
    const serviceKey = Deno.env.get('HOLIDAY_API_KEY');
    if (!serviceKey) {
      throw new Error('HOLIDAY_API_KEY is not set');
    }

    const apiUrl = `http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo`;
    const params = new URLSearchParams({
      serviceKey: serviceKey,
      solYear: year.toString(),
      solMonth: month.toString().padStart(2, '0'),
      _type: 'json'
    });

    console.log(`공휴일 API 호출: ${year}년 ${month}월`);

    const response = await fetch(`${apiUrl}?${params}`);
    
    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`);
    }

    const data = await response.json();
    
    // API 응답 파싱
    let holidays = [];
    if (data.response && data.response.body && data.response.body.items) {
      const items = data.response.body.items.item;
      if (Array.isArray(items)) {
        holidays = items;
      } else if (items) {
        holidays = [items];
      }
    }

    console.log(`공휴일 ${holidays.length}개 조회됨`);

    return new Response(JSON.stringify({ 
      success: true,
      holidays: holidays,
      year: year,
      month: month
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('공휴일 API 오류:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      holidays: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});