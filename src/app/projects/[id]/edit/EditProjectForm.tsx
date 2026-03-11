"use client";

import { useState } from "react";
import { updateProject } from "../../actions";
import type { Project } from "@/types/database";

export default function EditProjectForm({ project }: { project: Project }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    try {
      await updateProject(project.id, formData);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "대회 수정 중 오류가 발생했습니다.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1">
            대회명 *
          </label>
          <input
            id="name"
            name="name"
            defaultValue={project.name}
            required
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 focus:border-slate-900 focus:outline-none transition-colors"
          />
        </div>

        <div>
          <label htmlFor="event_date" className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1">
            대회 일자
          </label>
          <input
            id="event_date"
            name="event_date"
            type="date"
            defaultValue={project.event_date || ""}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 focus:border-slate-900 focus:outline-none transition-colors"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1">
            설명
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={project.description || ""}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 focus:border-slate-900 focus:outline-none transition-colors"
          />
        </div>

        <div>
          <label htmlFor="dashboard_password" className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1">
            대시보드 비밀번호
          </label>
          <input
            id="dashboard_password"
            name="dashboard_password"
            type="text"
            autoComplete="off"
            defaultValue={project.dashboard_password || ""}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 focus:border-slate-900 focus:outline-none transition-colors"
            placeholder="비밀번호 설정 (공백 시 비활성화)"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-xs font-bold text-red-500 border border-red-100">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="btn-active flex-1 rounded-xl bg-slate-900 py-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? "저장 중..." : "변경 사항 저장"}
        </button>
        <a
          href={`/projects/${project.id}`}
          className="rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
        >
          취소
        </a>
      </div>
    </form>
  );
}
