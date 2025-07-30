-- 깨진 텍스트가 포함된 교육자료 데이터 삭제
DELETE FROM training_materials 
WHERE content LIKE 'd      G          W L%' 
   OR content LIKE '%cGD2  Q   Z 4  E%'
   OR length(content) > 0 AND content !~ '[가-힣a-zA-Z]{3,}';

-- 깨진 텍스트가 포함된 벡터 데이터 삭제  
DELETE FROM training_vectors 
WHERE content LIKE 'd      G          W L%' 
   OR content LIKE '%cGD2  Q   Z 4  E%'
   OR length(content) > 0 AND content !~ '[가-힣a-zA-Z]{3,}';