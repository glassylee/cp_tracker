"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Material = { id: string; name: string; sort_order: number };

type Props = {
  projectId: string;
  checkpointId: string;
  initialMaterials: Material[];
};

export default function CheckpointMaterialsForm({
  projectId,
  checkpointId,
  initialMaterials,
}: Props) {
  const router = useRouter();
  const [materials, setMaterials] = useState<Material[]>(initialMaterials);
  const [newName, setNewName] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const addMaterial = () => {
    const name = newName.trim();
    if (!name) return;
    setMaterials((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, name, sort_order: prev.length },
    ]);
    setNewName("");
  };

  const removeMaterial = (id: string) => {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    setMessage("");
    try {
      const res = await fetch("/api/checkpoint-materials", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkpoint_id: checkpointId,
          materials: materials.map((m) => ({ id: m.id.startsWith("new-") ? null : m.id, name: m.name })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "저장 실패");
      }
      setStatus("success");
      setMessage("저장되었습니다.");
      router.refresh();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "저장 중 오류");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            물자 항목 목록
          </label>
          <p className="mt-1 text-xs text-slate-500">
            이 CP에서 기록할 물자 항목을 추가·삭제하세요.
          </p>
        </div>
        <ul className="space-y-2">
          {materials.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <span className="text-slate-800">{m.name}</span>
              <button
                type="button"
                onClick={() => removeMaterial(m.id)}
                className="text-sm text-red-600 hover:text-red-800"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addMaterial())}
            placeholder="예: 생수"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
          <button
            type="button"
            onClick={addMaterial}
            className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-300"
          >
            추가
          </button>
        </div>
      </div>
      {message && (
        <div
          className={`mt-4 rounded-md p-3 text-sm ${
            status === "error" ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"
          }`}
        >
          {message}
        </div>
      )}
      <div className="mt-6 flex gap-3">
        <button
          type="submit"
          disabled={status === "submitting"}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
        >
          {status === "submitting" ? "저장 중…" : "저장"}
        </button>
        <a
          href={`/projects/${projectId}`}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          취소
        </a>
      </div>
    </form>
  );
}
