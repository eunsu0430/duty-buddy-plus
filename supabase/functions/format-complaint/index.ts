import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, location, reporter, description } = await req.json();
    
    console.log('민원서식 정리 요청:', { type, location, reporter, description });

    const systemPrompt = `당신은 행정업무 전문 담당자로서 민원등록서식을 작성합니다. 제공된 정보를 기반으로 공문서식에 적합한 전문 용어와 표현을 사용하여 정확하고 간결한 민원서를 작성하세요.

작성 지침:
1. 제공된 정보만 활용하며 추가 내용이나 추측 금지
2. 공문서식 전문 용어 사용 (시설물 → 공공시설물, 문제 → 사안, 고장 → 기능장애 등)
3. 상세내용은 핵심사항만 담아 한 줄로 간결하게 작성
4. 정확한 행정용어로 객관적이고 명료하게 표현
5. 불필요한 경어나 복잡한 표현 배제

서식 양식:
[민원 유형]: [제공된 유형]
[발생 장소]: [제공된 장소]  
[신고자]: [제공된 연락처]

[민원 내용]
[핵심사안을 행정전문용어로 간결하게 한 줄 정리]

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `민원 유형: ${type}\n발생 장소: ${location}\n신고자 번호: ${reporter}\n상세 내용: ${description}`
          }
        ],
        temperature: 0.1,
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API 오류: ${response.status}`);
    }

    const data = await response.json();
    const formattedText = data.choices[0].message.content;

    console.log('AI 정리 완료');

    return new Response(JSON.stringify({ 
      formattedText
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('민원서식 정리 오류:', error);
    return new Response(JSON.stringify({ 
      error: '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});