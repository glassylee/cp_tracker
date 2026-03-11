-- 기록 수정 여부 표시 (대시보드에서 '수정됨' 표시용)
ALTER TABLE cp_records
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
