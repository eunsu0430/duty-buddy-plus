
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// OCR 텍스트 추출 함수 (GPT-4 Vision 사용)
async function extractTextWithOCR(content: string, metadata: any): Promise<string> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openaiApiKey) {
    throw new Error('OpenAI API 키가 설정되지 않았습니다.');
  }

  console.log('GPT-4 Vision을 사용하여 OCR 텍스트 추출 시작');

  try {
    // PDF 바이너리 데이터를 base64로 변환 (이미지로 처리)
    const base64Content = btoa(content);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `당신은 OCR 전문가입니다. 이미지나 문서에서 한국어 텍스트를 정확하게 읽고 추출해주세요.
            
            다음 규칙을 따라주세요:
            1. 모든 한국어 텍스트를 정확하게 읽어주세요
            2. 표, 목록, 단락 구조를 유지해주세요
            3. 특수문자나 기호도 포함해주세요
            4. 당직근무, 민원처리 관련 내용은 특히 자세히 읽어주세요
            5. 읽을 수 없는 부분은 [읽을 수 없음]으로 표시해주세요
            
            추출된 텍스트만 반환해주세요.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `다음 문서에서 OCR로 텍스트를 추출해주세요:
                파일명: ${metadata?.filename || 'unknown'}
                제목: ${metadata?.title || 'unknown'}`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${base64Content.substring(0, 10000)}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 2500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API 오류: ${response.statusText}`);
    }

    const data = await response.json();
    const extractedText = data.choices[0].message.content;
    
    console.log('GPT-4 Vision OCR 텍스트 추출 완료, 길이:', extractedText.length);
    
    if (!extractedText || extractedText.trim().length < 50) {
      throw new Error('OCR로 추출된 텍스트가 너무 짧습니다.');
    }
    
    return extractedText.trim();
    
  } catch (error) {
    console.error('GPT-4 Vision OCR 추출 오류:', error);
    throw new Error('OCR 텍스트 추출에 실패했습니다: ' + error.message);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, metadata } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openaiApiKey) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다.');
    }

    console.log('Processing content for vectorization:', metadata?.title);

    // 콘텐츠 처리
    let processedContent = content;
    
    // PDF 파일인지 확인
    if (metadata?.type === 'application/pdf' || metadata?.filename?.endsWith('.pdf') || 
        (typeof content === 'string' && (content.startsWith('%PDF') || content.includes('PDF-')))) {
      console.log('PDF 파일 감지, GPT-4 Vision OCR로 텍스트 추출 시작');
      try {
        processedContent = await extractTextWithOCR(content, metadata);
      } catch (extractError) {
        console.error('OCR 텍스트 추출 실패:', extractError);
        throw new Error('PDF 파일에서 OCR 텍스트를 추출할 수 없습니다: ' + extractError.message);
      }
    }

    // 텍스트가 너무 짧은 경우 처리
    if (!processedContent || processedContent.trim().length < 20) {
      throw new Error('처리할 수 있는 텍스트 내용이 충분하지 않습니다. (최소 20자 이상 필요)');
    }

    // Generate embeddings using OpenAI
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: processedContent
      }),
    });

    if (!embeddingResponse.ok) {
      throw new Error(`OpenAI API 오류: ${embeddingResponse.statusText}`);
    }

    const embeddingData = await embeddingResponse.json();
    const vector = embeddingData.data[0].embedding;

    // Store the content with vector embeddings
    const { data, error } = await supabaseClient
      .from('training_vectors')
      .insert([{
        title: metadata?.title || 'Training Material',
        content: processedContent,
        vector: vector,
        metadata: metadata || {}
      }]);

    if (error) {
      console.error('Error storing training material:', error);
      throw error;
    }

    console.log('Training material vectorized and stored successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      message: '학습 자료가 OCR로 성공적으로 추출되어 벡터화되었습니다.',
      extractedLength: processedContent.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in vectorize-content function:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || '학습 자료 처리 중 오류가 발생했습니다.' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
