import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// OpenAI Vision API를 활용한 정확한 PDF OCR 텍스트 추출
async function extractTextFromPDF(base64Content: string, openaiApiKey: string): Promise<string> {
  console.log('PDF OCR 텍스트 추출 시작 - Vision API 사용');
  
  try {
    // PDF 데이터를 이미지로 처리하여 OCR 수행
    console.log('Vision API로 PDF OCR 처리');
    
    const ocrResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `당신은 최고의 OCR 전문가입니다. PDF 문서의 이미지에서 모든 텍스트를 정확하게 추출해주세요.

핵심 규칙:
1. 문서에 보이는 모든 텍스트를 완전히 그대로 추출
2. 한국어, 영어, 숫자, 특수문자 모든 것을 포함
3. 원본 문서의 구조와 레이아웃 유지
4. 제목, 본문, 표, 목록 등 모든 요소 인식
5. 절대 요약하거나 해석하지 말고 보이는 그대로 전사
6. 줄바꿈과 문단 구분 정확히 유지

문서에서 보이는 모든 텍스트를 정확히 추출해주세요.`
          },
          {
            role: 'user',
            content: [
              {
                type: "text",
                text: "이 PDF 문서에서 보이는 모든 텍스트를 정확히 추출해주세요. 당직근무, 교육자료, 업무지침 등의 내용이 포함되어 있습니다."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${base64Content}`,
                  detail: "high"
                }
              }
            ]
          }
        ],
        max_tokens: 4000,
        temperature: 0
      }),
    });

    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text();
      console.error('Vision API OCR 오류:', ocrResponse.status, errorText);
      
      // Vision API 실패시 대체 방법으로 텍스트 기반 처리
      return await fallbackTextExtraction(base64Content, openaiApiKey);
    }

    const ocrData = await ocrResponse.json();
    const extractedText = ocrData.choices[0]?.message?.content?.trim();
    
    if (!extractedText || extractedText.length < 20) {
      console.log('Vision API OCR 결과 부족, 대체 방법 시도');
      return await fallbackTextExtraction(base64Content, openaiApiKey);
    }
    
    // OCR 결과 검증
    if (extractedText.includes('텍스트를 추출할 수 없습니다') || 
        extractedText.includes('PDF 파일의 내용을 직접 확인할 수 없습니다') ||
        extractedText.includes('죄송하지만')) {
      console.log('OCR 실패 메시지 감지, 대체 방법 시도');
      return await fallbackTextExtraction(base64Content, openaiApiKey);
    }
    
    console.log('Vision API OCR 성공, 추출된 텍스트 길이:', extractedText.length);
    console.log('추출된 텍스트 미리보기:', extractedText.substring(0, 200));
    
    return extractedText;
    
  } catch (error) {
    console.error('Vision API OCR 처리 오류:', error);
    return await fallbackTextExtraction(base64Content, openaiApiKey);
  }
}

// 대체 텍스트 추출 방법 (Vision API 실패시)
async function fallbackTextExtraction(base64Content: string, openaiApiKey: string): Promise<string> {
  try {
    console.log('대체 텍스트 추출 방법 시도');
    
    // 단순한 텍스트 기반 OCR 요청
    const fallbackResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `PDF 바이너리 데이터에서 텍스트를 추출해주세요. 

규칙:
1. 가능한 모든 텍스트를 추출하세요
2. 한국어와 영어 모두 포함하세요  
3. 원본 내용을 그대로 유지하세요
4. 추출할 수 없는 경우 "텍스트 추출 불가능"이라고 명시하세요`
          },
          {
            role: 'user',
            content: `다음 PDF 데이터에서 텍스트를 추출해주세요:\n\n${base64Content.substring(0, 1500)}`
          }
        ],
        max_tokens: 3000,
        temperature: 0
      }),
    });

    if (fallbackResponse.ok) {
      const fallbackData = await fallbackResponse.json();
      const fallbackText = fallbackData.choices[0]?.message?.content?.trim();
      
      if (fallbackText && fallbackText.length > 20 && 
          !fallbackText.includes('텍스트 추출 불가능') &&
          !fallbackText.includes('확인할 수 없습니다')) {
        console.log('대체 방법 성공, 길이:', fallbackText.length);
        return fallbackText;
      }
    }

    // 모든 방법 실패
    throw new Error('OCR 처리에 실패했습니다. PDF가 이미지로만 구성되어 있거나 텍스트가 없을 수 있습니다.');
    
  } catch (error) {
    console.error('대체 텍스트 추출 실패:', error);
    throw new Error(`PDF OCR 완전 실패: ${error.message}. 다른 형식의 파일을 사용해주세요.`);
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

    // 콘텐츠 처리 - OpenAI를 사용한 강화된 PDF 텍스트 추출
    let processedContent = content;
    
    // PDF 파일인지 확인 (base64 인코딩된 PDF)
    if (typeof content === 'string' && metadata?.fileType === 'application/pdf') {
      console.log('PDF 파일 감지, 강화된 OCR 텍스트 추출 시작');
      try {
        processedContent = await extractTextFromPDF(content, openaiApiKey);
        
        // 추출 결과 검증
        if (!processedContent || processedContent.trim().length < 20) {
          throw new Error('PDF에서 충분한 텍스트를 추출할 수 없습니다');
        }
        
        // 오류 메시지가 content로 들어가지 않도록 검증
        if (processedContent.includes('텍스트 추출 불가') || 
            processedContent.includes('PDF 바이너리 데이터') ||
            processedContent.includes('변환할 수 있는 도구')) {
          throw new Error('PDF 텍스트 추출이 실패했습니다');
        }
        
        console.log('PDF 텍스트 추출 완료, 길이:', processedContent.length);
        console.log('추출된 텍스트 미리보기:', processedContent.substring(0, 200));
        
      } catch (pdfError) {
        console.error('PDF 텍스트 추출 실패:', pdfError);
        throw new Error(`PDF 파일 처리 실패: ${pdfError.message}. 파일이 올바른 형식인지 확인해주세요.`);
      }
    }

    // 텍스트가 너무 짧은 경우 처리
    if (!processedContent || processedContent.trim().length < 20) {
      throw new Error('처리할 수 있는 텍스트 내용이 충분하지 않습니다. (최소 20자 이상 필요)');
    }

    // 텍스트를 1000토큰(약 3000-4000자) 단위로 분할
    function splitTextIntoChunks(text: string, maxChunkSize: number = 3500): string[] {
      const chunks: string[] = [];
      const sentences = text.split(/[.!?]\s+/);
      
      let currentChunk = '';
      
      for (const sentence of sentences) {
        const potentialChunk = currentChunk + (currentChunk ? '. ' : '') + sentence;
        
        if (potentialChunk.length <= maxChunkSize) {
          currentChunk = potentialChunk;
        } else {
          if (currentChunk) {
            chunks.push(currentChunk.trim());
            currentChunk = sentence;
          } else {
            // 문장이 너무 긴 경우 강제로 나누기
            const words = sentence.split(' ');
            let wordChunk = '';
            
            for (const word of words) {
              if ((wordChunk + ' ' + word).length <= maxChunkSize) {
                wordChunk += (wordChunk ? ' ' : '') + word;
              } else {
                if (wordChunk) chunks.push(wordChunk.trim());
                wordChunk = word;
              }
            }
            if (wordChunk) currentChunk = wordChunk;
          }
        }
      }
      
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      
      return chunks.filter(chunk => chunk.length > 20);
    }

    const textChunks = splitTextIntoChunks(processedContent);
    console.log(`텍스트를 ${textChunks.length}개 청크로 분할`);

    // 각 청크별로 임베딩 생성 및 저장
    const allResults = [];
    
    for (let i = 0; i < textChunks.length; i++) {
      const chunk = textChunks[i];
      console.log(`청크 ${i + 1}/${textChunks.length} 처리 중 (길이: ${chunk.length}자)`);

      // Generate embeddings using OpenAI text-embedding-3-small
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: chunk
        }),
      });

      if (!embeddingResponse.ok) {
        const errorText = await embeddingResponse.text();
        throw new Error(`OpenAI API 오류 (청크 ${i + 1}): ${embeddingResponse.status} - ${errorText}`);
      }

      const embeddingData = await embeddingResponse.json();
      const vector = embeddingData.data[0].embedding;

      // 청크별 메타데이터 생성
      const chunkMetadata = {
        ...metadata,
        chunk_index: i + 1,
        total_chunks: textChunks.length,
        chunk_size: chunk.length,
        original_title: metadata?.title || 'Training Material'
      };

      // Store in both training_materials and training_vectors tables
      const [materialsResult, vectorsResult] = await Promise.all([
        // Store in training_materials table
        supabaseClient
          .from('training_materials')
          .insert([{
            title: `${metadata?.title || 'Training Material'} (${i + 1}/${textChunks.length})`,
            content: chunk,
            file_url: null,
          }]),
        
        // Store in training_vectors table for similarity search
        supabaseClient
          .from('training_vectors')
          .insert([{
            title: `${metadata?.title || 'Training Material'} (${i + 1}/${textChunks.length})`,
            content: chunk,
            vector: vector,
            metadata: chunkMetadata
          }])
      ]);

      if (materialsResult.error) {
        console.error(`Error storing chunk ${i + 1} in training_materials:`, materialsResult.error);
        throw materialsResult.error;
      }
      
      if (vectorsResult.error) {
        console.error(`Error storing chunk ${i + 1} in training_vectors:`, vectorsResult.error);
        throw vectorsResult.error;
      }

      allResults.push({ materialsResult, vectorsResult });
      
      // API 호출 간 짧은 대기 (Rate limiting 방지)
      if (i < textChunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`학습 자료가 ${textChunks.length}개 청크로 성공적으로 벡터화되어 저장되었습니다`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `학습 자료가 ${textChunks.length}개 청크로 성공적으로 벡터화되어 저장되었습니다.`,
      chunks_processed: textChunks.length,
      total_vectors: allResults.length
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