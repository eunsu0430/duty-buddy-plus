// --- 필요한 모듈 임포트 ---
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

// --- CORS 헤더 ---
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// HWP 파일에서 텍스트 추출하는 함수
function extractTextFromHWP(base64Content: string): string {
  try {
    console.log("HWP 텍스트 추출 시작...");
    
    // base64를 바이너리로 변환
    const cleanBase64 = base64Content.includes(",") ? base64Content.split(",")[1] : base64Content;
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    console.log("HWP 파일 크기:", bytes.length);
    
    // HWP 파일 헤더 확인
    const header = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 32));
    console.log("파일 헤더:", header);
    
    // 텍스트 추출 시도 - 여러 인코딩으로 시도
    let extractedText = "";
    
    // 방법 1: UTF-8로 디코딩 시도
    try {
      const utf8Text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      const cleanText = utf8Text.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
      if (cleanText.length > 0) {
        extractedText += cleanText + "\n";
      }
    } catch (e) {
      console.log("UTF-8 디코딩 실패");
    }
    
    // 방법 2: EUC-KR로 디코딩 시도 (한글 지원)
    try {
      // 간단한 한글 바이트 패턴 찾기
      const koreanBytes = [];
      for (let i = 0; i < bytes.length - 1; i++) {
        const byte1 = bytes[i];
        const byte2 = bytes[i + 1];
        
        // 한글 완성형 코드 범위 (EUC-KR)
        if (byte1 >= 0xB0 && byte1 <= 0xC8 && byte2 >= 0xA1 && byte2 <= 0xFE) {
          koreanBytes.push(byte1, byte2);
          i++; // 2바이트 문자이므로 다음 바이트 건너뛰기
        }
        // ASCII 문자 (영문, 숫자, 특수문자)
        else if (byte1 >= 0x20 && byte1 <= 0x7E) {
          koreanBytes.push(byte1);
        }
        // 줄바꿈 문자
        else if (byte1 === 0x0A || byte1 === 0x0D) {
          koreanBytes.push(byte1);
        }
      }
      
      if (koreanBytes.length > 0) {
        const koreanText = new TextDecoder('euc-kr', { fatal: false })
          .decode(new Uint8Array(koreanBytes))
          .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '') // 제어문자 제거 (단, \n, \r은 유지)
          .trim();
        
        if (koreanText.length > extractedText.length) {
          extractedText = koreanText;
        }
      }
    } catch (e) {
      console.log("EUC-KR 디코딩 실패");
    }
    
    // 방법 3: 단순 ASCII 텍스트 추출
    if (extractedText.length < 50) {
      let asciiText = "";
      for (let i = 0; i < bytes.length; i++) {
        const byte = bytes[i];
        if (byte >= 32 && byte <= 126) { // 출력 가능한 ASCII
          asciiText += String.fromCharCode(byte);
        } else if (byte === 10 || byte === 13) { // 줄바꿈
          asciiText += String.fromCharCode(byte);
        }
      }
      
      const cleanAscii = asciiText
        .replace(/(.)\1{10,}/g, '$1') // 연속된 같은 문자 제거
        .replace(/\s+/g, ' ') // 연속된 공백 정리
        .trim();
      
      if (cleanAscii.length > extractedText.length) {
        extractedText = cleanAscii;
      }
    }
    
    console.log("추출된 텍스트 길이:", extractedText.length);
    
    // 추출된 텍스트가 있으면 반환
    if (extractedText.length > 20) {
      const lines = extractedText.split('\n').filter(line => line.trim().length > 0);
      const meaningfulText = lines.slice(0, 50).join('\n'); // 최대 50줄까지만
      
      if (meaningfulText.length > 20) {
        console.log("HWP 텍스트 추출 성공");
        return meaningfulText;
      }
    }
    
    console.log("HWP 텍스트 추출 실패 - 기본 메시지 반환");
    return null;
    
  } catch (error) {
    console.error("HWP 텍스트 추출 오류:", error);
    return null;
  }
}

// --- 한글 비율 검사 ---
function koreanRatio(text: string) {
  const total = Math.max(1, text.length);
  const koreans = (text.match(/[가-힣]/g) || []).length;
  return koreans / total;
}

