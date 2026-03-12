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
  material_quantity:
    initial?.material_quantity != null ? String(initial.material_quantity) : "",
  materialQuantities: initial?.materialQuantities
    ? Object.fromEntries(
        materialIds.map((id) => [
          id,
          String(initial.materialQuantities?.[id] ?? ""),
        ])
      )
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

type Props = {
  projectId: string;
  checkpointId: string;
  checkpointName: string;
  materials: { id: string; name: string; sort_order: number; unit?: string }[];
  onRecordSaved?: (createdRecordId?: string) => void;
  onEditComplete?: () => void;
  editRecordId?: string | null;
  initialData?: EditInitialData | null;
  recordStage?: "pre_race" | "first_runner" | "operating" | "finished" | null;
  isEmergency?: boolean;
};

export default function CpRecordForm({
  projectId,
  checkpointId,
  checkpointName,
  materials,
  onRecordSaved,
  onEditComplete,
  editRecordId,
  initialData,
  recordStage,
  isEmergency,
}: Props) {
  const router = useRouter();
  const materialIds = materials.map((m) => m.id);
  const [form, setForm] = useState<FormState>(() =>
    initialFormState(materialIds, initialData ?? undefined)
  );
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (initialData) {
      setForm(initialFormState(materialIds, initialData));
    }
  }, [initialData, materialIds.join(",")]);

  const handleMaterialChange = (id: string, val: string) => {
    setForm(prev => ({
      ...prev,
      materialQuantities: { ...prev.materialQuantities, [id]: val }
    }));
  };

  const doSubmit = async () => {
    setStatus("submitting");
    setMessage("");
    setShowConfirm(false);

    try {
      let videoUrl: string | null = null;
      if (form.video) {
        const formData = new FormData();
        formData.append("file", form.video);
        formData.append("checkpointId", checkpointId);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        if (!uploadRes.ok) throw new Error("영상 업로드 실패");
        const { url } = await uploadRes.json();
        videoUrl = url;
      }

      const payload = {
        material_quantity: materials.length === 0 ? Number(form.material_quantity) || null : null,
        material_quantities: materials.map(m => ({
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

      const endpoint = editRecordId ? `/api/cp-records/${editRecordId}` : "/api/cp-records";
      const method = editRecordId ? "PATCH" : "POST";
      const body = editRecordId ? payload : { checkpoint_id: checkpointId, ...payload };

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error("저장에 실패했습니다.");
      
      setStatus("success");
      setMessage("기록이 저장되었습니다.");
      setForm(initialFormState(materialIds));
      onRecordSaved?.();
      onEditComplete?.();
      router.refresh();
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message);
    }
  };

  const inputStyle = { color: 'black', backgroundColor: 'white' };
  const commonClass = "mt-2 block w-full min-h-[52px] rounded-xl border border-slate-300 px-4 py-4 text-base shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500";

  return (
    <>
      <form onSubmit={(e) => { e.preventDefault(); setShowConfirm(true); }} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-6">
          {materials.length > 0 ? (
            <div>
              <span className="block text-base font-medium text-slate-700">물자 수량</span>
              <ul className="mt-4 space-y-4">
                {materials.map((m) => (
                  <li key={m.id} className="flex items-center gap-2">
                    <label className="w-28 shrink-0 text-base text-slate-700">{m.name}</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form.materialQuantities[m.id] || ""}
                      onChange={(e) => handleMaterialChange(m.id, e.target.value)}
                      style={inputStyle}
                      className="h-12 w-28 rounded-xl border border-slate-300 px-4 text-base"
                      placeholder="0"
                    />
                    <span className="text-slate-600">{m.unit ?? "개"}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div>
              <label className="block text-base font-medium text-slate-700">물자 수량</label>
              <input
                type="text"
                inputMode="numeric"
                value={form.material_quantity}
                onChange={(e) => setForm(prev => ({ ...prev, material_quantity: e.target.value }))}
                style={inputStyle}
                className={commonClass}
                placeholder="숫자 입력"
              />
            </div>
          )}
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-base font-medium text-slate-700">온도 (°C)</label>
              <input
                type="text"
                inputMode="decimal"
                value={form.temperature}
                onChange={(e) => setForm(prev => ({ ...prev, temperature: e.target.value }))}
                style={inputStyle}
                className={commonClass}
                placeholder="25.5"
              />
            </div>
            <div>
              <label className="block text-base font-medium text-slate-700">습도 (%)</label>
              <input
                type="text"
                inputMode="decimal"
                value={form.humidity}
                onChange={(e) => setForm(prev => ({ ...prev, humidity: e.target.value }))}
                style={inputStyle}
                className={commonClass}
                placeholder="60"
              />
            </div>
          </div>
          <div>
            <label className="block text-base font-medium text-slate-700">특이사항</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              style={inputStyle}
              className={commonClass}
              rows={3}
            />
          </div>
        </div>
        <button type="submit" disabled={status === "submitting"} className="mt-8 h-14 w-full rounded-xl bg-slate-800 text-white font-bold">
          {status === "submitting" ? "저장 중..." : "기록 저장"}
        </button>
        {message && <div className={`mt-4 p-4 rounded-xl ${status === 'error' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>{message}</div>}
      </form>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <p className="text-center text-lg font-bold text-black">내용을 확인하세요</p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 h-12 rounded-xl border border-slate-300 text-black">취소</button>
              <button onClick={doSubmit} className="flex-1 h-12 rounded-xl bg-slate-800 text-white">확인</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
