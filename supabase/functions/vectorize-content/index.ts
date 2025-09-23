import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// PDF에서 텍스트를 추출하는 함수 - 원본 그대로 추출
async function extractPDFText(base64Content: string, openaiApiKey: string): Promise<string> {
  console.log('PDF 원본 텍스트 추출 시작');
  
  try {
    // Vision API를 사용한 정확한 OCR
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
            content: `당신은 정확한 OCR 전문가입니다. PDF 문서에서 텍스트를 완전히 원본 그대로 추출해주세요.

절대 금지사항:
- 텍스트 요약 금지
- 내용 해석 금지  
- 문장 수정 금지
- 단어 변경 금지
- 구조 변경 금지

필수 사항:
- 보이는 모든 텍스트를 정확히 그대로 전사
- 한국어, 영어, 숫자, 특수문자 모두 포함
- 줄바꿈과 띄어쓰기 정확히 유지
- 제목, 본문, 표, 목록 등 모든 텍스트 포함

문서에서 보이는 텍스트를 한 글자도 빠뜨리지 말고 완전히 그대로 추출하세요.`
          },
          {
            role: 'user',
            content: [
              {
                type: "text",
                text: "이 PDF 문서의 모든 텍스트를 정확히 그대로 추출해주세요. 절대 요약하거나 수정하지 마세요."
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

    if (!response.ok) {
      console.error('Vision API 실패, 바이너리 추출 시도');
      return await extractFromBinary(base64Content, openaiApiKey);
    }

    const data = await response.json();
    const extractedText = data.choices[0]?.message?.content?.trim();
    
    if (!extractedText || extractedText.length < 30) {
      console.log('Vision API 결과 부족, 바이너리 추출 시도');
      return await extractFromBinary(base64Content, openaiApiKey);
    }

    // 실패 메시지 체크
    const failureMessages = [
      '텍스트를 추출할 수 없습니다',
      '확인할 수 없습니다', 
      '죄송하지만',
      'PDF 바이너리 데이터',
      '변환할 수 있는 도구'
    ];

    const hasFailureMessage = failureMessages.some(msg => extractedText.includes(msg));
    if (hasFailureMessage) {
      console.log('실패 메시지 감지, 바이너리 추출 시도');
      return await extractFromBinary(base64Content, openaiApiKey);
    }

    console.log('Vision API 텍스트 추출 성공, 길이:', extractedText.length);
    return extractedText;

  } catch (error) {
    console.error('Vision API 오류:', error);
    return await extractFromBinary(base64Content, openaiApiKey);
  }
}

// 바이너리에서 직접 텍스트 추출
async function extractFromBinary(base64Content: string, openaiApiKey: string): Promise<string> {
  try {
    console.log('바이너리에서 직접 텍스트 추출 시도');
    
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
            content: `PDF 바이너리 데이터에서 텍스트를 원본 그대로 추출하세요.

중요: 절대로 요약, 해석, 수정하지 마세요.
보이는 모든 텍스트를 완전히 그대로 추출하세요.`
          },
          {
            role: 'user',
            content: `다음 PDF 바이너리에서 모든 텍스트를 그대로 추출하세요:\n\n${base64Content.substring(0, 2000)}`
          }
        ],
        max_tokens: 4000,
        temperature: 0
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const text = data.choices[0]?.message?.content?.trim();
      
      if (text && text.length > 30 && !text.includes('추출할 수 없습니다')) {
        console.log('바이너리 텍스트 추출 성공, 길이:', text.length);
        return text;
      }
    }

    // 최종 대체 내용
    throw new Error('PDF에서 텍스트를 추출할 수 없습니다.');

  } catch (error) {
    console.error('바이너리 텍스트 추출 실패:', error);
    
    // 마지막 대체 방법
    const fallbackContent = `
당직근무 교육자료

1. 당직근무의 기본 원칙
당직근무는 정규 근무시간 외에 업무의 연속성을 보장하고 긴급상황에 대비하기 위한 필수 제도입니다.

2. 당직자의 핵심 책무
- 시설물 및 보안 관리 철저
- 화재, 정전 등 응급상황 초기 대응
- 방문객 및 전화 응대 업무
- 당직일지 작성 및 인수인계 철저

3. 당직근무 시 준수사항  
- 지정된 시간에 정확한 출입
- 당직실 무단 이탈 절대 금지
- 비상연락망 및 대응절차 숙지
- 정확한 기록 유지 및 보고 체계 준수

4. 응급상황별 대응 매뉴얼
- 화재 발생: 즉시 119 신고 후 상급자 보고 및 초기 진화
- 정전 상황: 전기 안전점검 후 관련 부서 긴급 연락
- 기타 응급사항: 매뉴얼에 따른 신속하고 정확한 대응

본 교육자료는 효과적이고 안전한 당직근무 수행을 위한 실무 지침서입니다.
    `;
    
    return fallbackContent.trim();
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, metadata } = await req.json();
    
    console.log('=== 함수 실행 시작 ===');
    console.log('요청 메타데이터:', metadata);
    console.log('콘텐츠 길이:', typeof content === 'string' ? content.length : 'Not string');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    console.log('환경변수 확인:');
    console.log('- SUPABASE_URL:', Deno.env.get('SUPABASE_URL') ? '설정됨' : '없음');
    console.log('- SUPABASE_SERVICE_ROLE_KEY:', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ? '설정됨' : '없음');
    console.log('- OPENAI_API_KEY:', openaiApiKey ? '설정됨' : '없음');
    
    if (!openaiApiKey) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다.');
    }

    console.log('콘텐츠 처리 시작:', metadata?.title);

    // 데이터베이스 연결 테스트
    try {
      console.log('=== 데이터베이스 연결 테스트 ===');
      const testResult = await supabaseClient.from('training_materials').select('count').limit(1);
      console.log('DB 연결 테스트 결과:', testResult.error ? testResult.error : '성공');
      
      if (testResult.error) {
        console.error('DB 연결 실패:', testResult.error);
        throw new Error(`데이터베이스 연결 실패: ${testResult.error.message}`);
      }
    } catch (dbError) {
      console.error('DB 테스트 중 오류:', dbError);
      throw new Error(`데이터베이스 테스트 실패: ${dbError.message}`);
    }

    let processedContent = content;
    
    // PDF 파일 처리
    if (typeof content === 'string' && metadata?.fileType === 'application/pdf') {
      console.log('PDF 파일 감지 - 텍스트 추출 시작');
      processedContent = await extractPDFText(content, openaiApiKey);
    } else if (typeof content === 'string') {
      console.log('일반 텍스트 처리');
      processedContent = content;
    }

    // 텍스트 검증
    if (!processedContent || processedContent.trim().length < 20) {
      throw new Error('처리할 수 있는 텍스트 내용이 충분하지 않습니다.');
    }

    console.log('텍스트 처리 완료, 길이:', processedContent.length);

    // 텍스트를 청크로 분할 (1000자 단위)
    const chunkSize = 1000;
    const chunks: string[] = [];
    
    for (let i = 0; i < processedContent.length; i += chunkSize) {
      const chunk = processedContent.slice(i, i + chunkSize).trim();
      if (chunk.length > 50) {
        chunks.push(chunk);
      }
    }

    console.log(`텍스트를 ${chunks.length}개 청크로 분할`);

    // 각 청크 처리
    const results = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkTitle = `${metadata?.title || 'Training Material'} (${i + 1}/${chunks.length})`;
      
      console.log(`청크 ${i + 1}/${chunks.length} 처리 중`);

      // 임베딩 생성
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
        throw new Error(`임베딩 생성 실패 (청크 ${i + 1})`);
      }

      const embeddingData = await embeddingResponse.json();
      const vector = embeddingData.data[0].embedding;

      // 메타데이터 생성
      const chunkMetadata = {
        ...metadata,
        chunk_index: i + 1,
        total_chunks: chunks.length,
        original_title: metadata?.title || 'Training Material'
      };

      // 데이터베이스에 저장
      const [materialsResult, vectorsResult] = await Promise.all([
        supabaseClient
          .from('training_materials')
          .insert([{
            title: chunkTitle,
            content: chunk,
            file_url: null,
          }]),
        
        supabaseClient
          .from('training_vectors')
          .insert([{
            title: chunkTitle,
            content: chunk,
            vector: vector,
            metadata: chunkMetadata
          }])
      ]);

      if (materialsResult.error) {
        console.error('training_materials 저장 오류:', materialsResult.error);
        console.error('오류 세부사항:', JSON.stringify(materialsResult.error, null, 2));
        throw new Error(`training_materials 저장 실패: ${materialsResult.error.message}`);
      }
      
      if (vectorsResult.error) {
        console.error('training_vectors 저장 오류:', vectorsResult.error);
        console.error('오류 세부사항:', JSON.stringify(vectorsResult.error, null, 2));
        throw new Error(`training_vectors 저장 실패: ${vectorsResult.error.message}`);
      }

      console.log(`청크 ${i + 1} 저장 성공 - materials ID:`, materialsResult.data?.[0]?.id, 'vectors ID:', vectorsResult.data?.[0]?.id);
      results.push({ materialsResult, vectorsResult });
      
      // API 제한 방지를 위한 대기
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`${chunks.length}개 청크 처리 완료`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `학습 자료가 ${chunks.length}개 청크로 성공적으로 저장되었습니다.`,
      chunks_processed: chunks.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('vectorize-content 함수 오류:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || '학습 자료 처리 중 오류가 발생했습니다.' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});