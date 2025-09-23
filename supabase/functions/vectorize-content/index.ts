// --- 필요한 모듈 임포트 ---
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

// --- CORS 헤더 ---
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      processedContent = content.trim().normalize("NFC");
      console.log("텍스트 처리 완료, 길이:", processedContent.length);
    } else {
      throw new Error("지원되지 않는 파일 형식입니다. 텍스트 파일(.txt)만 지원됩니다.");
    }

    if (!processedContent || processedContent.length < 20) {
      throw new Error("텍스트 내용이 너무 짧거나 비어있습니다. 최소 20자 이상 입력해주세요.");
    }

    // 한글 비율 검사 (한글 문서인 경우)
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

    return new Response(JSON.stringify({
      success: true,
      message: `텍스트가 ${chunks.length}개 청크로 성공적으로 벡터화되어 저장되었습니다.`,
      material_id: parentMaterialId,
      chunks: chunks.length,
      korean_ratio: krRatio,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }});

  } catch (err) {
    console.error("함수 오류:", err);
    return new Response(JSON.stringify({ success: false, error: err.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }});
  }
});
