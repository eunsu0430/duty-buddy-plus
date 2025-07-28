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
    const { content, metadata } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openaiApiKey) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다.');
    }

    console.log('Processing civil complaints data for vectorization:', metadata?.title);

    // Generate embeddings using OpenAI
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: content
      }),
    });

    if (!embeddingResponse.ok) {
      throw new Error(`OpenAI API 오류: ${embeddingResponse.statusText}`);
    }

    const embeddingData = await embeddingResponse.json();
    const vector = embeddingData.data[0].embedding;

    // Store the civil complaints data with vector embeddings
    const { data, error } = await supabaseClient
      .from('civil_complaints_vectors')
      .insert([{
        title: metadata?.title || 'Civil Complaints Data',
        content: content,
        vector: vector,
        metadata: metadata || {}
      }]);

    if (error) {
      console.error('Error storing civil complaints data:', error);
      throw error;
    }

    console.log('Civil complaints data vectorized and stored successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      message: '민원데이터가 성공적으로 벡터화되어 저장되었습니다.' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in vectorize-civil-complaints function:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || '민원데이터 처리 중 오류가 발생했습니다.' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});