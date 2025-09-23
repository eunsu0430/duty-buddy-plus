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

    const systemPrompt = `당신은 민원등록서식 전문 작성자입니다. 사용자가 제공한 정보만을 사용해서 간단하고 공무원 공문체 단어들로 민원등록서식을 작성해주세요.

중요 규칙:
1. 사용자가 제공하지 않은 정보는 절대 추가하지 마세요
2. 추측하거나 가정하지 마세요
3. 상세내용은 한 줄로 간단명료하게 작성하세요
4. "알려드리오니", "요청하옵니다", "하옵기" 같은 복잡한 표현은 사용하지 마세요
5. 다음 형식으로 작성하세요:

[민원 유형]: [사용자가 제공한 유형]
[발생 장소]: [사용자가 제공한 장소]
[신고자]: [사용자가 제공한 연락처]

[민원 내용]
[사용자가 제공한 상세내용을 한 줄로 간단히 정리]

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