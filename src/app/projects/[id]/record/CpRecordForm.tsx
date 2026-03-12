"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Material = { id: string; name: string; sort_order: number; unit?: string };

type FormState = {
  material_quantity: string;
  materialQuantities: Record<string, string>;
  temperature: string;
  humidity: string;
  notes: string;
  video: File | null;
};

const initialFormState = (
  materialIds: string[],
  initial?: {
    temperature?: number | null;
    humidity?: number | null;
    notes?: string | null;
    material_quantity?: number | null;
    materialQuantities?: Record<string, number>;
  }
): FormState => ({
  material_quantity: initial?.material_quantity != null ? String(initial.material_quantity) : "",
  materialQuantities: initial?.materialQuantities
    ? Object.fromEntries(materialIds.map((id) => [id, String(initial.materialQuantities?.[id] ?? "")]))
    : Object.fromEntries(materialIds.map((id) => [id, ""])),
  temperature: initial?.temperature != null ? String(initial.temperature) : "",
  humidity: initial?.humidity != null ? String(initial.humidity) : "",
  notes: initial?.notes ?? "",
  video: null,
});

export type EditInitialData = {
  temperature?: number | null;
  humidity?: number | null;
  notes?: string | null;
  material_quantity?: number | null;
  materialQuantities?: Record<string, number>;
};

export default function CpRecordForm({ projectId, checkpointId, checkpointName, materials, onRecordSaved, onEditComplete, editRecordId, initialData, recordStage, isEmergency }: any) {
  const router = useRouter();
  const materialIds = materials.map((m: any) => m.id);
  const [form, setForm] = useState<FormState>(() => initialFormState(materialIds, initialData ?? undefined));
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (initialData) setForm(initialFormState(materialIds, initialData));
  }, [initialData, materialIds.join(",")]);

  const fixedInputStyle: React.CSSProperties = {
    opacity: 1,
    fontSize: "16px",
  };

  const inputClass = "h-12 w-24 border-2 border-slate-300 rounded-xl px-4 text-center font-bold !text-black !bg-white";
  const fullInputClass = "h-14 w-full border-2 border-slate-300 rounded-xl px-4 font-bold !text-black !bg-white";

  const doSubmit = async () => {
    setStatus("submitting");
    try {
      let videoUrl: string | null = null;
      if (form.video) {
        const formData = new FormData();
        formData.append("file", form.video);
        formData.append("checkpointId", checkpointId);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        const { url } = await uploadRes.json();
        videoUrl = url;
      }

      const payload = {
        material_quantity: materials.length === 0 ? Number(form.material_quantity) || null : null,
        material_quantities: materials.map((m: any) => ({
          checkpoint_material_id: m.id,
          quantity: Number(form.materialQuantities[m.id]) || 0
        })),
        temperature: Number(form.temperature) || null,
        humidity: Number(form.humidity) || null,
        notes: form.notes || null,
        video_url: videoUrl,
        step_status: recordStage,
        is_emergency: !!isEmergency
      };

      const res = await fetch(editRecordId ? `/api/cp-records/${editRecordId}` : "/api/cp-records", {
        method: editRecordId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editRecordId ? payload : { checkpoint_id: checkpointId, ...payload })
      });

      if (!res.ok) throw new Error("저장에 실패했습니다.");
      
      setStatus("success");
      setMessage("성공적으로 저장되었습니다.");
      setForm(initialFormState(materialIds));
      onRecordSaved?.();
      onEditComplete?.();
      router.refresh();
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message);
    }
  };

  return (
    <>
      <form onSubmit={(e) => { e.preventDefault(); setShowConfirm(true); }} className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="space-y-6">
          {materials.length > 0 ? (
            <div className="space-y-4">
              <span className="block font-bold text-slate-700">물자 소진량 기록</span>
              {materials.map((m: any) => (
                <div key={m.id} className="flex items-center gap-3">
                  <label className="flex-1 text-black font-medium">{m.name}</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form.materialQuantities[m.id] || ""}
                      onChange={(e) => setForm(p => ({ ...p, materialQuantities: { ...p.materialQuantities, [m.id]: e.target.value } }))}
                      className="h-12 w-24 border-2 border-slate-300 rounded-xl px-4 text-center font-bold !text-black !bg-white"
                      placeholder="0"
                    />
                  <span className="text-slate-500 w-6">{m.unit ?? "개"}</span>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <label className="block font-bold text-slate-700 mb-2">물자 수량</label>
              <input
                type="text"
                inputMode="numeric"
                value={form.material_quantity}
                onChange={(e) => setForm(p => ({ ...p, material_quantity: e.target.value }))}
                className="h-14 w-full border-2 border-slate-300 rounded-xl px-4 font-bold !text-black !bg-white"
                placeholder="숫자 입력"
              />
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">온도 (°C)</label>
              <input
                type="text"
                inputMode="decimal"
                value={form.temperature}
                onChange={(e) => setForm(p => ({ ...p, temperature: e.target.value }))}
                className="h-12 w-full border-2 border-slate-300 rounded-xl px-4 font-bold !text-black !bg-white"
                placeholder="25.5"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">습도 (%)</label>
              <input
                type="text"
                inputMode="decimal"
                value={form.humidity}
                onChange={(e) => setForm(p => ({ ...p, humidity: e.target.value }))}
                className="h-12 w-full border-2 border-slate-300 rounded-xl px-4 font-bold !text-black !bg-white"
                placeholder="60"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">특이사항</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full border-2 border-slate-300 rounded-xl p-4 font-medium !text-black !bg-white"
              rows={3}
              placeholder="내용 입력..."
            />
          </div>
        </div>

        <button type="submit" disabled={status === "submitting"} className="mt-8 h-14 w-full rounded-xl bg-slate-800 text-white font-black text-lg">
          {status === "submitting" ? "처리 중..." : "기록 저장하기"}
        </button>
        {message && <div className={`mt-4 p-4 rounded-xl text-center font-bold ${status === 'error' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>{message}</div>}
      </form>

      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl">
            <p className="text-center text-xl font-black text-black">기록을 제출할까요?</p>
            <div className="mt-8 flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 h-14 rounded-2xl border-2 border-slate-200 text-slate-600 font-bold">취소</button>
              <button onClick={doSubmit} className="flex-1 h-14 rounded-2xl bg-slate-800 text-white font-bold">확인</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
