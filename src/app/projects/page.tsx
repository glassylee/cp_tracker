import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CreateTestProjectButton from "./CreateTestProjectButton";
import ProjectSettingsMenu from "./ProjectSettingsMenu";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "active" } = await searchParams;
  const supabase = await createClient();
  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .order("event_date", { ascending: false });

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <p className="font-medium">데이터를 불러올 수 없습니다.</p>
        <p className="mt-1 text-sm">
          Supabase 연결을 확인해 주세요. (환경 변수 및 스키마 적용 여부)
        </p>
        <pre className="mt-2 overflow-auto rounded bg-red-100 p-2 text-xs">
          {error.message}
        </pre>
      </div>
    );
  }

  // 필터링 로직 (오늘 기준)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filteredProjects = projects?.filter((p) => {
    if (!p.event_date) return filter === "active"; // 날짜 없으면 일단 활성으로 분류
    const eventDate = new Date(p.event_date);
    eventDate.setHours(0, 0, 0, 0);
    return filter === "active" ? eventDate >= today : eventDate < today;
  });

  return (
    <div className="space-y-12">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between border-b border-[#D2D2D7]/30 pb-10">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-[#1D1D1F]">
            {filter === "active" ? "진행 중인 대회" : "지난 대회 기록"}
          </h1>
          <p className="mt-3 text-[#86868B] text-lg font-medium tracking-tight">
            {filter === "active" 
              ? "현재 운영 중이거나 예정된 대회를 관리합니다." 
              : "종료된 대회의 기록을 열람할 수 있습니다."}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {filter === "active" && (
            <>
              <CreateTestProjectButton />
              <Link
                href="/projects/new"
                className="btn-active inline-flex items-center gap-2 rounded-full bg-[#0071E3] px-8 py-3.5 text-sm font-semibold text-white shadow-[0_4px_14px_0_rgba(0,113,227,0.39)] transition-all hover:bg-[#0077ED] hover:shadow-[0_6px_20px_rgba(0,113,227,0.23)]"
              >
                대회 추가
              </Link>
            </>
          )}
        </div>
      </div>

      {!filteredProjects?.length ? (
        <div className="rounded-[2.5rem] border border-[#D2D2D7]/50 bg-white/50 p-24 text-center backdrop-blur-sm">
          <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-[#F5F5F7] text-4xl">
            {filter === "active" ? "⚡" : "📁"}
          </div>
          <p className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">
            {filter === "active" ? "진행 중인 대회가 없습니다." : "지난 대회 기록이 없습니다."}
          </p>
          <p className="mt-3 text-[#86868B] text-lg font-medium">
            {filter === "active" ? "새로운 대회를 추가하여 기록 관리를 시작하세요." : "종료된 대회가 여기에 표시됩니다."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[2.5rem] border border-[#D2D2D7]/50 bg-white shadow-[0_2px_15px_rgba(0,0,0,0.02)]">
          <div className="divide-y divide-[#F5F5F7]">
            {filteredProjects.map((project) => (
              <div key={project.id} className="group relative transition-all hover:bg-[#F5F5F7]/50">
                <Link
                  href={`/projects/${project.id}`}
                  className="flex items-center gap-8 p-8 sm:px-10"
                >
                  <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-[#F5F5F7] text-2xl group-hover:scale-110 transition-transform duration-500">
                    {filter === "active" ? "🏃‍♂️" : "🏆"}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-2xl font-semibold text-[#1D1D1F] tracking-tight truncate">
                        {project.name}
                      </h2>
                      {filter === "active" && (
                        <span className="inline-flex items-center rounded-full bg-[#34C759]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#34C759] ring-1 ring-[#34C759]/20">
                          LIVE
                        </span>
                      )}
                    </div>
                    <p className="text-[#86868B] text-[15px] font-medium line-clamp-1">
                      {project.description || "상세 설명이 없습니다."}
                    </p>
                  </div>

                  <div className="hidden sm:flex flex-col items-end gap-1 px-4">
                    <span className="text-[13px] font-semibold text-[#1D1D1F]">
                      {project.event_date ? new Date(project.event_date).toLocaleDateString("ko-KR", { month: 'long', day: 'numeric', year: 'numeric' }) : "날짜 미정"}
                    </span>
                    <span className="text-[11px] font-medium text-[#86868B] uppercase tracking-wider">
                      Event Date
                    </span>
                  </div>

                  <div className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-full text-[#D2D2D7] group-hover:text-black group-hover:bg-white transition-all shadow-sm">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </Link>
                
                {/* ProjectSettingsMenu removed from here as it's now only in the sidebar */}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
