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
    const checkpointCount = parseInt(formData.get("checkpoint_count") as string) || 0;
    if (!name?.trim()) return;
    const supabase = await createClient();
    const { data: project } = await supabase
      .from("projects")
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        event_date: event_date || null,
        dashboard_password: dashboard_password || null,
      })
      .select("id")
      .single();

    if (project?.id && checkpointCount > 0) {
      const checkpoints = Array.from({ length: checkpointCount }, (_, i) => ({
        project_id: project.id,
        name: `CP${i + 1}`,
        code: `CP${i + 1}`,
        sort_order: i + 1,
      }));
      await supabase.from("checkpoints").insert(checkpoints);
    }

    if (project?.id) redirect(`/projects/${project.id}`);
  }

  return (
    <div className="max-w-2xl space-y-12 pb-20">
      <div className="border-b border-[#D2D2D7]/30 pb-10">
        <Link
          href="/projects"
          className="group inline-flex items-center gap-2 text-[14px] font-semibold text-[#86868B] hover:text-[#0071E3] transition-colors mb-6"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="group-hover:-translate-x-1 transition-transform">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          대회 목록
        </Link>
        <h1 className="text-4xl font-semibold tracking-tight text-[#1D1D1F]">
          대회 추가
        </h1>
        <p className="mt-3 text-[#86868B] text-lg font-medium tracking-tight">
          새로운 트레일러닝 대회를 개설하고 운영을 시작하세요.
        </p>
      </div>

      <form
        action={createProject}
        className="rounded-[2.5rem] border border-[#D2D2D7]/50 bg-white p-10 shadow-[0_2px_15px_rgba(0,0,0,0.02)]"
      >
        <div className="space-y-8">
          <div className="grid gap-8 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label
                htmlFor="name"
                className="block text-[13px] font-semibold text-[#1D1D1F] mb-2 px-1"
              >
                대회명 <span className="text-[#FF3B30]">*</span>
              </label>
              <input
                id="name"
                name="name"
                required
                className="block w-full rounded-2xl border border-[#D2D2D7] bg-[#F5F5F7] px-5 py-4 text-[15px] text-[#1D1D1F] transition-all focus:bg-white focus:border-[#0071E3] focus:outline-none focus:ring-4 focus:ring-[#0071E3]/10"
                placeholder="예: 2025 제1회 트레일러닝 대회"
              />
            </div>
            
            <div>
              <label
                htmlFor="event_date"
                className="block text-[13px] font-semibold text-[#1D1D1F] mb-2 px-1"
              >
                대회 일자
              </label>
              <input
                id="event_date"
                name="event_date"
                type="date"
                className="block w-full rounded-2xl border border-[#D2D2D7] bg-[#F5F5F7] px-5 py-4 text-[15px] text-[#1D1D1F] transition-all focus:bg-white focus:border-[#0071E3] focus:outline-none focus:ring-4 focus:ring-[#0071E3]/10"
              />
            </div>

            <div>
              <label
                htmlFor="dashboard_password"
                className="block text-[13px] font-semibold text-[#1D1D1F] mb-2 px-1"
              >
                대시보드 비밀번호
              </label>
              <input
                id="dashboard_password"
                name="dashboard_password"
                type="password"
                autoComplete="new-password"
                className="block w-full rounded-2xl border border-[#D2D2D7] bg-[#F5F5F7] px-5 py-4 text-[15px] text-[#1D1D1F] transition-all focus:bg-white focus:border-[#0071E3] focus:outline-none focus:ring-4 focus:ring-[#0071E3]/10"
                placeholder="미설정 시 바로 접속"
              />
            </div>

            <div>
              <label
                htmlFor="checkpoint_count"
                className="block text-[13px] font-semibold text-[#1D1D1F] mb-2 px-1"
              >
                CP(체크포인트) 개수
              </label>
              <input
                id="checkpoint_count"
                name="checkpoint_count"
                type="number"
                min="0"
                max="30"
                className="block w-full rounded-2xl border border-[#D2D2D7] bg-[#F5F5F7] px-5 py-4 text-[15px] text-[#1D1D1F] transition-all focus:bg-white focus:border-[#0071E3] focus:outline-none focus:ring-4 focus:ring-[#0071E3]/10"
                placeholder="예: 5 (CP1~CP5 자동 생성)"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="description"
                className="block text-[13px] font-semibold text-[#1D1D1F] mb-2 px-1"
              >
                대회 개요
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                className="block w-full rounded-2xl border border-[#D2D2D7] bg-[#F5F5F7] px-5 py-4 text-[15px] text-[#1D1D1F] transition-all focus:bg-white focus:border-[#0071E3] focus:outline-none focus:ring-4 focus:ring-[#0071E3]/10 resize-none"
                placeholder="대회에 대한 간략한 설명을 입력하세요."
              />
            </div>
          </div>
        </div>

        <div className="mt-12 flex items-center gap-4">
          <button
            type="submit"
            className="btn-active flex-1 sm:flex-none rounded-full bg-[#0071E3] px-10 py-4 text-[15px] font-semibold text-white transition-all hover:bg-[#0077ED] shadow-[0_4px_12px_rgba(0,113,227,0.2)]"
          >
            대회 생성
          </button>
          <Link
            href="/projects"
            className="btn-active flex-1 sm:flex-none text-center rounded-full border border-[#D2D2D7] bg-white px-10 py-4 text-[15px] font-semibold text-[#1D1D1F] transition-all hover:bg-[#F5F5F7]"
          >
            취소
          </Link>
        </div>
      </form>
    </div>
  );
}
