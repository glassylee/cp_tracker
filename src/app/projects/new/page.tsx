import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default function NewProjectPage() {
  async function createProject(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    const description = (formData.get("description") as string) || null;
    const event_date = (formData.get("event_date") as string) || null;
    const dashboard_password = (formData.get("dashboard_password") as string)?.trim() || null;
    if (!name?.trim()) return;
    const supabase = await createClient();
    const { data } = await supabase
      .from("projects")
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        event_date: event_date || null,
        dashboard_password: dashboard_password || null,
      })
      .select("id")
      .single();
    if (data?.id) redirect(`/projects/${data.id}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/projects"
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← 대회 목록
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-800">대회 추가</h1>
      </div>
      <form
        action={createProject}
        className="max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-slate-700"
            >
              대회명 *
            </label>
            <input
              id="name"
              name="name"
              required
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              placeholder="예: 2025 제1회 트레일러닝 대회"
            />
          </div>
          <div>
            <label
              htmlFor="event_date"
              className="block text-sm font-medium text-slate-700"
            >
              대회 일자
            </label>
            <input
              id="event_date"
              name="event_date"
              type="date"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-slate-700"
            >
              설명
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              placeholder="대회 개요 (선택)"
            />
          </div>
          <div>
            <label
              htmlFor="dashboard_password"
              className="block text-sm font-medium text-slate-700"
            >
              대시보드 비밀번호 (선택)
            </label>
            <input
              id="dashboard_password"
              name="dashboard_password"
              type="password"
              autoComplete="off"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              placeholder="설정 시 대시보드 접속 시 입력 필요"
            />
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <button
            type="submit"
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            대회 생성
          </button>
          <Link
            href="/projects"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            취소
          </Link>
        </div>
      </form>
    </div>
  );
}
