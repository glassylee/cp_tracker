import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CreateTestProjectButton from "./CreateTestProjectButton";
import ProjectSettingsMenu from "./ProjectSettingsMenu";

export default async function ProjectsPage() {
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

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">
            대회 목록
          </h1>
          <p className="mt-2 text-slate-500 font-medium">
            현재 진행 중인 대회와 체크포인트를 관리하세요.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CreateTestProjectButton />
          <Link
            href="/projects/new"
            className="btn-active inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-xl transition-all hover:bg-slate-800 hover:shadow-slate-200"
          >
            <span>+</span> 대회 추가
          </Link>
        </div>
      </div>

      {!projects?.length ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-16 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 text-3xl shadow-inner">
            ⛰️
          </div>
          <p className="text-lg font-bold text-slate-800 tracking-tight">등록된 대회가 없습니다.</p>
          <p className="mt-2 text-sm text-slate-400 font-medium">새로운 대회를 추가하여 기록 관리를 시작하세요.</p>
        </div>
      ) : (
        <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <li key={project.id} className="group relative">
              <Link
                href={`/projects/${project.id}`}
                className="relative block h-full overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:border-slate-300 hover:shadow-2xl"
              >
                <div className="mb-6 flex items-start justify-between">
                  <div className="rounded-lg bg-slate-900 px-3 py-1 text-[10px] font-black tracking-widest text-[--brand-primary] uppercase shadow-sm">
                    Running Project
                  </div>
                  {project.event_date && (
                    <div className="text-xs font-bold text-slate-400 tracking-tighter">
                      {new Date(project.event_date).toLocaleDateString("ko-KR")}
                    </div>
                  )}
                </div>
                <h2 className="text-2xl font-black text-slate-900 group-hover:text-slate-800 tracking-tight pr-10">
                  {project.name}
                </h2>
                {project.description && (
                  <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-500 font-medium">
                    {project.description}
                  </p>
                )}
                <div className="mt-8 flex items-center justify-between border-t border-slate-50 pt-6">
                  <span className="text-xs font-bold text-slate-400 group-hover:text-slate-900 transition-colors uppercase tracking-widest">
                    Detail & CP Setup
                  </span>
                  <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all shadow-sm">
                    →
                  </div>
                </div>
              </Link>
              
              <ProjectSettingsMenu projectId={project.id} projectName={project.name} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
