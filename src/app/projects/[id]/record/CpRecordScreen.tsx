"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import CpRecordForm from "./CpRecordForm";

type Stage = "ready" | "first_arrival" | "recording" | "closed";

const TIMELINE_STEPS: { key: Stage; label: string }[] = [
  { key: "ready", label: "준비" },
  { key: "first_arrival", label: "개시" },
  { key: "recording", label: "운영" },
  { key: "closed", label: "종료" },
];

export default function CpRecordScreen({ projectId, checkpointId, materials, session, recentRecords }: any) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>(session.stage);
  const [showClosingForm, setShowClosingForm] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [localRecentRecords, setLocalRecentRecords] = useState(recentRecords);

  // ⚠️ 전역적으로 사용할 강제 라이트 모드 스타일
  const forceLightStyle: React.CSSProperties = {
    color: 'black',
    backgroundColor: 'white',
    WebkitTextFillColor: 'black',
    opacity: 1,
    WebkitAppearance: 'none',
    appearance: 'none',
    fontSize: '16px',
  };

  const refreshData = async () => {
    try {
      const res = await fetch(`/api/checkpoints/${checkpointId}/recent-records?_t=${Date.now()}`);
      if (res.ok) setLocalRecentRecords(await res.json());
      router.refresh();
    } catch (e) {}
  };

  const updateStage = async (newStage: Stage) => {
    const res = await fetch("/api/checkpoint-session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkpoint_id: checkpointId, stage: newStage }),
    });
    if (res.ok) {
      setStage(newStage);
      router.refresh();
    }
  };

  if (stage === "closed") {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border-2 border-slate-200 bg-white p-10 text-center text-black font-black text-xl shadow-sm">이 CP는 운영이 종료되었습니다.</div>
        <RecentRecordsList records={localRecentRecords} />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <nav className="flex justify-between items-center bg-white/50 p-2 rounded-2xl border border-slate-200">
        {TIMELINE_STEPS.map((s, i) => (
          <div key={s.key} className="flex flex-col items-center flex-1">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-black transition-all ${stage === s.key ? "bg-slate-800 text-white scale-110 shadow-lg" : "bg-slate-200 text-slate-400 opacity-50"}`}>{i + 1}</div>
            <span className={`text-[11px] mt-1.5 font-bold ${stage === s.key ? "text-slate-800" : "text-slate-400"}`}>{s.label}</span>
          </div>
        ))}
      </nav>

      {stage === "ready" && (
        <>
          <PreRaceStep checkpointId={checkpointId} materials={materials} onSuccess={() => updateStage("first_arrival")} refresh={refreshData} forceLightStyle={forceLightStyle} />
          <button onClick={() => setShowEmergencyModal(true)} className="h-14 w-full rounded-2xl border-2 border-red-500 bg-red-50 text-red-700 font-bold">🚨 긴급/특이사항 기록</button>
        </>
      )}

      {stage === "first_arrival" && (
        <>
          <FirstRunnerStep checkpointId={checkpointId} materials={materials} onSuccess={() => updateStage("recording")} refresh={refreshData} forceLightStyle={forceLightStyle} />
          <button onClick={() => setShowEmergencyModal(true)} className="h-14 w-full rounded-2xl border-2 border-red-500 bg-red-50 text-red-700 font-bold">🚨 긴급/특이사항 기록</button>
        </>
      )}
      
      {stage === "recording" && !showClosingForm && (
        <div className="space-y-6">
          <CpRecordForm projectId={projectId} checkpointId={checkpointId} materials={materials} onRecordSaved={refreshData} recordStage="operating" />
          <button onClick={() => setShowEmergencyModal(true)} className="h-14 w-full rounded-2xl border-2 border-red-500 bg-red-50 text-red-700 font-bold">🚨 긴급/특이사항 기록</button>
          <button onClick={() => setShowClosingForm(true)} className="h-14 w-full rounded-2xl border-2 border-slate-300 bg-white text-slate-600 font-bold hover:bg-slate-50">운영 종료 절차 시작하기</button>
        </div>
      )}

      {stage === "recording" && showClosingForm && (
        <div className="space-y-6">
          <button onClick={() => setShowClosingForm(false)} className="text-sm font-bold text-slate-500 underline px-2">← 실시간 운영 화면으로 돌아가기</button>
          <FinishBlock checkpointId={checkpointId} materials={materials} onSuccess={() => updateStage("closed")} refresh={refreshData} forceLightStyle={forceLightStyle} />
        </div>
      )}

      {showEmergencyModal && (
        <EmergencyEventBlock 
          checkpointId={checkpointId} 
          onClose={() => setShowEmergencyModal(false)} 
          onSaved={() => { setShowEmergencyModal(false); refreshData(); }} 
          forceLightStyle={forceLightStyle}
        />
      )}

      <RecentRecordsList records={localRecentRecords} />
    </div>
  );
}

function PreRaceStep({ checkpointId, materials, onSuccess, refresh, forceLightStyle }: any) {
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(materials.map((m: any) => [m.id, ""])));
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    const payload = { record_stage: "pre_race", material_quantities: materials.map((m: any) => ({ checkpoint_material_id: m.id, quantity: Number(qty[m.id]) || 0 })) };
    const res = await fetch("/api/cp-records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checkpoint_id: checkpointId, ...payload }) });
    if (res.ok) { await onSuccess(); refresh(); }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="p-8 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-8">
      <div>
        <h2 className="text-xl font-black text-black">준비 단계</h2>
        <p className="text-sm text-slate-500 mt-1 font-medium">최초 투입된 물자량을 입력하세요.</p>
      </div>
      <div className="space-y-5">
        {materials.map((m: any) => (
          <div key={m.id} className="flex items-center gap-4">
            <label className="flex-1 text-black font-bold">{m.name}</label>
            <input 
              type="text" 
              inputMode="numeric" 
              value={qty[m.id] || ""} 
              onChange={e => setQty(p => ({ ...p, [m.id]: e.target.value }))} 
              style={forceLightStyle}
              className="h-14 w-28 border-2 border-slate-300 rounded-2xl px-4 text-center font-black text-lg !text-black !bg-white" 
              placeholder="0" 
            />
            <span className="text-slate-400 font-bold w-6">{m.unit || "개"}</span>
          </div>
        ))}
      </div>
      <button disabled={loading} className="h-16 w-full bg-slate-800 text-white rounded-2xl font-black text-lg shadow-xl active:scale-[0.98] transition-transform">{loading ? "처리 중..." : "준비 완료 (다음 단계로)"}</button>
    </form>
  );
}

function FirstRunnerStep({ checkpointId, materials, onSuccess, refresh, forceLightStyle }: any) {
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(materials.map((m: any) => [m.id, ""])));
  const [temp, setTemp] = useState("");
  const [hum, setHum] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    const payload = { record_stage: "first_runner", temperature: Number(temp) || null, humidity: Number(hum) || null, material_quantities: materials.map((m: any) => ({ checkpoint_material_id: m.id, quantity: Number(qty[m.id]) || 0 })) };
    const res = await fetch("/api/cp-records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checkpoint_id: checkpointId, ...payload }) });
    if (res.ok) { await onSuccess(); refresh(); }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="p-8 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-8">
      <div>
        <h2 className="text-xl font-black text-black">개시 단계</h2>
        <p className="text-sm text-slate-500 mt-1 font-medium">1등 선수가 도착했습니다. 현재 정보를 입력하세요.</p>
      </div>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-black text-slate-700 mb-2">온도 (°C)</label>
            <input type="text" inputMode="decimal" value={temp} onChange={e => setTemp(e.target.value)} style={forceLightStyle} className="h-14 w-full border-2 border-slate-300 rounded-2xl px-6 font-black text-xl !text-black !bg-white" placeholder="25.5" />
          </div>
          <div>
            <label className="block text-sm font-black text-slate-700 mb-2">습도 (%)</label>
            <input type="text" inputMode="decimal" value={hum} onChange={e => setHum(e.target.value)} style={forceLightStyle} className="h-14 w-full border-2 border-slate-300 rounded-2xl px-6 font-black text-xl !text-black !bg-white" placeholder="60" />
          </div>
        </div>
        <div className="pt-4 border-t border-slate-100 space-y-5">
          <label className="block text-sm font-black text-slate-700">현재 물자 잔량</label>
          {materials.map((m: any) => (
            <div key={m.id} className="flex items-center gap-4">
              <label className="flex-1 text-black font-bold">{m.name}</label>
              <input 
                type="text" 
                inputMode="numeric" 
                value={qty[m.id] || ""} 
                onChange={e => setQty(p => ({ ...p, [m.id]: e.target.value }))} 
                style={forceLightStyle}
                className="h-14 w-28 border-2 border-slate-300 rounded-2xl px-4 text-center font-black text-lg !text-black !bg-white" 
                placeholder="0" 
              />
            </div>
          ))}
        </div>
      </div>
      <button disabled={loading} className="h-16 w-full bg-slate-800 text-white rounded-2xl font-black text-lg shadow-xl">1등 도착 확인 (운영 시작)</button>
    </form>
  );
}

function EmergencyEventBlock({ checkpointId, onClose, onSaved, forceLightStyle }: any) {
  const [type, setType] = useState("부상");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/cp-records", { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({ checkpoint_id: checkpointId, notes: `[${type}] ${notes}`, is_emergency: true }) 
    });
    onSaved();
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl space-y-6">
        <h3 className="text-xl font-black text-black">긴급/특이사항 기록</h3>
        <select value={type} onChange={e => setType(e.target.value)} style={forceLightStyle} className="w-full h-14 border-2 border-slate-300 rounded-2xl px-4 font-bold !text-black !bg-white">
          <option value="부상">🩹 부상 발생</option>
          <option value="병목">🛑 병목 현상</option>
          <option value="컴플레인">🗣️ 컴플레인</option>
          <option value="기타">📝 기타 사항</option>
        </select>
        <textarea 
          value={notes} 
          onChange={e => setNotes(e.target.value)} 
          style={forceLightStyle} 
          className="w-full border-2 border-slate-300 rounded-2xl p-4 font-bold !text-black !bg-white" 
          rows={3} 
          placeholder="상세 내용을 입력하세요."
        />
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 h-14 rounded-2xl border-2 border-slate-200 text-slate-600 font-bold">취소</button>
          <button type="submit" disabled={loading} className="flex-1 h-14 rounded-2xl bg-red-600 text-white font-bold">저장하기</button>
        </div>
      </form>
    </div>
  );
}

function FinishBlock({ checkpointId, materials, onSuccess, refresh, forceLightStyle }: any) {
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(materials.map((m: any) => [m.id, ""])));
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    const payload = { record_stage: "finished", material_quantities: materials.map((m: any) => ({ checkpoint_material_id: m.id, quantity: Number(qty[m.id]) || 0 })) };
    const res = await fetch("/api/cp-records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checkpoint_id: checkpointId, ...payload }) });
    if (res.ok) { await onSuccess(); refresh(); }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="p-8 bg-white rounded-3xl border-4 border-red-100 shadow-lg space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-black text-red-600">최종 철수</h2>
        <p className="text-sm text-slate-500 mt-2 font-bold">남은 모든 물자량을 정확히 입력하세요.</p>
      </div>
      <div className="space-y-5">
        {materials.map((m: any) => (
          <div key={m.id} className="flex items-center gap-4">
            <label className="flex-1 text-black font-bold">{m.name}</label>
            <input 
              type="text" 
              inputMode="numeric" 
              value={qty[m.id] || ""} 
              onChange={e => setQty(p => ({ ...p, [m.id]: e.target.value }))} 
              style={forceLightStyle}
              className="h-14 w-28 border-2 border-slate-300 rounded-2xl px-4 text-center font-black text-lg !text-black !bg-white" 
              placeholder="0" 
            />
          </div>
        ))}
      </div>
      <button disabled={loading} className="h-16 w-full bg-red-600 text-white rounded-2xl font-black text-xl shadow-red-200 shadow-xl">철수 완료 (기록 종료)</button>
    </form>
  );
}

function RecentRecordsList({ records }: { records: any[] }) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
      <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">최근 기록 내역 (5건)</h3>
      {!records?.length ? <p className="text-center py-8 text-slate-400 font-medium italic">아직 기록이 없습니다.</p> : (
        <div className="divide-y divide-slate-50">
          {records.slice(0, 5).map((r: any) => (
            <div key={r.id} className="py-4 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-black font-bold text-sm">{new Date(r.recorded_at).toLocaleTimeString("ko-KR", { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">{new Date(r.recorded_at).toLocaleDateString("ko-KR")}</span>
              </div>
              <div className="flex items-center gap-3">
                {r.temperature && <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-[11px] font-black">{r.temperature}°C</span>}
                <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
