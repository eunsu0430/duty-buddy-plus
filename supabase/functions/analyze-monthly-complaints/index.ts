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

    // 요청에서 연도와 월을 가져오거나 기본값 설정 (현재 월)
    const { year, month } = await req.json().catch(() => ({}));
    
    const targetDate = new Date();
    const targetYear = year || targetDate.getFullYear();
    const targetMonth = month || (targetDate.getMonth() + 1);

    console.log(`${targetYear}년 ${targetMonth}월 민원 데이터 분석 시작`);

    // 해당 월의 벡터 데이터 조회 (접수일자 기준)
    console.log(`${targetYear}년 ${targetMonth}월 접수 민원 데이터 분석 시작`);

    // 접수일자 기준으로 필터링 (metadata에서 접수일자 확인)
    const { data: monthlyVectors, error: vectorError } = await supabaseClient
      .from('civil_complaints_vectors')
      .select('*')
      .eq('metadata->>year', targetYear.toString())
      .eq('metadata->>month', targetMonth.toString());

    if (vectorError) {
      console.error('벡터 데이터 조회 오류:', vectorError);
      throw vectorError;
    }

    if (!monthlyVectors || monthlyVectors.length === 0) {
      console.log('해당 월에 벡터 데이터가 없습니다.');
      return new Response(JSON.stringify({ 
        success: true, 
        message: '해당 월에 분석할 벡터 데이터가 없습니다.' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 벡터 데이터를 유형별로 집계
    const typeCount: Record<string, any[]> = {};
    
    monthlyVectors.forEach(vector => {
      const content = vector.content.toLowerCase();
      let type = '기타';
      
      if (content.includes('도로') || content.includes('도로파손') || content.includes('반사경') || content.includes('교차로') || content.includes('도로과')) {
        type = '도로관련';
      } else if (content.includes('수도') || content.includes('누수') || content.includes('수도관') || content.includes('수도과') || content.includes('상수도')) {
        type = '수도관련';
      } else if (content.includes('동물') || content.includes('유기견') || content.includes('보호소') || content.includes('로드킬') || content.includes('개') || content.includes('고양이')) {
        type = '동물관련';
      } else if (content.includes('쓰레기') || content.includes('폐기물') || content.includes('환경') || content.includes('청소') || content.includes('분리수거')) {
        type = '환경/쓰레기';
      } else if (content.includes('주차') || content.includes('불법주차') || content.includes('차량') || content.includes('교통')) {
        type = '주차/교통';
      } else if (content.includes('소음') || content.includes('시끄러운') || content.includes('공사') || content.includes('시끄')) {
        type = '소음공해';
      } else if (content.includes('전기') || content.includes('가로등') || content.includes('조명') || content.includes('전등')) {
        type = '전기/조명';
      } else if (content.includes('문의') || content.includes('안내') || content.includes('신고') || content.includes('민원접수')) {
        type = '단순문의';
      }

      if (!typeCount[type]) {
        typeCount[type] = [];
      }
      typeCount[type].push(vector);
    });

    // 상위 5개 유형 선별
    const sortedTypes = Object.entries(typeCount)
      .sort(([,a], [,b]) => b.length - a.length)
      .slice(0, 5);

    console.log(`상위 5개 민원 유형:`, sortedTypes.map(([type, vectors]) => `${type}: ${vectors.length}건`));

    // 기존 월별 데이터 삭제
    const { error: deleteError } = await supabaseClient
      .from('monthly_frequent_complaints')
      .delete()
      .eq('year', targetYear)
      .eq('month', targetMonth);

    if (deleteError) {
      console.error('기존 데이터 삭제 오류:', deleteError);
    }

    // 각 유형별로 유사 민원 찾기 및 저장
    const insertData = [];
    
    for (let i = 0; i < sortedTypes.length; i++) {
      const [complaintType, typeVectors] = sortedTypes[i];
      
      console.log(`${complaintType} 유형의 유사 민원 분석 중...`);
      
      // 해당 유형의 대표 민원으로 유사 민원 검색
      const sampleVector = typeVectors[0];
      const searchQuery = `${complaintType} ${sampleVector.content || ''}`.trim();
      
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
              match_count: 5
            });

          console.log(`유사 민원 검색 결과: ${similarComplaints?.length || 0}개`);
          
          const insertRow: any = {
            year: targetYear,
            month: targetMonth,
            complaint_type: complaintType,
            count: typeVectors.length,
            rank: i + 1
          };

          // 유사 민원을 각각의 컬럼에 저장
          if (similarComplaints && similarComplaints.length > 0) {
            for (let j = 0; j < Math.min(5, similarComplaints.length); j++) {
              const complaint = similarComplaints[j];
              insertRow[`similar_complaint_${j + 1}`] = {
                id: complaint.id,
                title: complaint.title,
                content: complaint.content.substring(0, 200),
                similarity: Math.round(complaint.similarity * 100) / 100
              };
            }
          }

          insertData.push(insertRow);
        } else {
          console.log(`임베딩 생성 실패: ${embeddingResponse.status}`);
          insertData.push({
            year: targetYear,
            month: targetMonth,
            complaint_type: complaintType,
            count: typeVectors.length,
            rank: i + 1
          });
        }
      } catch (error) {
        console.error(`${complaintType} 유사 민원 검색 오류:`, error);
        // 오류가 있어도 기본 데이터는 저장
        insertData.push({
          year: targetYear,
          month: targetMonth,
          complaint_type: complaintType,
          count: typeVectors.length,
          rank: i + 1
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

    console.log(`${targetYear}년 ${targetMonth}월 빈발 민원 분석 완료`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `${targetYear}년 ${targetMonth}월 빈발 민원 분석이 완료되었습니다.`,
      data: {
        year: targetYear,
        month: targetMonth,
        analyzed_complaints: monthlyVectors.length,
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