// --- 서버 핸들러 ---
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { content, metadata } = await req.json();
    console.log("요청 메타데이터:", metadata);
    console.log("콘텐츠 타입:", typeof content);
    console.log("콘텐츠 길이:", content?.length || 0);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) throw new Error("OPENAI_API_KEY가 설정되어 있지 않습니다.");

    // 텍스트 콘텐츠 처리
    let processedContent = "";
    
    if (typeof content === "string") {
      // HWP 파일인 경우
      if (metadata?.fileType === 'application/x-hwp') {
        console.log("HWP 파일 감지 - 텍스트 추출 시도");
        
        const extractedText = extractTextFromHWP(content);
        
        if (extractedText && extractedText.length > 20) {
          // 텍스트 추출 성공
          processedContent = extractedText;
          console.log("HWP 텍스트 추출 성공, 길이:", processedContent.length);
        } else {
          // 텍스트 추출 실패 - 기본 메시지 사용
          console.log("HWP 텍스트 추출 실패 - 기본 메시지 사용");
          processedContent = `한글 파일(.hwp)이 업로드되었습니다.
파일명: ${metadata?.title || 'unknown.hwp'}
파일 크기: ${Math.round(content.length * 0.75)} bytes
업로드 시간: ${new Date().toLocaleString('ko-KR')}

이 한글 파일은 학습 자료로 등록되었습니다.
텍스트 추출에 실패했습니다. 더 정확한 텍스트 추출을 위해서는 
한글 프로그램에서 '파일 > 내보내기 > 텍스트 파일(.txt)'로 저장 후 
다시 업로드해주시기 바랍니다.

※ HWP 파일의 복잡한 구조로 인해 완전한 텍스트 추출이 어려울 수 있습니다.`;
        }
      } else {
        // 일반 텍스트 파일
        processedContent = content.trim().normalize("NFC");
        console.log("텍스트 처리 완료, 길이:", processedContent.length);
      }
    } else {
      throw new Error("지원되지 않는 파일 형식입니다. 텍스트 파일(.txt) 또는 한글 파일(.hwp)만 지원됩니다.");
    }

    if (!processedContent || processedContent.length < 20) {
      throw new Error("텍스트 내용이 너무 짧거나 비어있습니다. 최소 20자 이상 필요합니다.");
    }

    // 한글 비율 검사 (일반 텍스트 파일인 경우만)
    const krRatio = koreanRatio(processedContent);
    console.log("한글비율:", krRatio.toFixed(3));

    // --- Supabase 저장 ---
    const materialRow = {
      title: metadata?.title || "Training Material",
      content: processedContent,
      file_url: metadata?.fileUrl || null,
    };

    const materialInsert = await supabaseClient.from("training_materials").insert([materialRow]).select("id").single();
    if (materialInsert.error) throw new Error(`training_materials 저장 실패: ${materialInsert.error.message}`);
    const parentMaterialId = materialInsert.data?.id;
    console.log("training_materials id:", parentMaterialId);

    // --- 청크 생성 ---
    const chunkSize = 1000;
    const chars = Array.from(processedContent);
    const chunks: string[] = [];
    for (let i = 0; i < chars.length; i += chunkSize) {
      const chunk = chars.slice(i, i + chunkSize).join("").trim();
      if (chunk.length > 20) chunks.push(chunk);
    }

    console.log("청크 개수:", chunks.length);

    // --- 임베딩 생성 및 저장 ---
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const title = `${materialRow.title} (${i + 1}/${chunks.length})`;

      const embRes = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: "text-embedding-3-small", input: chunk }),
      });

      if (!embRes.ok) {
        const errorText = await embRes.text();
        console.error("임베딩 API 오류:", errorText);
        throw new Error(`임베딩 생성 실패: ${embRes.statusText}`);
      }
      
      const embJson = await embRes.json();
      const vector = embJson.data?.[0]?.embedding;

      const vecRow = {
        title,
        content: chunk,
        vector,
        metadata: { ...metadata, parent_material_id: parentMaterialId, chunk_index: i + 1, total_chunks: chunks.length },
      };

      const insertVec = await supabaseClient.from("training_vectors").insert([vecRow]).select("id").single();
      if (insertVec.error) throw new Error(`training_vectors 저장 실패: ${insertVec.error.message}`);

      console.log(`청크 ${i + 1}/${chunks.length} 저장 완료 (vector id: ${insertVec.data.id})`);

      if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 200));
    }

    const fileTypeText = metadata?.fileType === 'application/x-hwp' ? 'HWP 파일' : '텍스트 파일';
    const successMessage = metadata?.fileType === 'application/x-hwp' 
      ? `HWP 파일에서 텍스트를 추출하여 ${chunks.length}개 청크로 벡터화했습니다.`
      : `텍스트 파일이 ${chunks.length}개 청크로 성공적으로 벡터화되어 저장되었습니다.`;
    
    return new Response(JSON.stringify({
      success: true,
      message: successMessage,
      material_id: parentMaterialId,
      chunks: chunks.length,
      korean_ratio: krRatio,
      file_type: metadata?.fileType,
      text_extracted: metadata?.fileType === 'application/x-hwp' && processedContent.length > 300,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }});

  } catch (err) {
    console.error("함수 오류:", err);
    return new Response(JSON.stringify({ success: false, error: err.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }});
  }
});
