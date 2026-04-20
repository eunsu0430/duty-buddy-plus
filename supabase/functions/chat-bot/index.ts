import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ===== OpenAI 호출용 재시도 헬퍼 =====
// 429(Too Many Requests), 500/502/503/504(서버 일시 오류), 네트워크 에러 발생 시
// 지수 백오프 + 약간의 jitter 로 최대 3회까지 재시도합니다.
async function fetchOpenAIWithRetry(
  url: string,
  init: RequestInit,
  label: string,
  maxAttempts = 3
): Promise<Response> {
  let lastErr: any = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, init);

      // 성공
      if (res.ok) return res;

      // 재시도 가능한 상태코드인지 판별
      const retryable = res.status === 429 || (res.status >= 500 && res.status < 600);
      if (!retryable || attempt === maxAttempts) {
        return res; // 더 이상 재시도 안 함 → 호출자가 처리
      }

      // Retry-After 헤더가 있으면 우선 사용
      const retryAfter = res.headers.get('retry-after');
      let waitMs = retryAfter ? Math.min(parseFloat(retryAfter) * 1000, 5000) : 0;
      if (!waitMs) {
        // 지수 백오프: 800ms, 1600ms, 3200ms (+ 0~400ms jitter)
        waitMs = Math.min(800 * Math.pow(2, attempt - 1), 4000) + Math.floor(Math.random() * 400);
      }
      console.log(`[${label}] ${res.status} 발생 - ${waitMs}ms 후 재시도 (${attempt}/${maxAttempts})`);
      await new Promise(r => setTimeout(r, waitMs));
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts) throw err;
      const waitMs = 800 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 400);
      console.log(`[${label}] 네트워크 에러 - ${waitMs}ms 후 재시도 (${attempt}/${maxAttempts}):`, err);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
  throw lastErr || new Error(`[${label}] 재시도 모두 실패`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, context, includeComplaintCases } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    console.log('질문 받음:', message);

    // 1. 사용자 질문을 벡터화 (재시도 로직 적용)
    const embeddingResponse = await fetchOpenAIWithRetry(
      'https://api.openai.com/v1/embeddings',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-ada-002',
          input: message
        }),
      },
      'embeddings'
    );

    if (!embeddingResponse.ok) {
      throw new Error(`임베딩 API 오류: ${embeddingResponse.status}`);
    }

    const embeddingData = await embeddingResponse.json();
    const queryVector = embeddingData.data[0].embedding;

    // 2 + 3. 교육자료 검색 & 유사민원 검색을 동시에 실행 (병렬화)
    console.log('교육자료/유사민원 병렬 검색 시작');

    const trainingPromise = supabaseClient.rpc('match_training_materials', {
      query_embedding: queryVector,
      match_threshold: 0.75,
      match_count: 5
    });

    const complaintsPromise = includeComplaintCases
      ? supabaseClient.rpc('match_civil_complaints', {
          query_embedding: queryVector,
          match_threshold: 0.8,
          match_count: 3
        })
      : Promise.resolve({ data: [], error: null });

    const [
      { data: similarTraining, error: trainingError },
      { data: rawComplaints, error: complaintsError }
    ] = await Promise.all([trainingPromise, complaintsPromise]);

    if (trainingError) console.error('교육자료 검색 오류:', trainingError);
    if (complaintsError) console.error('유사민원 검색 오류:', complaintsError);

    console.log('교육자료 검색 결과:', {
      training: similarTraining?.length || 0,
      trainingData: similarTraining?.map(t => ({ title: t.title, similarity: t.similarity })) || []
    });

    // 2-1. 인접 청크 가져오기 (같은 문서의 앞뒤 청크를 함께 가져와서 맥락 보강)
    let enrichedTraining = similarTraining || [];
    if (similarTraining && similarTraining.length > 0) {
      const parentIds = new Set<string>();
      const chunkIndices = new Map<string, number[]>();
      
      for (const item of similarTraining) {
        const meta = item.metadata as any;
        if (meta?.parent_material_id) {
          parentIds.add(meta.parent_material_id);
          const key = meta.parent_material_id;
          if (!chunkIndices.has(key)) chunkIndices.set(key, []);
          chunkIndices.get(key)!.push(meta.chunk_index);
        }
      }

      // 인접 청크 인덱스 계산
      const adjacentNeeded: { parentId: string; indices: number[] }[] = [];
      for (const [parentId, indices] of chunkIndices) {
        const adjacent = new Set<number>();
        for (const idx of indices) {
          adjacent.add(idx - 1);
          adjacent.add(idx);
          adjacent.add(idx + 1);
        }
        // 이미 가져온 인덱스 제거
        for (const idx of indices) adjacent.delete(idx);
        adjacent.delete(0); // 0은 유효하지 않음
        if (adjacent.size > 0) {
          adjacentNeeded.push({ parentId, indices: Array.from(adjacent) });
        }
      }

      // 인접 청크 검색 (여러 parentId를 병렬로 조회)
      if (adjacentNeeded.length > 0) {
        const adjacentResults = await Promise.all(
          adjacentNeeded.map(({ parentId, indices }) =>
            supabaseClient
              .from('training_vectors')
              .select('id, content, title, metadata')
              .filter('metadata->>parent_material_id', 'eq', parentId)
              .in('metadata->>chunk_index', indices.map(String))
          )
        );

        for (const { data: adjacentChunks } of adjacentResults) {
          if (adjacentChunks) {
            for (const adj of adjacentChunks) {
              // 중복 방지
              if (!enrichedTraining.find(t => t.id === adj.id)) {
                enrichedTraining.push({ ...adj, similarity: 0.65 });
              }
            }
          }
        }
        
        // chunk_index 순으로 정렬 (같은 문서끼리 순서대로)
        enrichedTraining.sort((a, b) => {
          const metaA = (a.metadata as any) || {};
          const metaB = (b.metadata as any) || {};
          const parentA = metaA.parent_material_id || '';
          const parentB = metaB.parent_material_id || '';
          if (parentA !== parentB) return parentA.localeCompare(parentB);
          return (metaA.chunk_index || 0) - (metaB.chunk_index || 0);
        });

        console.log('인접 청크 포함 총 교육자료:', enrichedTraining.length);
      }
    }

    // 3. 유사민원 가중치 적용 (이미 병렬로 가져옴)
    let similarComplaints: any[] = [];
    if (includeComplaintCases) {
      const now = new Date();
      similarComplaints = (rawComplaints || []).map((c: any) => {
        const meta = c.metadata || {};
        const dateStr = meta.date || meta.registration_date || '';
        let recencyBonus = 0;
        if (dateStr) {
          const complaintDate = new Date(dateStr);
          const daysDiff = (now.getTime() - complaintDate.getTime()) / (1000 * 60 * 60 * 24);
          if (daysDiff <= 180) recencyBonus = 0.1;
          else if (daysDiff <= 365) recencyBonus = 0.06;
          else if (daysDiff <= 1095) recencyBonus = 0.03;
        }
        return { ...c, similarity: Math.min(c.similarity + recencyBonus, 1.0) };
      }).sort((a: any, b: any) => b.similarity - a.similarity);

      console.log('유사민원 검색 결과 (가중치 적용):', { complaints: similarComplaints.length });
    }

    // 4. 교육자료가 없을 때 처리
    if (!enrichedTraining || enrichedTraining.length === 0) {
      if (includeComplaintCases && similarComplaints && similarComplaints.length > 0) {
        const civilContext = similarComplaints.map((complaint, index) => {
          const metadata = complaint.metadata || {};
          return `민원사례 ${index + 1}: ${complaint.content} (처리부서: ${metadata.department || '해당부서'})`;
        }).join('\n\n');

        const systemPromptForCivil = `당신은 당진시청 당직근무 지원 AI 어시스턴트입니다. 
        
교육자료에는 관련 매뉴얼이 없지만, 다음의 유사한 민원사례들을 바탕으로 처리방법을 정리해서 설명해주세요:

${civilContext}

**반드시 다음 형식으로 답변해주세요:**

📋 **관련 매뉴얼**
죄송합니다. 해당 사안에 대한 공식 교육자료나 매뉴얼이 없습니다.

📝 **유사민원 기반 예상 처리절차**

유사한 민원사례들을 분석한 결과, 다음과 같은 처리절차가 예상됩니다:

**1단계: 접수 및 초기 대응**
• [구체적으로 설명]

**2단계: 주관부서 이관 및 처리**
• [담당 부서와 처리 방법]

**3단계: 후속 조치 및 완료**
• [최종 처리 방법]

⚠️ **중요 안내사항**
• 위 내용은 유사민원 사례를 바탕으로 한 예상 처리절차입니다
• 실제 처리는 담당부서의 판단에 따라 달라질 수 있습니다

**답변 작성 시 필수 요구사항:**
- 반드시 3단계 이상으로 구조화하여 작성하세요
- 각 단계마다 최소 2개 이상의 구체적인 세부 항목을 포함하세요
- 유사민원의 처리부서, 조치내용을 종합적으로 분석하여 실용적인 가이드를 제공하세요
- 최소 150자 이상의 상세한 설명을 작성하세요`;

        const civilResponse = await fetchOpenAIWithRetry(
          'https://api.openai.com/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openAIApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: systemPromptForCivil },
                { role: 'user', content: `질문: ${message}` }
              ],
              temperature: 0.3,
              max_tokens: 1000,
            }),
          },
          'chat-civil-only'
        );

        if (civilResponse.ok) {
          const civilData = await civilResponse.json();
          const civilReply = civilData.choices[0].message.content;
          
          return new Response(JSON.stringify({ 
            reply: civilReply,
            similarComplaints: similarComplaints
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      
      return new Response(JSON.stringify({ 
        reply: "죄송합니다. 관련된 민원 매뉴얼이 없습니다.\n\n직접 관련 부서에 문의하시거나 당직실로 연락해주세요.",
        similarComplaints: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. 찾은 데이터를 바탕으로 컨텍스트 구성 - 순서대로 연결
    let trainingContext = '';
    let complaintCases = '';
    
    if (enrichedTraining && enrichedTraining.length > 0) {
      trainingContext = '\n\n=== 교육자료 원문 ===\n';
      enrichedTraining.forEach((training, index) => {
        trainingContext += `--- 교육자료 ${index + 1}: ${training.title} (유사도: ${((training.similarity || 0) * 100).toFixed(0)}%) ---\n`;
        trainingContext += `${training.content}\n\n`;
      });
    }
    
    if (includeComplaintCases && similarComplaints && similarComplaints.length > 0) {
      complaintCases = '\n\n=== 유사민원사례 ===\n';
      similarComplaints.forEach((complaint, index) => {
        const metadata = complaint.metadata || {};
        complaintCases += `${index + 1}. 유사민원사례\n`;
        complaintCases += `민원번호: ${metadata.serialNumber || '정보없음'}\n`;
        complaintCases += `내용: ${complaint.content.substring(0, 150)}...\n`;
        complaintCases += `처리부서: ${metadata.department || '정보없음'}\n`;
        complaintCases += `처리상태: ${metadata.status || '정보없음'}\n`;
        complaintCases += `날짜: ${metadata.date || '정보없음'}\n`;
        complaintCases += `유사도: ${(complaint.similarity * 100).toFixed(1)}%\n\n`;
      });
    }

    // 6. 당직 정보 추가
    let dutyInfo = '';
    if (context && !context.includes('전화') && !context.includes('연락처')) {
      dutyInfo = `\n\n=== 현재 당직 정보 ===\n${context}`;
    }

    // 7. AI에게 답변 요청
    const systemPrompt = `당신은 당진시청 당직근무 지원 AI 어시스턴트입니다.

**핵심 원칙: 교육자료(매뉴얼) 원문의 내용을 정확히 기반으로 하되, 당직자가 빠르게 이해하고 행동할 수 있도록 보기 쉽게 정리하여 답변하세요!**

답변 방식:
1. 아래 제공된 교육자료 원문에서 질문과 관련된 부분을 찾으세요
2. 찾은 내용의 **사실과 정보는 정확히 유지**하되, 핵심을 요약하고 구조화하여 읽기 쉽게 정리하세요
3. 교육자료에서 관련 내용을 찾을 수 없으면, 반드시 "관련 교육자료를 찾을 수 없습니다."라고 답변하세요
4. 절대로 매뉴얼에 없는 내용을 지어내거나 추측하지 마세요

**정리 규칙:**
- 긴 문장은 **핵심 포인트별로 나누어** 글머리 기호(•)나 번호로 정리하세요
- 처리 절차가 있으면 반드시 **번호를 매겨 순서대로** 단계별 설명하세요
- 각 단계마다 **"→ 이렇게 하세요:"** 형태로 구체적 행동 지침을 덧붙이세요
- 중요한 키워드나 주의사항은 **굵은 글씨**로 강조하세요
- 매뉴얼에 전화번호, 연락처가 있으면 **반드시 그대로 포함**하세요 (공식 업무 연락처입니다)
- 담당 부서명, 담당자 직위 등도 매뉴얼에 있는 그대로 포함하세요

**답변 구조:**

📋 **요약**
[질문에 대한 핵심 답변을 1~2문장으로 먼저 요약]

📝 **상세 내용**
[매뉴얼 내용을 보기 쉽게 구조화하여 정리]

📞 **연락처 및 담당부서** (매뉴얼에 있는 경우)
[전화번호, 담당자, 부서명을 매뉴얼 그대로 기재]

⚠️ **주의사항** (매뉴얼에 있는 경우)
[특별히 주의할 점이나 예외사항]

${includeComplaintCases && similarComplaints && similarComplaints.length > 0 ? 
`**참고 사례:**
총 ${similarComplaints.length}건의 유사한 민원사례가 있습니다.` : ''}

답변 시 주의사항:
- 매뉴얼 원문의 **사실, 수치, 전화번호, 부서명은 절대 변경하지 마세요**
- 정리하되 정보를 누락하지 마세요. 특히 연락처와 절차는 빠짐없이 포함하세요
- 여러 교육자료 청크가 제공되면 같은 문서의 연속된 내용을 종합하여 답변하세요
${includeComplaintCases ? '- 참고 사례 부분에는 JSON 데이터나 구체적인 민원 내용을 포함하지 마세요' : ''}
- 친절하고 공손한 어조를 유지하세요
- 당직자가 바로 행동에 옮길 수 있도록 실용적으로 작성하세요

제공된 정보:${trainingContext}${includeComplaintCases ? complaintCases : ''}${dutyInfo}`;

    const response = await fetchOpenAIWithRetry(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `질문: ${message}` }
          ],
          temperature: 0.3,
          max_tokens: 1200,
        }),
      },
      'chat-main'
    );

    if (!response.ok) {
      throw new Error(`OpenAI API 오류: ${response.status}`);
    }

    const data = await response.json();
    const reply = data.choices[0].message.content;

    console.log('AI 답변 생성 완료');

    return new Response(JSON.stringify({ 
      reply,
      similarComplaints: includeComplaintCases ? (similarComplaints || []) : []
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('채팅봇 오류:', error);
    return new Response(JSON.stringify({ 
      error: '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
