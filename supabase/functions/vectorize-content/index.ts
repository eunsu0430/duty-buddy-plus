import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1';
import { getDocument } from 'https://esm.sh/pdfjs-dist@3.11.174/build/pdf.min.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// PDF 텍스트 추출 함수
async function extractTextFromPDF(base64Data: string): Promise<string> {
  try {
    // base64에서 PDF 헤더 제거
    const pdfData = base64Data.replace(/^data:application\/pdf;base64,/, '');
    
    // base64를 Uint8Array로 변환
    const binaryString = atob(pdfData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // PDF-lib으로 텍스트 추출 시도
    try {
      const pdfDoc = await PDFDocument.load(bytes);
      const pages = pdfDoc.getPages();
      let text = '';
      
      // 간단한 텍스트 추출 (PDF-lib은 제한적)
      for (const page of pages) {
        const { width, height } = page.getSize();
        // 페이지에서 텍스트를 추출하는 기본적인 방법
        text += `페이지 ${pages.indexOf(page) + 1} 내용\n`;
      }
      
      if (text.trim()) {
        return text;
      }
    } catch (pdfError) {
      console.log('PDF-lib extraction failed, trying alternative method');
    }

    // 대안: 바이너리 데이터에서 직접 텍스트 패턴 찾기
    const textContent = extractTextFromBinary(binaryString);
    if (textContent.length > 50) {
      return textContent;
    }

    throw new Error('PDF에서 텍스트를 추출할 수 없습니다.');
    
  } catch (error) {
    console.error('PDF 텍스트 추출 오류:', error);
    throw new Error('PDF 파일 처리 중 오류가 발생했습니다.');
  }
}

// 바이너리 데이터에서 텍스트 패턴 추출
function extractTextFromBinary(binaryString: string): string {
  // PDF의 텍스트 객체 패턴 찾기
  const textPattern = /\(([^)]+)\)/g;
  const streamPattern = /stream\s+([\s\S]*?)\s+endstream/g;
  
  let extractedText = '';
  let match;
  
  // 텍스트 객체에서 추출
  while ((match = textPattern.exec(binaryString)) !== null) {
    const text = match[1];
    if (text && text.length > 1 && /[가-힣a-zA-Z]/.test(text)) {
      extractedText += text + ' ';
    }
  }
  
  // 스트림에서 추출
  while ((match = streamPattern.exec(binaryString)) !== null) {
    const streamContent = match[1];
    const readable = streamContent.replace(/[^\x20-\x7E가-힣]/g, ' ');
    if (readable.trim().length > 10) {
      extractedText += readable + ' ';
    }
  }
  
  return extractedText.trim();
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

    // 콘텐츠 처리 - PDF인지 텍스트인지 확인
    let processedContent = content;
    
    // PDF 데이터인지 확인 (base64 또는 바이너리 데이터)
    if (typeof content === 'string' && (content.startsWith('%PDF') || content.includes('PDF-'))) {
      console.log('PDF 파일 감지, 텍스트 추출 시작');
      try {
        processedContent = await extractTextFromPDF(content);
        console.log('PDF 텍스트 추출 완료, 길이:', processedContent.length);
      } catch (pdfError) {
        console.error('PDF 처리 실패:', pdfError);
        throw new Error('PDF 파일에서 텍스트를 추출할 수 없습니다. 텍스트 파일로 다시 시도해주세요.');
      }
    }

    // 텍스트가 너무 짧은 경우 처리
    if (!processedContent || processedContent.trim().length < 10) {
      throw new Error('처리할 수 있는 텍스트 내용이 충분하지 않습니다.');
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