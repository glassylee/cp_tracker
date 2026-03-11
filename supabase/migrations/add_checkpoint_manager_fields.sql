-- 기록 담당자 이름·연락처 (CP 추가/수정 시 입력)
ALTER TABLE checkpoints
  ADD COLUMN IF NOT EXISTS manager_name TEXT,
  ADD COLUMN IF NOT EXISTS manager_contact TEXT;
