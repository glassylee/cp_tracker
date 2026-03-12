"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import CpRecordForm, { type EditInitialData } from "./CpRecordForm";

const REMINDER_MINUTES = 10;
const EDIT_WINDOW_MS = 5 * 60 * 1000;

type Material = { id: string; name: string; sort_order: number; unit?: string };
type Stage = "ready" | "first_arrival" | "recording" | "closed";

const TIMELINE_STEPS: { key: Stage; label: string }[] = [
  { key: "ready", label: "준비" },
  { key: "first_arrival", label: "개시" },
  { key: "recording", label: "운영" },
  { key: "closed", label: "종료" },
];

const STAGE_ORDER: Record<Stage, number> = { ready: 0, first_arrival: 1, recording: 2, closed: 3 };

type Session = {
  stage: Stage;
  first_arrival_at: string | null;
  closed_at: string | null;
};

type RecentRecordItem = {
  id: string;
  recorded_at: string;
  temperature: number | null;
  edited_at: string | null;
  cp_record_material_quantities?: { quantity: number; checkpoint_materials: { name: string } | null }[];
};

type Props = {
  projectId: string;
  checkpointId: string;
  checkpointName: string;
  materials: { id: string; name: string; sort_order: number; unit?: string }[];
  session: Session;
  lastRecordAt: string | null;
  recentRecords: RecentRecordItem[];
};

function playAlarm() {
  try {
    const ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const playBeep = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    };
    playBeep();
    setTimeout(playBeep, 400);
    setTimeout(playBeep, 800);
  } catch {
    // ignore
  }
}

async function uploadVideo(file: File, checkpointId: string): Promise<string | null> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("checkpointId", checkpointId);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) return null;
  const { url } = await res.json();
  return url ?? null;
}

async function saveRecord(
  checkpointId: string,
  body: {
    record_stage?: string;
    step_status?: string;
    material_quantity?: number | null;
    material_quantities?: { checkpoint_material_id: string; quantity: number }[];
    temperature?: number | null;
    humidity?: number | null;
    notes?: string | null;
    video_url?: string | null;
    is_bottleneck?: boolean;
    is_emergency?: boolean;
  }
): Promise<{ id?: string }> {
  const payload = { checkpoint_id: checkpointId, ...body };
  const res = await fetch("/api/cp-records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errBody = data as { error?: string; code?: string; hint?: string; field?: string; stack?: string };
    console.error("[cp_records 저장 실패]", {
      status: res.status,
      field: errBody.field,
      error: errBody.error,
      code: errBody.code,
      hint: errBody.hint,
      sentPayload: payload,
      responseBody: data,
    });
    if (errBody.stack) console.error(errBody.stack);
    const msg = errBody.error ?? `기록 저장 실패 (${res.status})`;
    throw new Error(msg);
  }
  return data as { id?: string };
}

async function updateSession(
  checkpointId: string,
  stage: Stage
): Promise<{ stage: Stage; first_arrival_at: string | null; closed_at: string | null }> {
  const res = await fetch("/api/checkpoint-session", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ checkpoint_id: checkpointId, stage }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { error?: string }).error ?? `단계 전환 실패 (${res.status})`;
    throw new Error(msg);
  }
  if (!data || typeof (data as { stage?: string }).stage !== "string") {
    throw new Error("단계 전환 응답이 올바르지 않습니다.");
  }
  return data as { stage: Stage; first_arrival_at: string | null; closed_at: string | null };
}

