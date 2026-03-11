-- ============================================
-- 트레일러닝 CP 기록 관리 - Supabase 스키마
-- ============================================

-- 대회(Project) 테이블
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  event_date DATE,
  dashboard_password TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CP(체크포인트) 테이블 - 각 대회별 CP 목록
CREATE TABLE checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  sort_order INTEGER DEFAULT 0,
  access_password TEXT,
  manager_name TEXT,
  manager_contact TEXT,
  inventory_items JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, code)
);

-- CP별 물자 항목 (각 CP마다 체크할 물자 목록: 생수, 이온음료, 바나나 등)
CREATE TABLE checkpoint_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkpoint_id UUID NOT NULL REFERENCES checkpoints(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CP 기록 테이블 - CP 담당자가 입력하는 기록
CREATE TABLE cp_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkpoint_id UUID NOT NULL REFERENCES checkpoints(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  material_quantity NUMERIC,
  temperature NUMERIC,
  humidity NUMERIC,
  notes TEXT,
  video_url TEXT,
  edited_at TIMESTAMPTZ,
  record_stage TEXT,
  is_bottleneck BOOLEAN DEFAULT FALSE,
  is_emergency BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CP 세션 (담당자 화면 단계: 준비 → 1등 도착 → 정기 기록 → 종료)
CREATE TABLE checkpoint_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkpoint_id UUID NOT NULL REFERENCES checkpoints(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'ready' CHECK (stage IN ('ready', 'first_arrival', 'recording', 'closed')),
  first_arrival_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(checkpoint_id)
);

-- CP 기록별 물자 수량 (항목별 입력값)
CREATE TABLE cp_record_material_quantities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cp_record_id UUID NOT NULL REFERENCES cp_records(id) ON DELETE CASCADE,
  checkpoint_material_id UUID NOT NULL REFERENCES checkpoint_materials(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cp_record_id, checkpoint_material_id)
);

-- RLS (Row Level Security) 활성화
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkpoint_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkpoint_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cp_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE cp_record_material_quantities ENABLE ROW LEVEL SECURITY;

-- 개발/초기 단계: 모든 사용자 읽기/쓰기 허용 (나중에 인증 규칙으로 교체 가능)
CREATE POLICY "Allow all for projects" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for checkpoints" ON checkpoints FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for checkpoint_materials" ON checkpoint_materials FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for checkpoint_sessions" ON checkpoint_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for cp_records" ON cp_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for cp_record_material_quantities" ON cp_record_material_quantities FOR ALL USING (true) WITH CHECK (true);

-- 인덱스
CREATE INDEX idx_checkpoints_project_id ON checkpoints(project_id);
CREATE INDEX idx_checkpoint_materials_checkpoint_id ON checkpoint_materials(checkpoint_id);
CREATE INDEX idx_checkpoint_sessions_checkpoint_id ON checkpoint_sessions(checkpoint_id);
CREATE INDEX idx_cp_records_checkpoint_id ON cp_records(checkpoint_id);
CREATE INDEX idx_cp_records_recorded_at ON cp_records(recorded_at);
CREATE INDEX idx_cp_record_material_quantities_cp_record_id ON cp_record_material_quantities(cp_record_id);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER checkpoints_updated_at
  BEFORE UPDATE ON checkpoints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER cp_records_updated_at
  BEFORE UPDATE ON cp_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER checkpoint_materials_updated_at
  BEFORE UPDATE ON checkpoint_materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER checkpoint_sessions_updated_at
  BEFORE UPDATE ON checkpoint_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Storage (Supabase 대시보드에서 버킷 생성 권장)
-- 버킷 이름: cp-videos, Public: true
-- 정책: INSERT/SELECT 허용 (또는 anon 허용)
-- ============================================
