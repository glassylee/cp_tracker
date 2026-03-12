"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import CpRecordForm from "./CpRecordForm";

type Material = { id: string; name: string; sort_order: number; unit?: string };
type Stage = "ready" | "first_arrival" | "recording" | "closed";

const TIMELINE_STEPS: { key: Stage; label: string }[] = [
  { key: "ready", label: "준비" },
  { key: "first_arrival", label: "개시" },
  { key: "recording", label: "운영" },
  { key: "closed", label: "종료" },
];

export default function CpRecordScreen({ projectId, checkpointId, checkpointName, materials, session, lastRecordAt: initialLastRecordAt, recentRecords }: any) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>(session.stage);
  const [showClosingForm, setShowClosingForm] = useState(false);
  const [localRecentRecords, setLocalRecentRecords] = useState(recentRecords);
  const recordingFormRef = useRef<HTMLDivElement>(null);

  const inputStyle = { color: 'black', backgroundColor: 'white' };

  const onRecordSaved = async () => {
    try {
      const res = await fetch(`/api/checkpoints/${checkpointId}/recent-records?_t=${Date.now()}`);
      const data = await res.json();
      if (res.ok) setLocalRecentRecords(data);
      router.refresh();
    } catch (e) {}
  };

  const runSessionUpdate = async (newStage: Stage) => {
    try {
      const res = await fetch("/api/checkpoint-session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkpoint_id: checkpointId, stage: newStage }),
      });
      const data = await res.json();
      if (res.ok) {
        setStage(data.stage);
        router.refresh();
      }
    } catch (e) {}
  };

  if (stage === "closed") {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border bg-white p-8 text-center text-black font-bold">이 CP는 종료되었습니다.</div>
        <RecentRecordsList records={localRecentRecords} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <nav className="flex justify-between items-center px-2">
        {TIMELINE_STEPS.map((s, i) => (
          <div key={s.key} className="flex flex-col items-center">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${stage === s.key ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-400"}`}>{i + 1}</div>
            <span className={`text-[10px] mt-1 ${stage === s.key ? "text-black font-bold" : "text-slate-400"}`}>{s.label}</span>
          </div>
        ))}
      </nav>

      {stage === "ready" && (
        <PreRaceStep checkpointId={checkpointId} materials={materials} onSuccess={() => runSessionUpdate("first_arrival")} onRecordSaved={onRecordSaved} inputStyle={inputStyle} />
      )}

      {stage === "first_arrival" && (
        <FirstRunnerStep checkpointId={checkpointId} materials={materials} onSuccess={() => runSessionUpdate("recording")} onRecordSaved={onRecordSaved} inputStyle={inputStyle} />
      )}

      {stage === "recording" && !showClosingForm && (
        <div ref={recordingFormRef} className="space-y-4">
          <CpRecordForm projectId={projectId} checkpointId={checkpointId} checkpointName={checkpointName} materials={materials} onRecordSaved={onRecordSaved} recordStage="operating" />
          <button onClick={() => setShowClosingForm(true)} className="h-12 w-full rounded-xl border-2 border-slate-300 bg-white text-black font-bold">운영 종료하기</button>
        </div>
      )}

      {stage === "recording" && showClosingForm && (
        <div className="space-y-4">
          <button onClick={() => setShowClosingForm(false)} className="text-sm text-slate-500 underline">← 운영으로 돌아가기</button>
          <FinishBlock checkpointId={checkpointId} materials={materials} onSuccess={() => runSessionUpdate("closed")} onRecordSaved={onRecordSaved} inputStyle={inputStyle} />
        </div>
      )}

      <RecentRecordsList records={localRecentRecords} />
    </div>
  );
}

