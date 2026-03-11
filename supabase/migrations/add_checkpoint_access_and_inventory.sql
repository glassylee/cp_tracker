-- checkpoints 테이블에 access_password, inventory_items 컬럼 추가
-- Supabase SQL 에디터에서 실행하세요.

-- 1) CP 접속 시 필요한 비밀번호 (텍스트)
ALTER TABLE checkpoints
  ADD COLUMN IF NOT EXISTS access_password TEXT;

-- 2) CP별 관리 물자 종류 (JSONB 배열, 예: ['생수', '바나나', '초코바'])
ALTER TABLE checkpoints
  ADD COLUMN IF NOT EXISTS inventory_items JSONB DEFAULT '[]'::jsonb;

-- 기존 행에 빈 배열 적용 (선택)
-- UPDATE checkpoints SET inventory_items = '[]'::jsonb WHERE inventory_items IS NULL;
