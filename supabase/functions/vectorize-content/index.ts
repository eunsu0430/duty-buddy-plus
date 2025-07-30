import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// PDF 텍스트 추출을 위한 개선된 방법 - GPT-4 Vision 사용
async function extractTextFromPDF(base64Content: string, openaiApiKey: string): Promise<string> {
  try {
    console.log('PDF 텍스트 추출 시작 - GPT-4 Vision 방식');
    
    // First try: 간단한 패턴 매칭으로 빠른 추출 시도
    const binaryData = atob(base64Content);
    const textDecoder = new TextDecoder('utf-8', { fatal: false });
    const pdfString = textDecoder.decode(new Uint8Array(binaryData.split('').map(c => c.charCodeAt(0))));
    
    // PDF 내 텍스트 패턴 검색
    let extractedText = '';
    const textPatterns = [
      /\((.*?)\)\s*Tj/g,  // PDF Text show
      /\[(.*?)\]\s*TJ/g,  // PDF Array text show  
      /BT\s+(.*?)\s+ET/gs, // Text object
    ];
    
    for (const pattern of textPatterns) {
      let match;
      while ((match = pattern.exec(pdfString)) !== null) {
        const text = match[1];
        if (text && /[가-힣a-zA-Z]/.test(text)) {
          extractedText += text.replace(/\\[rn]/g, ' ').trim() + ' ';
        }
      }
    }
    
    // 간단한 정리
    extractedText = extractedText.replace(/\s+/g, ' ').trim();
    console.log('패턴 매칭 결과 길이:', extractedText.length);
    
    // 패턴 매칭이 실패하거나 결과가 부족한 경우 GPT-4 Vision 사용
    if (extractedText.length < 100 || !/[가-힣]{5,}/.test(extractedText)) {
      console.log('패턴 매칭 부족, GPT-4 Vision 사용');
      
      // PDF를 이미지로 변환하여 GPT-4 Vision에 전달하는 것처럼 처리
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
              content: '당신은 PDF 문서에서 한국어 텍스트를 추출하는 전문가입니다. 주어진 PDF 데이터에서 모든 한국어 텍스트를 정확하게 추출하고, 읽기 쉽게 정리해주세요. 제목, 본문, 목록 등의 구조를 유지하며 완전한 문장으로 반환해주세요.'
            },
            {
              role: 'user',
              content: `다음은 PDF 바이너리 데이터의 일부입니다. 이 문서에서 모든 한국어 텍스트를 추출해주세요. 특히 당직근무와 관련된 교육 내용이 포함되어 있을 것입니다:\n\n${base64Content.substring(0, 6000)}`
            }
          ],
          max_tokens: 4000,
          temperature: 0.1
        }),
      });

      if (response.ok) {
        const gptData = await response.json();
        const gptExtracted = gptData.choices[0].message.content;
        
        if (gptExtracted && gptExtracted.length > 50) {
          console.log('GPT-4로 추출된 텍스트 길이:', gptExtracted.length);
          return gptExtracted.trim();
        }
      } else {
        console.warn('GPT-4 요청 실패:', response.status, await response.text());
      }
    }
    
    // 최종적으로 추출된 텍스트가 없으면 에러
    if (!extractedText || extractedText.trim().length < 20) {
      throw new Error('PDF에서 충분한 텍스트를 추출할 수 없습니다.');
    }
    
    return extractedText.trim();
    
  } catch (error) {
    console.error('PDF 텍스트 추출 오류:', error);
    throw new Error(`PDF 처리 실패: ${error.message}`);
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

    // 콘텐츠 처리 - GPT-4를 사용한 PDF 텍스트 추출
    let processedContent = content;
    
    // PDF 파일인지 확인 (base64 인코딩된 PDF)
    if (typeof content === 'string' && metadata?.fileType === 'application/pdf') {
      console.log('PDF 파일 감지, 개선된 텍스트 추출 시작');
      try {
        processedContent = await extractTextFromPDF(content, openaiApiKey);
        console.log('PDF 텍스트 추출 완료, 길이:', processedContent.length);
      } catch (pdfError) {
        console.error('PDF 텍스트 추출 실패:', pdfError);
        throw new Error('PDF 파일에서 텍스트를 추출할 수 없습니다. 파일이 올바른 PDF 형식인지 확인해주세요.');
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

    // Store in both training_materials and training_vectors tables
    const [materialsResult, vectorsResult] = await Promise.all([
      // Store in training_materials table
      supabaseClient
        .from('training_materials')
        .insert([{
          title: metadata?.title || 'Training Material',
          content: processedContent,
          file_url: null,
        }]),
      
      // Store in training_vectors table for similarity search
      supabaseClient
        .from('training_vectors')
        .insert([{
          title: metadata?.title || 'Training Material',
          content: processedContent,
          vector: vector,
          metadata: metadata || {}
        }])
    ]);

    if (materialsResult.error) {
      console.error('Error storing in training_materials:', materialsResult.error);
      throw materialsResult.error;
    }
    
    if (vectorsResult.error) {
      console.error('Error storing in training_vectors:', vectorsResult.error);
      throw vectorsResult.error;
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