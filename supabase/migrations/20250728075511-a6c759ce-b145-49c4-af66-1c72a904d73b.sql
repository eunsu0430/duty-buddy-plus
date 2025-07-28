-- Create vector similarity search functions for civil complaints
CREATE OR REPLACE FUNCTION match_civil_complaints(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  content text,
  title text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    civil_complaints_vectors.id,
    civil_complaints_vectors.content,
    civil_complaints_vectors.title,
    civil_complaints_vectors.metadata,
    1 - (civil_complaints_vectors.vector <=> query_embedding) AS similarity
  FROM civil_complaints_vectors
  WHERE 1 - (civil_complaints_vectors.vector <=> query_embedding) > match_threshold
  ORDER BY civil_complaints_vectors.vector <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create vector similarity search functions for training materials
CREATE OR REPLACE FUNCTION match_training_materials(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  content text,
  title text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    training_vectors.id,
    training_vectors.content,
    training_vectors.title,
    training_vectors.metadata,
    1 - (training_vectors.vector <=> query_embedding) AS similarity
  FROM training_vectors
  WHERE 1 - (training_vectors.vector <=> query_embedding) > match_threshold
  ORDER BY training_vectors.vector <=> query_embedding
  LIMIT match_count;
END;
$$;