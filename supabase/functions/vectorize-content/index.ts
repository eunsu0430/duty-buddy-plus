// --- 필요한 모듈 임포트 ---
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://eextractPDFTextLocallysm.sh/@supabase/supabase-js@2.7.1";
// pdf.js (esm.sh 경유 - 러버블 호환)
import * as pdfjsLib from "https://esm.sh/pdfjs-dist@4.0.269/es5/build/pdf.js";

// --- CORS 헤더 ---
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// PDF 텍스트 추출 함수
export async function extractPDFTextLocally(base64Content: string): Promise<{ text: string; pages: number }> {
  console.log("PDF 텍스트 추출 시작...");

  // base64 → Uint8Array 변환
  const cleanBase64 = base64Content.includes(",") ? base64Content.split(",")[1] : base64Content;
  const pdfData = Uint8Array.from(atob(cleanBase64), (c) => c.charCodeAt(0));

  // PDF 로딩
  const loadingTask = pdfjsLib.getDocument({ data: pdfData });
  const pdf = await loadingTask.promise;

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(" ");
    fullText += `\n\n[Page ${i}]\n${pageText}`;
  }

  console.log("PDF 텍스트 추출 완료, 페이지 수:", pdf.numPages);
  return { text: fullText.trim(), pages: pdf.numPages };
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

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) throw new Error("OPENAI_API_KEY가 설정되어 있지 않습니다.");

    let processedContent = "";
    let pageCount = 0;

    // PDF 처리
    if (typeof content === "string" && metadata?.fileType === "application/pdf") {
      const { text, pages } = await extractPDFTextLocally(content);
      processedContent = text;
      pageCount = pages;
    } else if (typeof content === "string") {
      processedContent = content.trim().normalize("NFC");
    }

    if (!processedContent || processedContent.length < 20) {
      throw new Error("텍스트 추출 실패 또는 콘텐츠가 너무 짧습니다.");
    }

    // 한글 비율 검사
    const krRatio = koreanRatio(processedContent);
    console.log("한글비율:", krRatio.toFixed(3));

    if ((metadata?.expectedLanguage === "ko" || (metadata?.title || "").includes("당직")) && krRatio < 0.02) {
      return new Response(JSON.stringify({
        success: false,
        error: "텍스트 추출 시 한글 비율이 낮습니다. 이 파일은 스캔본(PDF 이미지)일 가능성이 높습니다. OCR 처리가 필요합니다.",
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" }});
    }

    // --- Supabase 저장 ---
    const materialRow = {
      title: metadata?.title || "Training Material",
      content: processedContent,
      file_url: metadata?.fileUrl || null,
    };

    const materialInsert = await supabaseClient.from("training_materials").insert([materialRow]).select("id").single();
    if (materialInsert.error) throw new Error(`training_materials 저장 실패: ${materialInsert.error.message}`);
    const parentMaterialId = materialInsert.data?.id;

    // --- 청크 생성 ---
    const chunkSize = 1000;
    const chars = Array.from(processedContent);
    const chunks: string[] = [];
    for (let i = 0; i < chars.length; i += chunkSize) {
      const chunk = chars.slice(i, i + chunkSize).join("").trim();
      if (chunk.length > 20) chunks.push(chunk);
    }

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

      if (!embRes.ok) throw new Error("임베딩 생성 실패");
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

      if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 200));
    }

    return new Response(JSON.stringify({
      success: true,
      message: `원본은 1건 저장되고, 임베딩은 ${chunks.length}개 청크로 저장되었습니다.`,
      material_id: parentMaterialId,
      chunks: chunks.length,
      pages: pageCount,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }});

  } catch (err) {
    console.error("함수 오류:", err);
    return new Response(JSON.stringify({ success: false, error: err.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }});
  }
});
