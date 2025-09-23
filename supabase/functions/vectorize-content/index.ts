import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// OpenAI GPT-4 Vision을 활용한 강력한 PDF OCR 텍스트 추출
async function extractTextFromPDF(base64Content: string, openaiApiKey: string): Promise<string> {
  try {
    console.log('PDF OCR 텍스트 추출 시작 - GPT-4 Vision 방식');
    
    // GPT-4 Vision을 사용하여 PDF를 직접 이미지로 처리
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
            content: `당신은 PDF 문서에서 텍스트를 정확하게 추출하는 OCR 전문가입니다. 

규칙:
1. 문서에 있는 모든 텍스트를 정확하게 그대로 추출하세요
2. 요약하거나 정리하지 말고 원본 텍스트를 그대로 반환하세요  
3. 줄바꿈과 단락 구조를 유지하세요
4. 한국어와 영어 모든 텍스트를 포함하세요
5. 표나 목록의 구조도 최대한 유지하세요

PDF에서 추출한 모든 텍스트를 반환하세요.`
          },
          {
            role: 'user',
            content: [
              {
                type: "text",
                text: "이 PDF 문서에서 모든 텍스트를 정확히 추출해주세요. 당직근무, 교육자료, 업무 관련 내용이 포함되어 있습니다."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${base64Content}`
                }
              }
            ]
          }
        ],
        max_tokens: 4000,
        temperature: 0
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API 오류:', response.status, errorText);
      
      // Vision API 실패시 fallback으로 텍스트 기반 처리 시도
      return await fallbackTextExtraction(base64Content, openaiApiKey);
    }

    const data = await response.json();
    const extractedText = data.choices[0].message.content;
    
    if (!extractedText || extractedText.trim().length < 10) {
      console.log('Vision API 결과 부족, fallback 시도');
      return await fallbackTextExtraction(base64Content, openaiApiKey);
    }
    
    console.log('GPT-4 Vision으로 추출된 텍스트 길이:', extractedText.length);
    return extractedText.trim();
    
  } catch (error) {
    console.error('PDF Vision 처리 오류:', error);
    
    // 에러 발생시 fallback 시도
    return await fallbackTextExtraction(base64Content, openaiApiKey);
  }
}

// Fallback 텍스트 추출 방법
async function fallbackTextExtraction(base64Content: string, openaiApiKey: string): Promise<string> {
  try {
    console.log('Fallback 텍스트 추출 시도');
    
    // 바이너리 데이터에서 직접 텍스트 패턴 추출 시도
    const binaryData = atob(base64Content);
    let extractedText = '';
    
    // PDF 텍스트 스트림에서 한국어/영어 텍스트 찾기
    const textMatches = binaryData.match(/[\u3131-\u318E\u4E00-\u9FFF\uAC00-\uD7AF\w\s.,!?]+/g);
    
    if (textMatches) {
      extractedText = textMatches
        .filter(text => text.trim().length > 1)
        .filter(text => /[가-힣a-zA-Z]/.test(text))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    // GPT를 사용한 텍스트 정리 및 추출
    if (extractedText.length > 10) {
      const cleanupResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: '추출된 텍스트를 정리하되, 내용을 요약하지 말고 모든 원본 텍스트를 유지하면서 읽기 쉽게 정리해주세요.'
            },
            {
              role: 'user',
              content: `다음 추출된 텍스트를 정리해주세요:\n\n${extractedText}`
            }
          ],
          max_tokens: 3000,
          temperature: 0
        }),
      });
      
      if (cleanupResponse.ok) {
        const cleanupData = await cleanupResponse.json();
        const cleanedText = cleanupData.choices[0].message.content;
        
        if (cleanedText && cleanedText.length > extractedText.length * 0.5) {
          console.log('정리된 텍스트 길이:', cleanedText.length);
          return cleanedText.trim();
        }
      }
    }
    
    if (!extractedText || extractedText.length < 20) {
      throw new Error('PDF에서 텍스트를 추출할 수 없습니다. 스캔된 이미지 PDF이거나 보호된 문서일 수 있습니다.');
    }
    
    return extractedText;
    
  } catch (error) {
    console.error('Fallback 텍스트 추출 실패:', error);
    throw new Error('PDF 텍스트 추출에 완전히 실패했습니다. 다른 형식으로 변환 후 다시 시도해주세요.');
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