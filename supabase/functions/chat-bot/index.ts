import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

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
    const { message, context } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    console.log('Chat request received:', { message, context });

    // Search for relevant training materials
    const { data: trainingData, error: searchError } = await supabaseClient
      .from('training_materials')
      .select('content, title')
      .ilike('content', `%${message}%`)
      .limit(3);

    let trainingContext = '';
    if (trainingData && trainingData.length > 0) {
      trainingContext = `\n\n관련 교육자료:\n${trainingData.map(item => 
        `- ${item.title}: ${item.content.substring(0, 200)}...`
      ).join('\n')}`;
    }

    const systemPrompt = `당신은 당직근무 지원 시스템의 AI 상담원입니다. 
민원 처리 방법을 안내하고, 필요한 경우 담당 부서나 연락처를 알려주세요.
간결하고 정확한 답변을 제공하며, 민원 등록에 필요한 정보를 정리해주세요.

현재 당직 부서 정보: ${context || '없음'}
${trainingContext}

교육자료에 관련 정보가 있으면 그것을 바탕으로 답변하고, 없으면 일반적인 처리방법을 안내하세요.
만약 질문이 업무와 관련이 없거나 답변할 수 없는 내용이면 "죄송하지만 해당 내용에 대해서는 안내드릴 수 없습니다. 업무 관련 민원이나 당직 업무에 대해 질문해주세요."라고 답변하세요.`;

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
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const reply = data.choices[0].message.content;

    console.log('AI response generated successfully');

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in chat-bot function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});