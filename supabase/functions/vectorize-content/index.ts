import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// PDF 텍스트 추출을 위한 더 나은 방법
async function extractTextFromPDF(base64Content: string, openaiApiKey: string): Promise<string> {
  try {
    console.log('PDF 텍스트 추출 시작');
    
    // Base64를 디코딩하여 바이너리 데이터 복원
    const binaryData = atob(base64Content);
    const bytes = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      bytes[i] = binaryData.charCodeAt(i);
    }
    
    // PDF 바이너리에서 텍스트 스트림 찾기
    const textDecoder = new TextDecoder('utf-8', { fatal: false });
    let extractedText = '';
    
    // PDF 구조 분석을 통한 텍스트 추출
    const pdfString = textDecoder.decode(bytes);
    
    // 1. PDF 스트림 객체에서 텍스트 추출 시도
    const streamMatches = pdfString.match(/stream\s*\n([\s\S]*?)\nendstream/g);
    if (streamMatches) {
      for (const stream of streamMatches) {
        const streamContent = stream.replace(/^stream\s*\n/, '').replace(/\nendstream$/, '');
        
        // 텍스트 패턴 검색
        const textPatterns = [
          /\((.*?)\)\s*Tj/g,  // PDF Text show 연산자
          /\[(.*?)\]\s*TJ/g,  // PDF Array text show 연산자
          /BT\s+(.*?)\s+ET/gs, // Text object
          /\((.*?)\)/g,       // 괄호 안의 텍스트
        ];
        
        for (const pattern of textPatterns) {
          let match;
          while ((match = pattern.exec(streamContent)) !== null) {
            const text = match[1];
            if (text && text.trim().length > 0 && /[가-힣a-zA-Z]/.test(text)) {
              extractedText += text.replace(/\\[rn]/g, ' ').trim() + ' ';
            }
          }
        }
      }
    }
    
    // 2. 기본 텍스트 패턴으로 추가 추출
    const basicPatterns = [
      /\((.*?)\)/g,
      />[^<]*([가-힣a-zA-Z0-9\s.,!?]+)[^<]*</g,
      /([가-힣a-zA-Z0-9\s.,!?]{5,})/g
    ];
    
    for (const pattern of basicPatterns) {
      let match;
      while ((match = pattern.exec(pdfString)) !== null) {
        const text = match[1] || match[0];
        if (text && text.trim().length > 2 && /[가-힣a-zA-Z]/.test(text) && !text.includes('%') && !text.includes('obj')) {
          extractedText += text.trim() + ' ';
        }
      }
    }
    
    // 추출된 텍스트 정리
    extractedText = extractedText
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s가-힣.,!?]/g, ' ')
      .trim();
    
    console.log('패턴 매칭으로 추출된 텍스트 길이:', extractedText.length);
    
    // 충분한 텍스트가 추출되지 않았을 경우 GPT-4 사용
    if (extractedText.length < 50) {
      console.log('패턴 매칭 부족, GPT-4로 재시도');
      
      // PDF 샘플을 GPT-4에게 전달하여 텍스트 추출 요청
      const sampleContent = base64Content.substring(0, 8000); // 처음 8KB만 사용
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
              content: '당신은 PDF 바이너리 데이터에서 텍스트를 추출하는 전문가입니다. 주어진 PDF 바이너리 데이터에서 읽을 수 있는 모든 한글과 영어 텍스트를 정확히 추출해주세요.'
            },
            {
              role: 'user',
              content: `다음 PDF 바이너리 데이터에서 의미 있는 텍스트를 모두 추출해주세요. 특수문자나 바이너리 코드는 제외하고 실제 문서 내용만 추출해주세요:\n\n${sampleContent}`
            }
          ],
          max_tokens: 3000,
          temperature: 0.1
        }),
      });

      if (response.ok) {
        const gptData = await response.json();
        const gptExtracted = gptData.choices[0].message.content;
        
        if (gptExtracted && gptExtracted.length > extractedText.length) {
          extractedText = gptExtracted;
          console.log('GPT-4로 텍스트 추출 완료, 길이:', extractedText.length);
        }
      } else {
        console.warn('GPT-4 텍스트 추출 실패, 기존 추출 결과 사용');
      }
    }
    
    if (!extractedText || extractedText.trim().length < 20) {
      throw new Error('PDF에서 충분한 텍스트를 추출할 수 없습니다. 스캔된 이미지 PDF이거나 보호된 파일일 수 있습니다.');
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