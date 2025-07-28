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

    // Generate embedding for user message
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: message
      }),
    });

    let trainingContext = '';
    
    if (embeddingResponse.ok) {
      const embeddingData = await embeddingResponse.json();
      const queryVector = embeddingData.data[0].embedding;
      
      // Search for similar vectors in training data
      const { data: trainingData } = await supabaseClient
        .from('training_vectors')
        .select('content, title')
        .limit(5);

      if (trainingData && trainingData.length > 0) {
        // Simple similarity calculation (for demo - in production, use pgvector)
        const relevantData = trainingData.filter(item => 
          item.content.toLowerCase().includes(message.toLowerCase()) ||
          message.toLowerCase().includes(item.title.toLowerCase())
        );
        
        if (relevantData.length > 0) {
          trainingContext = '\n\n관련 교육자료:\n' + relevantData.map(item => 
            `[${item.title}]: ${item.content.substring(0, 300)}...`
          ).join('\n\n');
        }
      }
    }

    // If no relevant training data found, provide default response
    if (!trainingContext) {
      trainingContext = '\n\n죄송합니다. 해당 질문에 대한 학습된 자료를 찾을 수 없습니다. 관리자에게 문의하시거나 관련 부서에 직접 연락해주세요.';
    }

    const systemPrompt = `당신은 당진시청 당직근무 지원 AI 어시스턴트입니다. 당직 근무자들의 질문에 친절하고 정확하게 답변해주세요.

현재 당직 정보: ${context || '없음'}${trainingContext}

답변 시 다음 사항을 고려해주세요:
- 제공된 교육자료에 기반해서만 답변하세요
- 교육자료에 없는 내용은 "모르겠습니다"라고 답변하세요
- 긴급상황 시 관련 부서 연락처를 안내해주세요
- 친근하고 공손한 어조로 답변해주세요`;

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