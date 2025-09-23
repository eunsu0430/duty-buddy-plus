import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import * as pdfjsLib from "https://esm.sh/pdfjs-dist@3.4.120";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// PDF 텍스트 추출 (로컬 처리)
async function extractPDFTextLocally(base64Content: string): Promise<string> {
  try {
    console.log('PDF 로컬 텍스트 추출 시작');
    const pdfData = Uint8Array.from(atob(base64Content), c => c.charCodeAt(0));
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const pdf = await loadingTask.promise;
    
    let textContent = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const text = await page.getTextContent();
      const pageText = text.items.map((item: any) => item.str).join(' ');
      textContent += `\n=== Page ${pageNum} ===\n${pageText}`;
    }
    
    const result = textContent.trim();
    console.log(`PDF 텍스트 추출 완료: ${result.length}자`);
    
    // 텍스트가 너무 적으면 스캔본 PDF일 가능성이 높음
    if (result.length < 100) {
      console.log('추출된 텍스트가 부족, 스캔본 PDF로 추정');
      throw new Error('텍스트 기반 PDF가 아닙니다. 스캔본 처리 필요');
    }
    
    return result;
  } catch (error) {
    console.error('PDF 로컬 추출 실패:', error);
    throw new Error('PDF 텍스트 추출에 실패했습니다.');
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, metadata } = await req.json();
    console.log('=== 벡터화 함수 시작 ===');
    console.log('요청 메타데이터:', metadata);
    console.log('콘텐츠 길이:', typeof content === 'string' ? content.length : 'Not string');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다.');
    }

    let processedContent = content;

    // PDF 파일이면 로컬 추출
    if (typeof content === 'string' && metadata?.fileType === 'application/pdf') {
      console.log('PDF 파일 감지 - 로컬 텍스트 추출 시작');
      processedContent = await extractPDFTextLocally(content);
    } else if (typeof content === 'string') {
      console.log('일반 텍스트 처리');
      processedContent = content;
    }

    if (!processedContent || processedContent.trim().length < 20) {
      throw new Error('처리할 수 있는 텍스트 내용이 충분하지 않습니다.');
    }

    console.log('텍스트 처리 완료, 길이:', processedContent.length);

    // 청크 분할 (1000자 단위)
    const chunkSize = 1000;
    const chunks: string[] = [];
    for (let i = 0; i < processedContent.length; i += chunkSize) {
      const chunk = processedContent.slice(i, i + chunkSize).trim();
      if (chunk.length > 20) {
        chunks.push(chunk);
      }
    }

    console.log(`텍스트를 ${chunks.length}개 청크로 분할`);

    if (chunks.length === 0) {
      throw new Error('생성된 텍스트 청크가 없습니다.');
    }

    // 각 청크 처리
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkTitle = `${metadata?.title || 'Training Material'} (${i + 1}/${chunks.length})`;

      console.log(`청크 ${i + 1}/${chunks.length} 처리 중`);

      // OpenAI Embedding 생성
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
        console.error('임베딩 API 오류:', errorText);
        throw new Error(`임베딩 생성 실패: ${embeddingResponse.statusText}`);
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

      // DB 저장
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
        throw new Error(`training_materials 저장 실패: ${materialsResult.error.message}`);
      }
      
      if (vectorsResult.error) {
        console.error('training_vectors 저장 오류:', vectorsResult.error);
        throw new Error(`training_vectors 저장 실패: ${vectorsResult.error.message}`);
      }

      console.log(`청크 ${i + 1}/${chunks.length} 저장 완료`);

      // API 제한 방지를 위한 대기
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`모든 ${chunks.length}개 청크 처리 완료`);

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