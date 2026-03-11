-- 대회별 대시보드 접근 비밀번호 (관리자용)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS dashboard_password TEXT;
