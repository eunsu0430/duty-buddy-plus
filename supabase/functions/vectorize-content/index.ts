import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 간단한 텍스트 추출 함수
function extractTextFromBinaryData(content: string): string {
  try {
    // 이미 읽을 수 있는 텍스트인지 확인
    if (/^[가-힣\s\w\W]*$/.test(content) && content.length > 10) {
      return content;
    }

    // PDF나 바이너리 데이터에서 텍스트 패턴 찾기
    const textPatterns = [
      /\(([^)]+)\)/g,  // PDF 텍스트 객체
      />\s*([가-힣\w\s.,!?]+)\s*</g,  // XML/HTML 태그 내 텍스트
      /\b([가-힣\w\s.,!?]{3,})\b/g,  // 일반적인 텍스트 패턴
    ];
    
    let extractedText = '';
    
    for (const pattern of textPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const text = match[1];
        if (text && text.trim().length > 2 && /[가-힣a-zA-Z]/.test(text)) {
          extractedText += text.trim() + ' ';
        }
      }
    }
    
    // 추출된 텍스트 정리
    extractedText = extractedText.replace(/\s+/g, ' ').trim();
    
    if (extractedText.length > 20) {
      return extractedText;
    }
    
    throw new Error('텍스트를 추출할 수 없습니다.');
    
  } catch (error) {
    console.error('텍스트 추출 오류:', error);
    throw new Error('파일에서 텍스트를 추출할 수 없습니다.');
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

    // 콘텐츠 처리 - 바이너리 데이터 확인
    let processedContent = content;
    
    // 바이너리나 PDF 데이터인지 확인
    if (typeof content === 'string' && (content.startsWith('%PDF') || content.includes('PDF-') || content.length > 1000)) {
      console.log('바이너리/PDF 파일 감지, 텍스트 추출 시작');
      try {
        processedContent = extractTextFromBinaryData(content);
        console.log('텍스트 추출 완료, 길이:', processedContent.length);
      } catch (textError) {
        console.error('텍스트 추출 실패:', textError);
        throw new Error('파일에서 텍스트를 추출할 수 없습니다. .txt 또는 일반 텍스트 파일로 다시 시도해주세요.');
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
      message: '학습 자료가 성공적으로 벡터화되어 저장되었습니다.' 
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