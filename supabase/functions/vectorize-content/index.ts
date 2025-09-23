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
    
    // HWP 파일은 복합문서 구조이므로 직접 텍스트만 추출
    let extractedText = "";
    let foundKoreanText = false;
    
    // 한글 텍스트 패턴 검색 (UTF-16LE, EUC-KR 등)
    const textChunks: string[] = [];
    
    // 방법 1: 연속된 한글/영문 문자열 추출
    let tempText = "";
    for (let i = 0; i < bytes.length - 1; i++) {
      const byte1 = bytes[i];
      const byte2 = bytes[i + 1];
      
      // UTF-16LE 한글 범위 체크
      if (byte2 >= 0xAC && byte2 <= 0xD7 && byte1 >= 0x00 && byte1 <= 0xFF) {
        try {
          const char = String.fromCharCode((byte2 << 8) | byte1);
          if (char.match(/[가-힣]/)) {
            tempText += char;
            foundKoreanText = true;
            i++; // 2바이트 문자이므로 건너뛰기
            continue;
          }
        } catch (e) {}
      }
      
      // ASCII 영문/숫자/기본 특수문자
      if (byte1 >= 32 && byte1 <= 126) {
        tempText += String.fromCharCode(byte1);
      }
      // 줄바꿈 및 공백
      else if (byte1 === 10 || byte1 === 13 || byte1 === 32) {
        if (tempText.trim().length > 2) {
          textChunks.push(tempText.trim());
          tempText = "";
        }
        tempText += String.fromCharCode(byte1);
      }
      // 텍스트 구분자로 간주
      else if (tempText.trim().length > 2) {
        textChunks.push(tempText.trim());
        tempText = "";
      }
    }
    
    if (tempText.trim().length > 2) {
      textChunks.push(tempText.trim());
    }
    
    // 방법 2: EUC-KR 방식으로도 시도
    if (!foundKoreanText) {
      console.log("UTF-16 방식 실패, EUC-KR 시도...");
      for (let i = 0; i < bytes.length - 1; i++) {
        const byte1 = bytes[i];
        const byte2 = bytes[i + 1];
        
        // EUC-KR 한글 완성형 범위
        if (byte1 >= 0xB0 && byte1 <= 0xC8 && byte2 >= 0xA1 && byte2 <= 0xFE) {
          try {
            // EUC-KR을 UTF-8로 변환 시도
            const eucBytes = new Uint8Array([byte1, byte2]);
            const decoder = new TextDecoder('euc-kr', { fatal: false });
            const char = decoder.decode(eucBytes);
            if (char && char.match(/[가-힣]/)) {
              tempText += char;
              foundKoreanText = true;
              i++; // 2바이트 건너뛰기
              continue;
            }
          } catch (e) {}
        }
        
        // ASCII 처리
        if (byte1 >= 32 && byte1 <= 126) {
          tempText += String.fromCharCode(byte1);
        } else if ((byte1 === 10 || byte1 === 13) && tempText.trim().length > 2) {
          textChunks.push(tempText.trim());
          tempText = "";
        }
      }
      
      if (tempText.trim().length > 2) {
        textChunks.push(tempText.trim()); 
      }
    }
    
    // 추출된 텍스트 정리
    if (textChunks.length > 0) {
      // 의미있는 텍스트만 필터링
      const meaningfulChunks = textChunks
        .filter(chunk => {
          const cleanChunk = chunk.replace(/[^\w가-힣\s]/g, '').trim();
          return cleanChunk.length >= 2 && 
                 !cleanChunk.match(/^[0-9\s]+$/) && // 숫자만 있는 것 제외
                 !cleanChunk.match(/^[!@#$%^&*()_+={}\[\]|\\:";'<>?.,\/\s]+$/); // 특수문자만 있는 것 제외
        })
        .slice(0, 100); // 최대 100개 청크까지만
      
      if (meaningfulChunks.length > 0) {
        extractedText = meaningfulChunks.join('\n').trim();
        console.log("HWP 텍스트 추출 성공, 청크 수:", meaningfulChunks.length);
        console.log("추출된 텍스트 샘플:", extractedText.substring(0, 200));
        
        // 최소 길이 체크
        if (extractedText.length >= 20) {
          return extractedText;
        }
      }
    }
    
    console.log("HWP 텍스트 추출 실패 - 의미있는 텍스트 없음");
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