export default function CpRecordScreen({
  projectId,
  checkpointId,
  checkpointName,
  materials,
  session,
  lastRecordAt: initialLastRecordAt,
  recentRecords,
}: Props) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>(session.stage);
  const [firstArrivalAt, setFirstArrivalAt] = useState(session.first_arrival_at);
  const [closedAt, setClosedAt] = useState(session.closed_at);
  const [lastRecordAt, setLastRecordAt] = useState<string | null>(initialLastRecordAt);
  const [showReminder, setShowReminder] = useState(false);
  const [lastSubmittedRecordId, setLastSubmittedRecordId] = useState<string | null>(null);
  const [lastSubmittedAt, setLastSubmittedAt] = useState<number | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingRecordData, setEditingRecordData] = useState<EditInitialData | null>(null);
  const [loadEditStatus, setLoadEditStatus] = useState<"idle" | "loading" | "error">("idle");
  const [actionStatus, setActionStatus] = useState<"idle" | "loading" | "error">("idle");
  const [actionMessage, setActionMessage] = useState("");
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [localRecentRecords, setLocalRecentRecords] = useState<RecentRecordItem[]>(recentRecords);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [showClosingForm, setShowClosingForm] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLastRecordAt(initialLastRecordAt);
  }, [initialLastRecordAt]);

  useEffect(() => {
    setLocalRecentRecords(recentRecords);
  }, [recentRecords]);

  const refetchRecentRecords = useCallback(async () => {
    try {
      await new Promise((r) => setTimeout(r, 300));
      const url = `/api/checkpoints/${checkpointId}/recent-records?_t=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store", headers: { Pragma: "no-cache" } });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data)) {
        setLocalRecentRecords(data);
      } else if (!res.ok) {
        console.warn("[recent-records] refetch failed:", res.status, data);
      }
    } catch (e) {
      console.warn("[recent-records] refetch error:", e);
    }
  }, [checkpointId]);

  // 서버에서 불러온 세션과 동기화 (새로고침 시 최신 단계 유지). 서버 단계가 같거나 뒤일 때만 반영해 낙관적 업데이트가 덮어쓰이지 않게 함.
  useEffect(() => {
    const serverOrder = STAGE_ORDER[session.stage as Stage] ?? 0;
    setStage((current) => {
      const currentOrder = STAGE_ORDER[current];
      if (serverOrder >= currentOrder) return session.stage as Stage;
      return current;
    });
    setFirstArrivalAt(session.first_arrival_at);
    setClosedAt(session.closed_at);
  }, [session.stage, session.first_arrival_at, session.closed_at]);

  useEffect(() => {
    if (lastSubmittedAt == null) return;
    const elapsed = Date.now() - lastSubmittedAt;
    if (elapsed >= EDIT_WINDOW_MS) {
      setLastSubmittedRecordId(null);
      setLastSubmittedAt(null);
      return;
    }
    const t = setTimeout(() => {
      setLastSubmittedRecordId(null);
      setLastSubmittedAt(null);
    }, EDIT_WINDOW_MS - elapsed);
    return () => clearTimeout(t);
  }, [lastSubmittedAt]);

  const scheduleReminder = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const baseTime = lastRecordAt ? new Date(lastRecordAt).getTime() : Date.now();
    const at = baseTime + REMINDER_MINUTES * 60 * 1000;
    const delay = Math.max(0, at - Date.now());
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      playAlarm();
      setShowReminder(true);
    }, delay);
  }, [lastRecordAt]);

  useEffect(() => {
    if (stage === "recording") {
      scheduleReminder();
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
  }, [stage, scheduleReminder]);

  useEffect(() => {
    if (stage !== "recording") {
      setCountdownSeconds(null);
      return;
    }
    const tick = () => {
      if (!lastRecordAt) {
        setCountdownSeconds(null);
        return;
      }
      const nextAt = new Date(lastRecordAt).getTime() + REMINDER_MINUTES * 60 * 1000;
      const remaining = Math.max(0, Math.floor((nextAt - Date.now()) / 1000));
      setCountdownSeconds(remaining);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [stage, lastRecordAt]);

  const onRecordSaved = useCallback(
    async (createdRecordId?: string) => {
      setLastRecordAt(new Date().toISOString());
      if (createdRecordId) {
        setLastSubmittedRecordId(createdRecordId);
        setLastSubmittedAt(Date.now());
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        playAlarm();
        setShowReminder(true);
      }, REMINDER_MINUTES * 60 * 1000);
      await refetchRecentRecords();
      router.refresh();
    },
    [refetchRecentRecords, router]
  );

  const handleEditLastRecord = useCallback(async () => {
    if (!lastSubmittedRecordId) return;
    setLoadEditStatus("loading");
    try {
      const res = await fetch(`/api/cp-records/${lastSubmittedRecordId}`);
      if (!res.ok) throw new Error("기록을 불러올 수 없습니다.");
      const record = (await res.json()) as {
        temperature?: number | null;
        humidity?: number | null;
        notes?: string | null;
        material_quantity?: number | null;
        cp_record_material_quantities?: {
          quantity?: number;
          checkpoint_material_id?: string;
          checkpoint_materials?: { id?: string };
        }[];
      };
      const materialQuantities: Record<string, number> = {};
      if (Array.isArray(record.cp_record_material_quantities)) {
        record.cp_record_material_quantities.forEach((q) => {
          const id = q.checkpoint_materials?.id ?? q.checkpoint_material_id;
          if (id) materialQuantities[id] = Number(q.quantity) ?? 0;
        });
      }
      setEditingRecordData({
        temperature: record.temperature,
        humidity: record.humidity,
        notes: record.notes ?? null,
        material_quantity: record.material_quantity,
        materialQuantities: Object.keys(materialQuantities).length ? materialQuantities : undefined,
      });
      setEditingRecordId(lastSubmittedRecordId);
    } catch {
      setLoadEditStatus("error");
    } finally {
      setLoadEditStatus("idle");
    }
  }, [lastSubmittedRecordId]);

  const todayRecords = useMemo(() => {
    const today = new Date().toDateString();
    return localRecentRecords.filter(
      (r) => r.recorded_at && new Date(r.recorded_at).toDateString() === today
    );
  }, [localRecentRecords]);

  const displayRecords = useMemo(
    () => localRecentRecords.slice(0, 50),
    [localRecentRecords]
  );

  const recordingFormRef = useRef<HTMLDivElement>(null);

  const handleEditRecordFromList = useCallback(
    async (recordId: string) => {
      try {
        const res = await fetch(`/api/cp-records/${recordId}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = (data as { error?: string }).error ?? "기록을 불러올 수 없습니다.";
          throw new Error(msg);
        }
        const record = data as {
          id?: string;
          temperature?: number | null;
          humidity?: number | null;
          notes?: string | null;
          material_quantity?: number | null;
          cp_record_material_quantities?: {
            quantity?: number;
            checkpoint_material_id?: string;
            checkpoint_materials?: { id?: string } | null;
          }[];
        };
        if (!record?.id) throw new Error("응답 형식이 올바르지 않습니다.");
        const materialQuantities: Record<string, number> = {};
        const qtyList = record.cp_record_material_quantities;
        if (Array.isArray(qtyList)) {
          qtyList.forEach((q) => {
            const id = (q.checkpoint_materials?.id ?? q.checkpoint_material_id) as string | undefined;
            if (id) materialQuantities[id] = Number(q.quantity) ?? 0;
          });
        }
        setEditingRecordData({
          temperature: record.temperature,
          humidity: record.humidity,
          notes: record.notes ?? null,
          material_quantity: record.material_quantity,
          materialQuantities: Object.keys(materialQuantities).length ? materialQuantities : undefined,
        });
        setEditingRecordId(recordId);
        setStage("recording");
        setTimeout(() => {
          recordingFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      } catch (e) {
        alert(e instanceof Error ? e.message : "기록을 불러오는 중 오류가 발생했습니다.");
      }
    },
    []
  );

  const runSessionUpdate = useCallback(
    async (newStage: Stage) => {
      setActionStatus("loading");
      setActionMessage("");
      try {
        const data = await updateSession(checkpointId, newStage);
        setStage(data.stage);
        setFirstArrivalAt(data.first_arrival_at);
        setClosedAt(data.closed_at);
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "단계 전환에 실패했습니다.";
        setActionMessage(msg);
        throw e;
      } finally {
        setActionStatus("idle");
      }
    },
    [checkpointId, router]
  );

  const isOverdue =
    stage === "recording" &&
    lastRecordAt != null &&
    Date.now() - new Date(lastRecordAt).getTime() > REMINDER_MINUTES * 60 * 1000;

  const currentIndex = TIMELINE_STEPS.findIndex((s) => s.key === stage);
  const isStepDone = (index: number) => index < currentIndex || stage === "closed";

  // ————— 종료기 (closed) —————
  if (stage === "closed") {
    return (
      <div className="space-y-6">
        <TimelineIndicator steps={TIMELINE_STEPS} currentIndex={TIMELINE_STEPS.length - 1} isStepDone={() => true} />
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-lg font-medium text-slate-800">이 CP는 종료되었습니다.</p>
          {closedAt && (
            <p className="mt-2 text-sm text-slate-500">종료 시각: {new Date(closedAt).toLocaleString("ko-KR")}</p>
          )}
        </div>
        <RecentRecordsList
          records={displayRecords}
          todayCount={todayRecords.length}
          onEdit={handleEditRecordFromList}
        />
      </div>
    );
  }

  return (
    <div
      className={`space-y-6 pb-8 ${isOverdue ? "rounded-xl bg-amber-50/80 p-4" : ""}`}
      aria-busy={isOverdue}
    >
      <TimelineIndicator steps={TIMELINE_STEPS} currentIndex={currentIndex} isStepDone={isStepDone} />

      {showReminder && (
        <ReminderModal
          onClose={() => setShowReminder(false)}
          message="기록할 시간입니다!"
        />
      )}

      {/* 이벤트 기록 모달: 준비기·운영기 공통 */}
      {(stage === "ready" || stage === "recording") && (
        <EmergencyEventBlock
          checkpointId={checkpointId}
          open={showEmergencyModal}
          onClose={() => setShowEmergencyModal(false)}
          onSaved={() => {
            setShowEmergencyModal(false);
            onRecordSaved();
            router.refresh();
          }}
        />
      )}

      {/* ————— 준비기 (PRE_RACE) ————— */}
      {stage === "ready" && (
        <>
          <PreRaceStep
            checkpointId={checkpointId}
            materials={materials}
            setStage={setStage}
            onSuccess={() => runSessionUpdate("first_arrival")}
            onRecordSaved={onRecordSaved}
            actionStatus={actionStatus}
            actionMessage={actionMessage}
          />
          <button
            type="button"
            onClick={() => setShowEmergencyModal(true)}
            className="min-h-[52px] w-full rounded-xl border-2 border-red-400 bg-red-50 px-4 py-3 text-base font-medium text-red-800 transition hover:bg-red-100"
          >
            이벤트 기록 (병목·부상·컴플레인·기타)
          </button>
        </>
      )}

      {/* ————— 개시기 (FIRST_RUNNER) ————— */}
      {stage === "first_arrival" && (
        <FirstRunnerStep
          checkpointId={checkpointId}
          materials={materials}
          setStage={setStage}
          onSuccess={() => runSessionUpdate("recording")}
          onRecordSaved={onRecordSaved}
          actionStatus={actionStatus}
          actionMessage={actionMessage}
        />
      )}

      {/* ————— 운영기 (OPERATING) ————— */}
      {stage === "recording" && !showClosingForm && (
        <>
          <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-4 text-center">
            {countdownSeconds === null ? (
              <p className="text-base text-slate-700">첫 기록을 입력한 뒤 10분마다 알림이 갑니다.</p>
            ) : countdownSeconds === 0 || isOverdue ? (
              <p className="text-xl font-bold text-amber-700">기록할 시간입니다!</p>
            ) : (
              <>
                <p className="text-sm text-slate-600">다음 기록까지</p>
                <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-slate-800">
                  {String(Math.floor(countdownSeconds / 60)).padStart(2, "0")}:{String(countdownSeconds % 60).padStart(2, "0")}
                </p>
              </>
            )}
          </div>
          {(countdownSeconds === null || countdownSeconds === 0 || isOverdue) && (
            <div ref={recordingFormRef}>
              {isOverdue && (
                <div className="rounded-xl border-2 border-amber-400 bg-amber-100 p-4 text-center">
                  <p className="text-lg font-semibold text-amber-900">기록할 시간입니다!</p>
                  <p className="mt-1 text-sm text-amber-800">정기 기록을 입력해 주세요.</p>
                </div>
              )}
              {editingRecordId && (
                <div className="rounded-xl border-2 border-blue-300 bg-blue-50 px-4 py-3 text-center">
                  <p className="text-base font-semibold text-blue-900">기록 수정 모드</p>
                  <p className="mt-1 text-sm text-blue-800">저장 시 선택한 기록이 수정됩니다. 수정 후 대시보드에 &quot;수정됨&quot;으로 표시됩니다.</p>
                </div>
              )}
              <CpRecordForm
                projectId={projectId}
                checkpointId={checkpointId}
                checkpointName={checkpointName}
                materials={materials}
                onRecordSaved={onRecordSaved}
                onEditComplete={() => {
                  setEditingRecordId(null);
                  setEditingRecordData(null);
                }}
                editRecordId={editingRecordId}
                initialData={editingRecordData}
                recordStage="operating"
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowEmergencyModal(true)}
            className="min-h-[52px] w-full rounded-xl border-2 border-red-400 bg-red-50 px-4 py-3 text-base font-medium text-red-800 transition hover:bg-red-100"
          >
            이벤트 기록 (병목·부상·컴플레인·기타)
          </button>
          <button
            type="button"
            onClick={() => setShowClosingForm(true)}
            className="min-h-[56px] w-full rounded-xl border-2 border-slate-400 bg-slate-100 px-4 py-3 text-base font-semibold text-slate-800 transition hover:bg-slate-200"
          >
            CP 운영 종료
          </button>
        </>
      )}

      {/* ————— 종료기 화면 (운영 종료 버튼 클릭 후) ————— */}
      {stage === "recording" && showClosingForm && (
        <>
          <button
            type="button"
            onClick={() => setShowClosingForm(false)}
            className="mb-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ← 운영으로 돌아가기
          </button>
          <FinishBlock
            checkpointId={checkpointId}
            materials={materials}
            setStage={setStage}
            onSuccess={() => runSessionUpdate("closed")}
            onRecordSaved={onRecordSaved}
            actionStatus={actionStatus}
            actionMessage={actionMessage}
          />
        </>
      )}

      <RecentRecordsList
        records={displayRecords}
        todayCount={todayRecords.length}
        onEdit={handleEditRecordFromList}
      />
    </div>
  );
}

// ————— 최근 기록 목록 (항상 하단에 표시) —————
function RecentRecordsList({
  records,
  todayCount,
  onEdit,
}: {
  records: RecentRecordItem[];
  todayCount: number;
  onEdit: (recordId: string) => void;
}) {
  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return iso;
    }
  };

  const summary = (r: RecentRecordItem) => {
    const qty = r.cp_record_material_quantities;
    if (!Array.isArray(qty) || qty.length === 0) return "—";
    return qty
      .map((q) => {
        const name = q.checkpoint_materials?.name ?? "?";
        return `${name} ${q.quantity}`;
      })
      .join(", ");
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-base font-semibold text-slate-800">최근 기록 목록</h2>
      {todayCount > 0 && (
        <p className="mb-3 text-xs text-slate-500">오늘 제출: {todayCount}건</p>
      )}
      {records.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">오늘 제출한 기록이 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {records.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium text-slate-700">{formatTime(r.recorded_at)}</span>
                {r.temperature != null && (
                  <span className="ml-2 text-slate-600">온도 {r.temperature}°C</span>
                )}
                <p className="mt-0.5 truncate text-xs text-slate-500">{summary(r)}</p>
                {r.edited_at && (
                  <span className="ml-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">수정됨</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onEdit(r.id)}
                className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                수정
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ————— 준비: 최초 물자량 + 세팅 완료 영상 —————
function PreRaceStep({
  checkpointId,
  materials,
  setStage,
  onSuccess,
  onRecordSaved,
  actionStatus,
  actionMessage,
}: {
  checkpointId: string;
  materials: { id: string; name: string; sort_order: number; unit?: string }[];
  setStage: (s: Stage) => void;
  onSuccess: () => Promise<void>;
  onRecordSaved?: () => void;
  actionStatus: string;
  actionMessage: string;
}) {
  const [materialQuantity, setMaterialQuantity] = useState("");
  const [materialQuantities, setMaterialQuantities] = useState<Record<string, string>>(
    () => Object.fromEntries(materials.map((m) => [m.id, ""]))
  );
  const [video, setVideo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("단계 변경 시도 중...");
    setStage("first_arrival");
    setLoading(true);
    try {
      let videoUrl: string | null = null;
      if (video) {
        videoUrl = await uploadVideo(video, checkpointId);
      }
      const payload: Parameters<typeof saveRecord>[1] = {
        record_stage: "pre_race",
        step_status: "pre_race",
        video_url: videoUrl,
        is_bottleneck: false,
        is_emergency: false,
      };
      if (materials.length > 0) {
        payload.material_quantities = materials.map((m) => ({
          checkpoint_material_id: m.id,
          quantity: Number(materialQuantities[m.id]) || 0,
        }));
      } else if (materialQuantity !== "") {
        payload.material_quantity = Number(materialQuantity) || null;
      }
      await saveRecord(checkpointId, payload);
      await onSuccess();
      onRecordSaved?.();
    } catch (err) {
      setStage("ready");
      const msg = err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.";
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "mt-2 block w-full min-h-[52px] rounded-xl border border-slate-300 px-4 py-4 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800">준비</h2>
      <p className="mt-1 text-sm text-slate-600">최초 물자량과 세팅 완료 영상을 등록한 뒤 준비 완료를 누르세요.</p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {materials.length > 0 ? (
          <div>
            <span className="block text-base font-medium text-slate-700">최초 물자량 (항목별)</span>
            <ul className="mt-4 space-y-4">
              {materials.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-2">
                  <label className="w-28 shrink-0 text-base text-slate-700">{m.name}</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="\d*"
                      autoComplete="off"
                      value={materialQuantities[m.id] ?? ""}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "");
                        setMaterialQuantities((prev) => ({ ...prev, [m.id]: val }));
                      }}
                      className="min-h-[52px] w-28 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
                    />
                  <span className="shrink-0 text-base text-slate-600">{m.unit ?? "개"}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div>
            <label className="block text-base font-medium text-slate-700">최초 물자량</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d*"
              autoComplete="off"
              value={materialQuantity}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, "");
                setMaterialQuantity(val);
              }}
              className="mt-2 block w-full min-h-[52px] rounded-xl border border-slate-300 bg-white px-4 py-4 text-base text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
              placeholder="예: 100"
            />
          </div>
        )}
        <div>
          <label className="block text-base font-medium text-slate-700">세팅 완료 영상</label>
          <div className="mt-2">
            {!video ? (
              <label className="flex min-h-[100px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 transition hover:bg-slate-100">
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <span className="text-2xl">🎥</span>
                  <span className="text-sm font-bold">영상 촬영 / 선택</span>
                </div>
                <input
                  type="file"
                  accept="video/*"
                  capture="environment"
                  onChange={(e) => setVideo(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="relative rounded-2xl border border-slate-200 bg-slate-900 p-2">
                <video 
                  src={URL.createObjectURL(video)} 
                  className="aspect-video w-full rounded-xl object-cover"
                  controls
                />
                <div className="mt-2 flex items-center justify-between px-2">
                  <p className="truncate text-[10px] text-slate-400">{video.name}</p>
                  <button type="button" onClick={() => setVideo(null)} className="text-[10px] font-bold text-red-400">다시 촬영</button>
                </div>
              </div>
            )}
          </div>
        </div>
        <button
          type="submit"
          disabled={loading || actionStatus === "loading"}
          className="min-h-[52px] w-full rounded-xl bg-slate-800 px-6 py-4 text-base font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
        >
          {loading || actionStatus === "loading" ? "처리 중…" : "준비 완료"}
        </button>
        {actionMessage && <p className="text-center text-sm text-red-600">{actionMessage}</p>}
      </form>
    </div>
  );
}

// ————— 개시: 1등 선수 도착 (즉시 온습도/물자 기록) —————
function FirstRunnerStep({
  checkpointId,
  materials,
  setStage,
  onSuccess,
  onRecordSaved,
  actionStatus,
  actionMessage,
}: {
  checkpointId: string;
  materials: { id: string; name: string; sort_order: number; unit?: string }[];
  setStage: (s: Stage) => void;
  onSuccess: () => Promise<void>;
  onRecordSaved?: () => void;
  actionStatus: string;
  actionMessage: string;
}) {
  const [temperature, setTemperature] = useState("");
  const [humidity, setHumidity] = useState("");
  const [materialQuantity, setMaterialQuantity] = useState("");
  const [materialQuantities, setMaterialQuantities] = useState<Record<string, string>>(
    () => Object.fromEntries(materials.map((m) => [m.id, ""]))
  );
  const [loading, setLoading] = useState(false);

  const handleFirstRunner = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("단계 변경 시도 중...");
    setStage("recording");
    setLoading(true);
    try {
      const payload: Parameters<typeof saveRecord>[1] = {
        record_stage: "first_runner",
        step_status: "first_runner",
        temperature: temperature ? Number(temperature) : null,
        humidity: humidity ? Number(humidity) : null,
        is_bottleneck: false,
        is_emergency: false,
      };
      if (materials.length > 0) {
        payload.material_quantities = materials.map((m) => ({
          checkpoint_material_id: m.id,
          quantity: Number(materialQuantities[m.id]) || 0,
        }));
      } else if (materialQuantity !== "") {
        payload.material_quantity = Number(materialQuantity) || null;
      }
      await saveRecord(checkpointId, payload);
      await onSuccess();
      onRecordSaved?.();
    } catch (err) {
      setStage("first_arrival");
      const msg = err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.";
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "mt-2 block w-full min-h-[52px] rounded-xl border border-slate-300 px-4 py-4 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800">개시</h2>
      <p className="mt-1 text-sm text-slate-600">1등 선수가 도착하면 즉시 온·습도·물자량을 입력한 뒤 버튼을 누르세요.</p>
      <form onSubmit={handleFirstRunner} className="mt-6 space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-base font-medium text-slate-700">온도 (°C)</label>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={temperature}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.]/g, "");
                const parts = val.split(".");
                const cleanVal = parts.length > 2 ? `${parts[0]}.${parts[1]}` : val;
                setTemperature(cleanVal);
              }}
              className="mt-2 block w-full min-h-[52px] rounded-xl border border-slate-300 bg-white px-4 py-4 text-base text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
              placeholder="예: 25.5"
            />
          </div>
          <div>
            <label className="block text-base font-medium text-slate-700">습도 (%)</label>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={humidity}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.]/g, "");
                const parts = val.split(".");
                const cleanVal = parts.length > 2 ? `${parts[0]}.${parts[1]}` : val;
                setHumidity(cleanVal);
              }}
              className="mt-2 block w-full min-h-[52px] rounded-xl border border-slate-300 bg-white px-4 py-4 text-base text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
              placeholder="예: 60"
            />
          </div>
        </div>
        {materials.length > 0 ? (
          <div>
            <span className="block text-base font-medium text-slate-700">물자량 (항목별)</span>
            <ul className="mt-4 space-y-4">
              {materials.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-2">
                  <label className="w-28 shrink-0 text-base text-slate-700">{m.name}</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="\d*"
                      autoComplete="off"
                      value={materialQuantities[m.id] ?? ""}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "");
                        setMaterialQuantities((prev) => ({ ...prev, [m.id]: val }));
                      }}
                      className="min-h-[52px] w-28 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
                    />
                  <span className="shrink-0 text-base text-slate-600">{m.unit ?? "개"}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div>
            <label className="block text-base font-medium text-slate-700">물자량</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d*"
              autoComplete="off"
              value={materialQuantity}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, "");
                setMaterialQuantity(val);
              }}
              className="mt-2 block w-full min-h-[52px] rounded-xl border border-slate-300 bg-white px-4 py-4 text-base text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
              placeholder="예: 100"
            />
          </div>
        )}
        <button
          type="submit"
          disabled={loading || actionStatus === "loading"}
          className="min-h-[56px] w-full rounded-xl bg-slate-800 px-6 py-4 text-lg font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
        >
          {loading || actionStatus === "loading" ? "처리 중…" : "1등 선수 도착"}
        </button>
        {actionMessage && <p className="text-center text-sm text-red-600">{actionMessage}</p>}
      </form>
    </div>
  );
}

