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
  /** 타임라인 단계 (저장 시 함께 전송) */
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleMaterialChange = (materialId: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      materialQuantities: { ...prev.materialQuantities, [materialId]: value },
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setForm((prev) => ({ ...prev, video: file }));
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
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}));
          throw new Error(err.error || "영상 업로드 실패");
        }
        const { url } = await uploadRes.json();
        videoUrl = url;
      }

      const material_quantities =
        materials.length > 0
          ? materials.map((m) => ({
              checkpoint_material_id: m.id,
              quantity: form.materialQuantities[m.id]
                ? Number(form.materialQuantities[m.id])
                : 0,
            }))
          : undefined;
      const legacyMaterialQuantity =
        materials.length === 0 && form.material_quantity
          ? Number(form.material_quantity)
          : null;

      const payload = {
        material_quantity: legacyMaterialQuantity,
        material_quantities,
        temperature: form.temperature ? Number(form.temperature) : null,
        humidity: form.humidity ? Number(form.humidity) : null,
        notes: form.notes || null,
        video_url: videoUrl,
        ...(recordStage != null && { record_stage: recordStage, step_status: recordStage }),
        is_bottleneck: false,
        is_emergency: isEmergency === true,
      };

      if (editRecordId) {
        const res = await fetch(`/api/cp-records/${editRecordId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "수정에 실패했습니다.");
        }
        setStatus("success");
        setForm(initialFormState(materialIds));
        setMessage("기록이 수정되었습니다.");
        onRecordSaved?.();
        onEditComplete?.();
        router.refresh();
      } else {
        const postPayload = { checkpoint_id: checkpointId, ...payload };
        const res = await fetch("/api/cp-records", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(postPayload),
        });
        const resData = await res.json().catch(() => ({}));
        if (!res.ok) {
          const errBody = resData as { error?: string; code?: string; hint?: string; field?: string };
          console.error("[cp_records 저장 실패 (정기 기록)]", {
            status: res.status,
            field: errBody.field,
            error: errBody.error,
            code: errBody.code,
            hint: errBody.hint,
            sentPayload: postPayload,
            responseBody: resData,
          });
          throw new Error(errBody.error || "저장에 실패했습니다.");
        }
        const data = resData as { id?: string };
        setStatus("success");
        setForm(initialFormState(materialIds));
        setMessage("기록이 저장되었습니다.");
        onRecordSaved?.(data?.id);
        router.refresh();
      }
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "저장 중 오류가 났습니다.");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirm(true);
  };

  const confirmSummary = () => {
    const lines: string[] = [];
    if (materials.length > 0) {
      materials.forEach((m) => {
        const val = form.materialQuantities[m.id];
        if (val !== "" && val !== undefined) {
          lines.push(`${m.name}: ${val}`);
        }
      });
      if (lines.length === 0) lines.push("—");
    } else if (form.material_quantity !== "") {
      lines.push(`물자 수량: ${form.material_quantity}`);
    }
    if (form.temperature !== "") lines.push(`온도: ${form.temperature} °C`);
    if (form.humidity !== "") lines.push(`습도: ${form.humidity} %`);
    if (form.notes?.trim()) lines.push(`특이사항: ${form.notes.trim()}`);
    if (form.video) lines.push(`영상: ${form.video.name}`);
    return lines.length ? lines : ["입력된 값이 없습니다."];
  };

  const inputClass =
    "mt-2 block w-full min-h-[52px] rounded-xl border border-slate-300 bg-white px-4 py-4 text-base text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500";

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="space-y-6">
          {materials.length > 0 ? (
            <div>
              <span className="block text-base font-medium text-slate-700">
                {recordStage === "operating" ? "물자 소진량 (최근 10분간)" : "물자 수량 (항목별)"}
              </span>
              <p className="mt-1 text-sm text-slate-500">
                {recordStage === "operating" 
                  ? "지난 기록 이후 현재까지 소모된 물자량을 입력하세요." 
                  : "이 CP에 설정된 물자 항목별 수량을 입력하세요."}
              </p>
              <ul className="mt-4 space-y-4">
                {materials.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-2">
                    <label
                      htmlFor={`mat-${m.id}`}
                      className="w-28 shrink-0 text-base text-slate-700"
                    >
                      {m.name}
                    </label>
                    <input
                      id={`mat-${m.id}`}
                      type="text"
                      inputMode="numeric"
                      pattern="\d*"
                      autoComplete="off"
                      value={form.materialQuantities[m.id] ?? ""}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "");
                        handleMaterialChange(m.id, val);
                      }}
                      onFocus={(e) => e.target.select()}
                      className="min-h-[52px] w-28 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
                      placeholder="0"
                    />
                    <span className="shrink-0 text-base text-slate-600">{m.unit ?? "개"}</span>
                    {recordStage === "operating" && (
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-tight ml-auto">Consumed</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div>
              <label
                htmlFor="material_quantity"
                className="block text-base font-medium text-slate-700"
              >
                {recordStage === "operating" ? "물자 소진량" : "물자 수량"}
              </label>
              <input
                id="material_quantity"
                name="material_quantity"
                type="text"
                inputMode="numeric"
                pattern="\d*"
                autoComplete="off"
                value={form.material_quantity}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, "");
                  setForm(prev => ({ ...prev, material_quantity: val }));
                }}
                onFocus={(e) => e.target.select()}
                className={inputClass}
                placeholder={recordStage === "operating" ? "소모된 양 입력" : "예: 100"}
              />
              <p className="mt-2 text-sm text-slate-500">
                {recordStage === "operating" 
                  ? "지난 기록 이후 현재까지 소모된 총량을 입력하세요."
                  : "이 CP에 물자 항목이 없습니다. 대회 상세에서 CP의 \"물자 항목 설정\"으로 항목을 추가할 수 있습니다."}
              </p>
            </div>
          )}
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label
                htmlFor="temperature"
                className="block text-base font-medium text-slate-700"
              >
                온도 (°C)
              </label>
              <input
                id="temperature"
                name="temperature"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={form.temperature}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, "");
                  // 소수점은 하나만 허용
                  const parts = val.split(".");
                  const cleanVal = parts.length > 2 ? `${parts[0]}.${parts[1]}` : val;
                  setForm(prev => ({ ...prev, temperature: cleanVal }));
                }}
                onFocus={(e) => e.target.select()}
                className={inputClass}
                placeholder="예: 25.5"
              />
            </div>
            <div>
              <label
                htmlFor="humidity"
                className="block text-base font-medium text-slate-700"
              >
                습도 (%)
              </label>
              <input
                id="humidity"
                name="humidity"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={form.humidity}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, "");
                  const parts = val.split(".");
                  const cleanVal = parts.length > 2 ? `${parts[0]}.${parts[1]}` : val;
                  setForm(prev => ({ ...prev, humidity: cleanVal }));
                }}
                onFocus={(e) => e.target.select()}
                className={inputClass}
                placeholder="예: 60"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="notes"
              className="block text-base font-medium text-slate-700"
            >
              특이사항
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={4}
              value={form.notes}
              onChange={handleChange}
              className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-4 text-base text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
              placeholder="특이사항을 입력하세요."
            />
          </div>
          <div>
            <label
              htmlFor="video"
              className="block text-base font-medium text-slate-700"
            >
              영상 기록
            </label>
            <div className="mt-2">
              {!form.video ? (
                <label className="flex min-h-[100px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 transition hover:border-slate-400 hover:bg-slate-100">
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <span className="text-3xl">🎥</span>
                    <span className="text-sm font-bold tracking-tight">현장 영상 촬영 / 선택</span>
                  </div>
                  <input
                    id="video"
                    name="video"
                    type="file"
                    accept="video/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 p-2">
                  <video 
                    src={URL.createObjectURL(form.video)} 
                    className="aspect-video w-full rounded-xl object-cover"
                    controls
                  />
                  <div className="mt-2 flex items-center justify-between px-2 pb-1">
                    <p className="truncate text-xs font-medium text-slate-400">
                      {form.video.name}
                    </p>
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, video: null }))}
                      className="text-xs font-black text-red-400 hover:text-red-300"
                    >
                      다시 촬영
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {message && (
          <div
            className={`mt-6 rounded-xl p-4 text-base ${
              status === "error"
                ? "bg-red-50 text-red-800"
                : "bg-green-50 text-green-800"
            }`}
          >
            {message}
          </div>
        )}

        <div className="mt-8">
          <button
            type="submit"
            disabled={status === "submitting"}
            className="min-h-[52px] w-full rounded-xl bg-slate-800 px-6 py-4 text-base font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {status === "submitting"
              ? "저장 중…"
              : editRecordId
                ? "수정 저장"
                : "기록 저장"}
          </button>
        </div>
      </form>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <p className="text-center text-lg font-semibold text-slate-800">
              입력 내용 확인
            </p>
            <p className="mt-2 text-center text-sm text-slate-600">
              아래 내용으로 {editRecordId ? "수정" : "제출"}합니다.
            </p>
            <ul className="mt-4 space-y-2 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
              {confirmSummary().map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-xl border border-slate-300 bg-white py-3 text-base font-medium text-slate-700 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={doSubmit}
                disabled={status === "submitting"}
                className="flex-1 rounded-xl bg-slate-800 py-3 text-base font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {status === "submitting" ? "처리 중…" : "제출"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
