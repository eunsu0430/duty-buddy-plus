import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    console.log('OpenAI API 키 확인:', openaiApiKey ? 'API 키 존재함' : 'API 키 없음');
    if (!openaiApiKey) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다.');
    }

    // 요청에서 연도와 월을 가져오거나 기본값 설정 (전월)
    const { year, month } = await req.json().catch(() => ({}));
    
    const targetDate = new Date();
    const targetYear = year || targetDate.getFullYear();
    const targetMonth = month || (targetDate.getMonth() === 0 ? 12 : targetDate.getMonth());
    const actualYear = month === 12 && targetDate.getMonth() === 0 ? targetYear - 1 : targetYear;

    console.log(`${actualYear}년 ${targetMonth}월 민원 데이터 분석 시작`);

    // 해당 월의 민원 데이터 조회
    const startDate = new Date(actualYear, targetMonth - 1, 1);
    const endDate = new Date(actualYear, targetMonth, 0, 23, 59, 59);

    console.log(`분석 기간: ${startDate.toISOString()} ~ ${endDate.toISOString()}`);

    const { data: complaints, error: fetchError } = await supabaseClient
      .from('civil_complaints_data')
      .select('complaint_type, registration_info, processing_method')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (fetchError) {
      console.error('민원 데이터 조회 오류:', fetchError);
      throw fetchError;
    }

    if (!complaints || complaints.length === 0) {
      console.log('해당 월에 민원 데이터가 없습니다.');
      return new Response(JSON.stringify({ 
        success: true, 
        message: '해당 월에 분석할 민원 데이터가 없습니다.' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 민원 유형별 집계
    const typeCount: Record<string, any[]> = {};
    
    complaints.forEach(complaint => {
      const type = complaint.complaint_type || '기타';
      if (!typeCount[type]) {
        typeCount[type] = [];
      }
      typeCount[type].push(complaint);
    });

    // 상위 5개 유형 선별
    const sortedTypes = Object.entries(typeCount)
      .sort(([,a], [,b]) => b.length - a.length)
      .slice(0, 5);

    console.log(`상위 5개 민원 유형:`, sortedTypes.map(([type, complaints]) => `${type}: ${complaints.length}건`));

    // 기존 월별 데이터 삭제
    const { error: deleteError } = await supabaseClient
      .from('monthly_frequent_complaints')
      .delete()
      .eq('year', actualYear)
      .eq('month', targetMonth);

    if (deleteError) {
      console.error('기존 데이터 삭제 오류:', deleteError);
    }

    // 각 유형별로 유사 민원 찾기 및 저장
    const insertData = [];
    
    for (let i = 0; i < sortedTypes.length; i++) {
      const [complaintType, typeComplaints] = sortedTypes[i];
      
      console.log(`${complaintType} 유형의 유사 민원 분석 중...`);
      
      // 해당 유형의 대표 민원으로 유사 민원 검색
      const sampleComplaint = typeComplaints[0];
      const searchQuery = `${complaintType} ${sampleComplaint.registration_info || ''}`.trim();
      
      try {
        // 임베딩 생성
        console.log(`임베딩 생성 중: ${searchQuery}`);
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-ada-002',
            input: searchQuery
          }),
        });

        if (embeddingResponse.ok) {
          const embeddingData = await embeddingResponse.json();
          const queryVector = embeddingData.data[0].embedding;
          console.log(`임베딩 생성 성공`);

          // 유사 민원 검색
          const { data: similarComplaints, error: searchError } = await supabaseClient
            .rpc('match_civil_complaints', {
              query_embedding: queryVector,
              match_threshold: 0.7,
              match_count: 10
            });

          console.log(`유사 민원 검색 결과: ${similarComplaints?.length || 0}개`);
          
          if (!searchError && similarComplaints && similarComplaints.length > 0) {
            insertData.push({
              year: actualYear,
              month: targetMonth,
              complaint_type: complaintType,
              count: typeComplaints.length,
              rank: i + 1,
              similar_complaints: similarComplaints.map(sc => ({
                id: sc.id,
                title: sc.title,
                content: sc.content.substring(0, 200),
                similarity: Math.round(sc.similarity * 100) / 100
              }))
            });
          } else {
            console.log(`유사 민원 검색 실패 또는 결과 없음: ${searchError?.message || '결과 없음'}`);
            insertData.push({
              year: actualYear,
              month: targetMonth,
              complaint_type: complaintType,
              count: typeComplaints.length,
              rank: i + 1,
              similar_complaints: []
            });
          }
        } else {
          console.log(`임베딩 생성 실패: ${embeddingResponse.status}`);
          insertData.push({
            year: actualYear,
            month: targetMonth,
            complaint_type: complaintType,
            count: typeComplaints.length,
            rank: i + 1,
            similar_complaints: []
          });
        }
      } catch (error) {
        console.error(`${complaintType} 유사 민원 검색 오류:`, error);
        // 오류가 있어도 기본 데이터는 저장
        insertData.push({
          year: actualYear,
          month: targetMonth,
          complaint_type: complaintType,
          count: typeComplaints.length,
          rank: i + 1,
          similar_complaints: []
        });
      }
    }

    // 데이터베이스에 저장
    const { error: insertError } = await supabaseClient
      .from('monthly_frequent_complaints')
      .insert(insertData);

    if (insertError) {
      console.error('데이터 저장 오류:', insertError);
      throw insertError;
    }

    console.log(`${actualYear}년 ${targetMonth}월 빈발 민원 분석 완료`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `${actualYear}년 ${targetMonth}월 빈발 민원 분석이 완료되었습니다.`,
      data: {
        year: actualYear,
        month: targetMonth,
        analyzed_complaints: complaints.length,
        top_types: insertData.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('월별 민원 분석 오류:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || '월별 민원 분석 중 오류가 발생했습니다.' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});