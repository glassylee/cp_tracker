import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import CopyRecordLinkButton from "./CopyRecordLinkButton";
import CopyDashboardLinkButton from "./CopyDashboardLinkButton";
import DeleteCheckpointButton from "./DeleteCheckpointButton";

type Props = { params: Promise<{ id: string }> };

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (projectError || !project) {
    notFound();
  }

  const { data: checkpoints } = await supabase
    .from("checkpoints")
    .select("*, checkpoint_materials(id, name, sort_order)")
    .eq("project_id", id)
    .order("sort_order");

  return (
    <div className="space-y-12 pb-20">
      {/* 상단 네비게이션 및 타이틀 */}
      <div className="border-b border-slate-200 pb-10">
        <Link
          href="/projects"
          className="group flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-900 transition-colors"
        >
          <span className="group-hover:-translate-x-1 transition-transform">←</span> 대회 목록
        </Link>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase">
                {project.name}
              </h1>
            </div>
            {project.event_date && (
              <p className="mt-2 text-lg font-bold text-slate-400 tracking-tighter">
                📅 {new Date(project.event_date).toLocaleDateString("ko-KR")}
              </p>
            )}
          </div>
          <CopyDashboardLinkButton projectId={id} />
        </div>
      </div>

      <div className="max-w-4xl">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                CP 설정
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-400">
                현장 요원용 기록 링크를 관리하고 전달하세요.
              </p>
            </div>
            <Link
              href={`/projects/${id}/checkpoints/new`}
              className="btn-active inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-xs font-black text-white transition-all hover:bg-slate-800"
            >
              + CP 추가
            </Link>
          </div>

          {!checkpoints?.length ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50/50 p-12 text-center">
              <p className="text-sm font-bold text-slate-400">등록된 CP가 없습니다.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-1">
              {checkpoints.map((cp) => {
                const materials = (cp as { checkpoint_materials?: { name: string }[] }).checkpoint_materials ?? [];
                const materialNames = materials.map((m) => m.name).join(", ") || "—";
                return (
                  <div key={cp.id} className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/30 p-6 transition-all hover:border-slate-200 hover:bg-white hover:shadow-xl">
                    <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-[10px] font-black text-[--brand-primary] shadow-sm">
                            {cp.code || "CP"}
                          </div>
                          <div>
                            <h3 className="text-lg font-black text-slate-900 tracking-tight">{cp.name}</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                              Materials: {materialNames}
                            </p>
                          </div>
                        </div>
                        {(() => {
                          const m = cp as { manager_name?: string | null; manager_contact?: string | null };
                          if (!m.manager_name && !m.manager_contact) return null;
                          return (
                            <div className="mt-4 flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-[10px] font-bold text-slate-500 shadow-sm border border-slate-100 w-fit">
                              👤 {m.manager_name || "—"} {m.manager_contact && `· ${m.manager_contact}`}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex flex-col gap-2 sm:w-48">
                        <CopyRecordLinkButton projectId={id} cpId={cp.id} />
                        <div className="grid grid-cols-2 gap-2">
                          <Link
                            href={`/projects/${id}/checkpoints/${cp.id}/edit`}
                            className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-[10px] font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 shadow-sm"
                          >
                            수정
                          </Link>
                          <DeleteCheckpointButton
                            projectId={id}
                            cpId={cp.id}
                            cpName={cp.name}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