function PreRaceStep({ checkpointId, materials, onSuccess, onRecordSaved, inputStyle }: any) {
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(materials.map((m: any) => [m.id, ""])));
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { record_stage: "pre_race", material_quantities: materials.map((m: any) => ({ checkpoint_material_id: m.id, quantity: Number(qty[m.id]) || 0 })) };
      const res = await fetch("/api/cp-records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checkpoint_id: checkpointId, ...payload }) });
      if (res.ok) { await onSuccess(); onRecordSaved(); }
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white rounded-xl border space-y-6">
      <h2 className="font-bold text-black">1단계: 준비 (최초 물자량)</h2>
      {materials.map((m: any) => (
        <div key={m.id} className="flex items-center gap-2">
          <label className="flex-1 text-black">{m.name}</label>
          <input type="text" inputMode="numeric" value={qty[m.id] || ""} onChange={e => setQty(prev => ({ ...prev, [m.id]: e.target.value }))} style={inputStyle} className="h-12 w-24 border rounded-xl px-4" />
          <span className="text-black">{m.unit || "개"}</span>
        </div>
      ))}
      <button disabled={loading} className="h-12 w-full bg-slate-800 text-white rounded-xl font-bold">{loading ? "처리 중..." : "준비 완료"}</button>
    </form>
  );
}

function FirstRunnerStep({ checkpointId, materials, onSuccess, onRecordSaved, inputStyle }: any) {
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(materials.map((m: any) => [m.id, ""])));
  const [temp, setTemp] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { record_stage: "first_runner", temperature: Number(temp) || null, material_quantities: materials.map((m: any) => ({ checkpoint_material_id: m.id, quantity: Number(qty[m.id]) || 0 })) };
      const res = await fetch("/api/cp-records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checkpoint_id: checkpointId, ...payload }) });
      if (res.ok) { await onSuccess(); onRecordSaved(); }
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white rounded-xl border space-y-6">
      <h2 className="font-bold text-black">2단계: 개시 (1등 도착)</h2>
      <div className="space-y-4">
        <label className="block text-black">현재 온도</label>
        <input type="text" inputMode="decimal" value={temp} onChange={e => setTemp(e.target.value)} style={inputStyle} className="h-12 w-full border rounded-xl px-4" placeholder="예: 25.5" />
      </div>
      {materials.map((m: any) => (
        <div key={m.id} className="flex items-center gap-2">
          <label className="flex-1 text-black">{m.name}</label>
          <input type="text" inputMode="numeric" value={qty[m.id] || ""} onChange={e => setQty(prev => ({ ...prev, [m.id]: e.target.value }))} style={inputStyle} className="h-12 w-24 border rounded-xl px-4" />
        </div>
      ))}
      <button disabled={loading} className="h-12 w-full bg-slate-800 text-white rounded-xl font-bold">개시 완료</button>
    </form>
  );
}

function FinishBlock({ checkpointId, materials, onSuccess, onRecordSaved, inputStyle }: any) {
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(materials.map((m: any) => [m.id, ""])));
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { record_stage: "finished", material_quantities: materials.map((m: any) => ({ checkpoint_material_id: m.id, quantity: Number(qty[m.id]) || 0 })) };
      const res = await fetch("/api/cp-records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checkpoint_id: checkpointId, ...payload }) });
      if (res.ok) { await onSuccess(); onRecordSaved(); }
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white rounded-xl border space-y-6">
      <h2 className="font-bold text-black text-center text-lg">CP 운영 종료</h2>
      <p className="text-sm text-slate-500 text-center">남은 최종 물자량을 입력하세요.</p>
      {materials.map((m: any) => (
        <div key={m.id} className="flex items-center gap-2">
          <label className="flex-1 text-black">{m.name}</label>
          <input type="text" inputMode="numeric" value={qty[m.id] || ""} onChange={e => setQty(prev => ({ ...prev, [m.id]: e.target.value }))} style={inputStyle} className="h-12 w-24 border rounded-xl px-4" />
        </div>
      ))}
      <button disabled={loading} className="h-14 w-full bg-slate-800 text-white rounded-xl font-bold">최종 철수 완료</button>
    </form>
  );
}

function RecentRecordsList({ records }: { records: any[] }) {
  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <h3 className="font-bold text-black text-sm">최근 기록</h3>
      {!records?.length ? <p className="text-center py-4 text-slate-400 text-xs">기록이 없습니다.</p> : (
        <div className="space-y-2">
          {records.slice(0, 5).map((r: any) => (
            <div key={r.id} className="text-xs border-b pb-2 flex justify-between items-center text-black">
              <span>{new Date(r.recorded_at).toLocaleTimeString("ko-KR")}</span>
              <span className="text-slate-500">{r.temperature ? `${r.temperature}°C` : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
