import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('7월 빈발 민원 데이터 분석 실행');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    // 7월 데이터 분석 및 삽입 (기존 데이터 덮어쓰기)
    const response = await supabaseClient.functions.invoke('analyze-monthly-complaints', {
      body: {
        year: 2025,
        month: 7
      }
    });

    const result = await response.json();
    console.log('7월 데이터 분석 결과:', result);

    return new Response(JSON.stringify({ 
      success: true, 
      message: '7월 빈발 민원 데이터 분석이 완료되었습니다.',
      result: result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('7월 데이터 분석 오류:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || '7월 데이터 분석 중 오류가 발생했습니다.' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});