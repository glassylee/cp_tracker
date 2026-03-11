export type Project = {
  id: string;
  name: string;
  description: string | null;
  event_date: string | null;
  /** 대시보드 접근용 관리자 비밀번호 (설정 시 대시보드에서 입력 필요) */
  dashboard_password: string | null;
  created_at: string;
  updated_at: string;
};

export type Checkpoint = {
  id: string;
  project_id: string;
  name: string;
  code: string | null;
  sort_order: number;
  /** CP 기록 화면 접속 시 필요한 비밀번호 */
  access_password: string | null;
  /** 기록 담당자 이름 */
  manager_name: string | null;
  /** 기록 담당자 연락처 */
  manager_contact: string | null;
  /** CP별 관리 물자 종류 (예: [{ name: '생수', unit: '개' }]) */
  inventory_items: { name: string; unit?: string }[] | null;
  created_at: string;
  updated_at: string;
};

export type CpRecord = {
  id: string;
  checkpoint_id: string;
  recorded_at: string;
  material_quantity: number | null;
  temperature: number | null;
  humidity: number | null;
  notes: string | null;
  video_url: string | null;
  /** 수동 수정 시 설정 (대시보드에서 '수정됨' 표시용) */
  edited_at: string | null;
  /** 타임라인 단계: pre_race | first_runner | operating | finished */
  record_stage: string | null;
  /** 단계 상태 (텍스트) */
  step_status: string | null;
  /** 병목 구간 여부 */
  is_bottleneck: boolean;
  is_emergency: boolean;
  created_at: string;
  updated_at: string;
};

export type CpRecordInsert = Omit<
  CpRecord,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};
