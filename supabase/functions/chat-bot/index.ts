import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // 1. 사용자 질문을 벡터화
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
        body: JSON.stringify({
          model: 'text-embedding-ada-002',
          input: message
        }),
    });

    if (!embeddingResponse.ok) {
      throw new Error('벡터화 실패');
    }

    const embeddingData = await embeddingResponse.json();
    const queryVector = embeddingData.data[0].embedding;
    
    console.log('질문 벡터화 완료', {
      vectorLength: queryVector.length,
      firstFewValues: queryVector.slice(0, 5)
    });

    // 2. 교육자료에서 검색 (항상 수행) - 엄격한 임계값 사용
    console.log('교육자료 검색 시작');
    
    const { data: similarTraining, error: trainingError } = await supabaseClient.rpc('match_training_materials', {
      query_embedding: queryVector,
      match_threshold: 0.6,  // 임계값 상향 조정
      match_count: 5
    });

    if (trainingError) {
      console.error('교육자료 검색 오류:', trainingError);
    }
    
    // 임계값 없이 직접 테스트
    console.log('직접 벡터 검색 테스트 시작');
    const { data: directTest, error: directError } = await supabaseClient
      .from('training_vectors')
      .select('id, title, content')
      .limit(5);
      
    if (directError) {
      console.error('직접 검색 오류:', directError);
    } else {
      console.log('직접 검색 결과:', { count: directTest?.length || 0 });
    }
    
    console.log('교육자료 원시 검색 결과:', {
      searchParams: { threshold: 0.1, count: 10 },
      resultCount: similarTraining?.length || 0,
      hasError: !!trainingError,
      errorDetails: trainingError,
      results: similarTraining?.map(item => ({
        id: item.id,
        title: item.title?.substring(0, 50),
        similarity: item.similarity,
        contentPreview: item.content?.substring(0, 100)
      })) || []
    });

    console.log('교육자료 검색 결과:', { 
      training: similarTraining?.length || 0,
      trainingData: similarTraining?.map(t => ({ title: t.title, similarity: t.similarity })) || []
    });

    // 3. 유사민원 검색 (토글이 ON일 때만)
    let similarComplaints = [];
    if (includeComplaintCases) {
      const { data: complaints, error: complaintsError } = await supabaseClient.rpc('match_civil_complaints', {
        query_embedding: queryVector,
        match_threshold: 0.8,
        match_count: 3
      });
      
      similarComplaints = complaints || [];
      console.log('유사민원 검색 결과:', { 
        complaints: similarComplaints.length 
      });
    }

    // 4. 교육자료가 없을 때 처리
    if (!similarTraining || similarTraining.length === 0) {
      // 토글이 ON이고 유사민원이 있을 때만 civil complaints 참고
      if (includeComplaintCases && similarComplaints && similarComplaints.length > 0) {
        // AI가 유사민원 조치내용을 정리해서 설명하도록 요청
        const civilContext = similarComplaints.map((complaint, index) => {
          const metadata = complaint.metadata || {};
          return `민원사례 ${index + 1}: ${complaint.content} (처리부서: ${metadata.department || '해당부서'})`;
        }).join('\n\n');

        const systemPromptForCivil = `당신은 당진시청 당직근무 지원 AI 어시스턴트입니다. 
        
교육자료에는 관련 매뉴얼이 없지만, 다음의 유사한 민원사례들을 바탕으로 예상 처리방법을 안내해드리겠습니다:

${civilContext}

다음 형식으로 답변해주세요:

확인이 필요합니다. 해당 사안에 대한 구체적인 처리 절차는 교육자료에 명시되어 있지 않습니다.

다만, 유사한 민원사례를 참고하면 다음과 같은 처리가 예상됩니다:

**예상 처리 방법:**
[유사민원들의 조치내용을 종합하여 예상되는 처리방법을 단계별로 설명]
- 처리 부서: [주로 처리하는 부서명]
- 처리 절차: [구체적인 절차]

※ 정확한 처리 방법은 담당 부서에 문의하시기 바랍니다.

답변 시 주의사항:
- 유사민원 사례들의 조치내용을 종합하여 예상되는 일반적인 처리방법으로 정리하세요
- "예상됩니다", "~로 보입니다" 등의 표현을 사용하여 확정적이지 않음을 명시하세요
- 구체적이고 실용적인 처리절차를 제시하되, 담당 부서 확인이 필요함을 안내하세요`;

        const civilResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            max_tokens: 600,
          }),
        });

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
      
      // 교육자료가 없을 때는 항상 "관련 매뉴얼이 없다"고 답변
      return new Response(JSON.stringify({ 
        reply: "죄송합니다. 관련된 민원 매뉴얼이 없습니다.\n\n직접 관련 부서에 문의하시거나 당직실로 연락해주세요.",
        similarComplaints: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. 찾은 데이터를 바탕으로 컨텍스트 구성
    let trainingContext = '';
    let complaintCases = '';
    
    // 교육자료에서 처리방법 정보 추출
    if (similarTraining && similarTraining.length > 0) {
      trainingContext = '\n\n=== 교육자료 기반 처리방법 ===\n';
      similarTraining.forEach((training, index) => {
        trainingContext += `${index + 1}. ${training.title}\n`;
        trainingContext += `내용: ${training.content.substring(0, 200)}...\n\n`;
      });
    }
    
    // 유사 민원 사례 정보 (토글이 ON일 때만)
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

    // 6. 당직 정보 추가 (전화번호 제외)
    let dutyInfo = '';
    if (context && !context.includes('전화') && !context.includes('연락처')) {
      dutyInfo = `\n\n=== 현재 당직 정보 ===\n${context}`;
    }

    // 7. AI에게 답변 요청
    const systemPrompt = `당신은 당진시청 당직근무 지원 AI 어시스턴트입니다. 
사용자의 질문에 대해 다음과 같은 형식으로 답변해주세요:

**처리방법:**
- 제공된 교육자료에 명시된 내용만을 바탕으로 구체적인 처리 절차를 단계별로 설명하세요
- 교육자료에 없는 내용은 절대 추측하거나 일반적인 지식으로 답변하지 마세요

${includeComplaintCases && similarComplaints && similarComplaints.length > 0 ? 
`**참고 사례:**
총 ${similarComplaints.length}건의 유사한 민원사례가 있습니다. 상세 내용은 아래 버튼을 클릭하여 확인하실 수 있습니다.` : ''}

답변 시 주의사항:
- 전화번호나 연락처는 절대 언급하지 마세요
- 교육자료에 명시된 내용만을 바탕으로 답변하세요. 추측이나 일반적인 지식은 사용하지 마세요
- 교육자료에 부분적으로만 관련된 내용이 있다면, "확인이 필요합니다"라고 표현하세요
${includeComplaintCases ? '- 참고 사례 부분에는 JSON 데이터나 구체적인 민원 내용을 포함하지 마세요' : ''}
- 확실하지 않은 내용은 "확인이 필요합니다"라고 표현하세요
- 친절하고 공손한 어조를 유지하세요

제공된 정보:${trainingContext}${includeComplaintCases ? complaintCases : ''}${dutyInfo}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `질문: ${message}` }
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API 오류: ${response.status}`);
    }

    const data = await response.json();
    const reply = data.choices[0].message.content;

    console.log('AI 답변 생성 완료');

    // 응답 반환 (토글이 ON일 때만 유사민원 포함)
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