// ————— 긴급/특별 이벤트 모달 (병목, 부상, 컴플레인, 기타) —————
const EVENT_TYPES = [
  { value: "병목", label: "병목" },
  { value: "부상", label: "부상" },
  { value: "컴플레인", label: "컴플레인" },
  { value: "기타", label: "기타" },
] as const;

function EmergencyEventBlock({
  checkpointId,
  open,
  onClose,
  onSaved,
}: {
  checkpointId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [eventType, setEventType] = useState<string>("부상");
  const [runnerBib, setRunnerBib] = useState("");
  const [notes, setNotes] = useState("");
  const [video, setVideo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const showBibInput = eventType === "부상" || eventType === "컴플레인";

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let videoUrl: string | null = null;
      if (video) videoUrl = await uploadVideo(video, checkpointId);
      const content = notes.trim();
      const bib = runnerBib.trim();
      let notesText: string;
      if (showBibInput && bib) {
        notesText = content ? `[${eventType}] 배번 ${bib}: ${content}` : `[${eventType}] 배번 ${bib}`;
      } else {
        notesText = content ? `[${eventType}] ${content}` : `[${eventType}]`;
      }
      const result = await saveRecord(checkpointId, {
        record_stage: "operating",
        step_status: "operating",
        notes: notesText,
        video_url: videoUrl,
        is_bottleneck: false,
        is_emergency: true,
      });
      if (result) {
        setEventType("부상");
        setRunnerBib("");
        setNotes("");
        setVideo(null);
        onSaved();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-slate-800">이벤트 기록</h3>
        <p className="mt-1 text-sm text-slate-500">병목, 부상, 컴플레인, 기타 중 유형을 선택해 기록하세요.</p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">유형</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {EVENT_TYPES.map(({ value, label }) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-center rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition ${
                    eventType === value
                      ? "border-red-500 bg-red-50 text-red-800"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="eventType"
                    value={value}
                    checked={eventType === value}
                    onChange={(e) => setEventType(e.target.value)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          {showBibInput && (
            <div>
              <label htmlFor="event-runner-bib" className="block text-sm font-medium text-slate-700">
                선수 배번 (선택)
              </label>
              <input
                id="event-runner-bib"
                type="text"
                inputMode="numeric"
                value={runnerBib}
                onChange={(e) => setRunnerBib(e.target.value)}
                placeholder="예: 42"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700">내용 (선택)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              placeholder="상세 내용을 입력하세요."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">영상 (선택)</label>
            <div className="mt-1">
              {!video ? (
                <label className="flex min-h-[80px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 transition hover:bg-slate-100">
                  <span className="text-xl">🎥</span>
                  <span className="text-[10px] font-bold text-slate-400">영상 촬영 / 선택</span>
                  <input
                    type="file"
                    accept="video/*"
                    capture="environment"
                    onChange={(e) => setVideo(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="relative rounded-xl border border-slate-200 bg-slate-900 p-1">
                  <video src={URL.createObjectURL(video)} className="aspect-video w-full rounded-lg object-cover" controls />
                  <button type="button" onClick={() => setVideo(null)} className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-[10px] text-white">✕</button>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-300 py-3 text-base font-medium text-slate-700 hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-red-600 py-3 text-base font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? "저장 중…" : "기록 저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ————— 종료: 최종 재고 입력 + 철수 영상 + 철수 완료 —————
function FinishBlock({
  checkpointId,
  materials,
  setStage,
  onSuccess,
  onRecordSaved,
  actionStatus,
  actionMessage,
}: {
  checkpointId: string;
  materials: { id: string; name: string; sort_order: number; unit?: string }[];
  setStage: (s: Stage) => void;
  onSuccess: () => Promise<void>;
  onRecordSaved?: () => void;
  actionStatus: string;
  actionMessage: string;
}) {
  const [video, setVideo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [finalQuantities, setFinalQuantities] = useState<Record<string, string>>(
    () => Object.fromEntries(materials.map((m) => [m.id, ""]))
  );
  const [validationError, setValidationError] = useState("");

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");
    if (materials.length > 0) {
      const allFilled = materials.every((m) => {
        const v = finalQuantities[m.id]?.trim();
        return v !== "" && !Number.isNaN(Number(v)) && Number(v) >= 0;
      });
      if (!allFilled) {
        setValidationError("모든 최종 재고 수량을 입력한 뒤 철수 완료를 눌러 주세요.");
        return;
      }
    }
    console.log("단계 변경 시도 중...");
    setStage("closed");
    setLoading(true);
    try {
      let videoUrl: string | null = null;
      if (video) videoUrl = await uploadVideo(video, checkpointId);
      const payload: Parameters<typeof saveRecord>[1] = {
        record_stage: "finished",
        step_status: "finished",
        video_url: videoUrl,
        is_bottleneck: false,
        is_emergency: false,
      };
      if (materials.length > 0) {
        payload.material_quantities = materials.map((m) => ({
          checkpoint_material_id: m.id,
          quantity: Number(finalQuantities[m.id]) || 0,
        }));
      }
      await saveRecord(checkpointId, payload);
      await onSuccess();
      onRecordSaved?.();
    } catch (err) {
      setStage("recording");
      const msg = err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.";
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "mt-2 block w-full min-h-[52px] rounded-xl border border-slate-300 px-4 py-4 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800">종료</h2>
      <p className="mt-1 text-sm text-slate-600">
        남은 물자 최종 수량을 입력하고, 종료/철수 영상을 올린 뒤 철수 완료를 눌러 주세요.
      </p>
      <form onSubmit={handleFinish} className="mt-6 space-y-6">
        {materials.length > 0 ? (
          <div>
            <span className="block text-base font-medium text-slate-700">최종 재고 수량 (항목별)</span>
            <p className="mt-1 text-sm text-slate-500">현재 CP에 남은 물자 수량을 입력하세요.</p>
            <ul className="mt-4 space-y-4">
              {materials.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-2">
                  <label className="w-28 shrink-0 text-base text-slate-700">{m.name}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="\d*"
                    autoComplete="off"
                    value={finalQuantities[m.id] ?? ""}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, "");
                      setFinalQuantities((prev) => ({ ...prev, [m.id]: val }));
                    }}
                    className="min-h-[52px] w-28 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
                    placeholder="0"
                  />
                  <span className="shrink-0 text-base text-slate-600">{m.unit ?? "개"}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-slate-500">이 CP에 설정된 물자 항목이 없습니다. 최종 재고 없이 철수할 수 있습니다.</p>
        )}
        <div>
          <label className="block text-base font-medium text-slate-700">대회 종료/철수 영상 (선택)</label>
          <div className="mt-2">
            {!video ? (
              <label className="flex min-h-[100px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 transition hover:bg-slate-100">
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <span className="text-2xl">🎥</span>
                  <span className="text-sm font-bold">영상 촬영 / 선택</span>
                </div>
                <input
                  type="file"
                  accept="video/*"
                  capture="environment"
                  onChange={(e) => setVideo(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="relative rounded-2xl border border-slate-200 bg-slate-900 p-2">
                <video src={URL.createObjectURL(video)} className="aspect-video w-full rounded-xl object-cover" controls />
                <div className="mt-2 flex items-center justify-between px-2">
                  <p className="truncate text-[10px] text-slate-400">{video.name}</p>
                  <button type="button" onClick={() => setVideo(null)} className="text-[10px] font-bold text-red-400">다시 촬영</button>
                </div>
              </div>
            )}
          </div>
        </div>
        {validationError && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{validationError}</p>
        )}
        <button
          type="submit"
          disabled={loading || actionStatus === "loading"}
          className="min-h-[52px] w-full rounded-xl border-2 border-red-300 bg-white px-6 py-4 text-base font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
        >
          {loading || actionStatus === "loading" ? "처리 중…" : "철수 완료"}
        </button>
        {actionMessage && <p className="text-center text-sm text-red-600">{actionMessage}</p>}
      </form>
    </div>
  );
}

function ReminderModal({ onClose, message }: { onClose: () => void; message: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
        <p className="text-center text-lg font-semibold text-slate-800">{message}</p>
        <p className="mt-2 text-center text-sm text-slate-600">정기 기록을 입력해 주세요.</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 min-h-[52px] w-full rounded-xl bg-slate-800 py-4 text-base font-medium text-white transition hover:bg-slate-700"
        >
          확인
        </button>
      </div>
    </div>
  );
}

function TimelineIndicator({
  steps,
  currentIndex,
  isStepDone,
}: {
  steps: { key: string; label: string }[];
  currentIndex: number;
  isStepDone: (index: number) => boolean;
}) {
  return (
    <nav aria-label="진행 단계" className="flex items-center justify-between">
      {steps.map((step, index) => {
        const done = isStepDone(index);
        const current = index === currentIndex;
        return (
          <div
            key={step.key}
            className="flex flex-1 items-center after:flex-1 after:border-b after:border-slate-200 last:after:hidden"
          >
            <div className="flex items-center">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-medium ${
                  done ? "bg-slate-800 text-white" : current ? "border-2 border-slate-800 bg-white text-slate-800" : "border border-slate-300 bg-white text-slate-400"
                }`}
              >
                {done ? "✓" : index + 1}
              </span>
              <span
                className={`ml-2 text-sm font-medium sm:text-base ${
                  current ? "text-slate-800" : done ? "text-slate-600" : "text-slate-400"
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
