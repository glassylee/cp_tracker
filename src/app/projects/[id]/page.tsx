import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import CopyRecordLinkButton from "./CopyRecordLinkButton";
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
    <div className="space-y-16 pb-24">
      {/* Top Navigation & Title (Apple Style) */}
      <div className="border-b border-[#D2D2D7]/30 pb-12">
        <Link
          href="/projects"
          className="group inline-flex items-center gap-2 text-[14px] font-semibold text-[#86868B] hover:text-[#0071E3] transition-colors mb-6"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="group-hover:-translate-x-1 transition-transform">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          대회 목록
        </Link>
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-5xl font-semibold tracking-tight text-[#1D1D1F] leading-tight">
              {project.name}
            </h1>
            {project.event_date && (
              <p className="mt-4 text-xl font-medium text-[#86868B] tracking-tight flex items-center gap-2">
                <span className="opacity-60">📅</span>
                {new Date(project.event_date).toLocaleDateString("ko-KR", { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl space-y-10">
        <section className="rounded-[2.5rem] border border-[#D2D2D7]/50 bg-white p-10 shadow-[0_2px_15px_rgba(0,0,0,0.02)]">
          <div className="mb-10 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">
                체크포인트(CP) 관리
              </h2>
              <p className="mt-2 text-[15px] font-medium text-[#86868B]">
                현장 요원용 기록 링크를 관리하고 전달하세요.
              </p>
            </div>
            <Link
              href={`/projects/${id}/checkpoints/new`}
              className="btn-active inline-flex h-11 items-center justify-center rounded-full bg-[#0071E3] px-6 text-[13px] font-semibold text-white transition-all hover:bg-[#0077ED] shadow-[0_4px_12px_rgba(0,113,227,0.2)]"
            >
              CP 추가
            </Link>
          </div>

          {!checkpoints?.length ? (
            <div className="rounded-[2rem] border border-[#D2D2D7]/30 bg-[#F5F5F7]/50 p-16 text-center">
              <p className="text-[15px] font-semibold text-[#86868B]">등록된 체크포인트가 없습니다.</p>
              <p className="mt-2 text-[13px] text-[#A1A1A6]">새로운 CP를 추가하여 대회 운영을 시작하세요.</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {checkpoints.map((cp) => {
                const materials = (cp as { checkpoint_materials?: { name: string }[] }).checkpoint_materials ?? [];
                const materialNames = materials.map((m) => m.name).join(", ") || "—";
                return (
                  <div key={cp.id} className="group relative overflow-hidden rounded-3xl border border-[#D2D2D7]/40 bg-white p-8 transition-all hover:shadow-[0_10px_30px_rgba(0,0,0,0.04)] hover:border-[#D2D2D7]">
                    <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-5">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5F5F7] text-[13px] font-bold text-[#1D1D1F] ring-1 ring-[#D2D2D7]/30">
                            {cp.code || "CP"}
                          </div>
                          <div>
                            <h3 className="text-xl font-semibold text-[#1D1D1F] tracking-tight">{cp.name}</h3>
                            <p className="text-[13px] font-medium text-[#86868B] mt-1 line-clamp-1">
                              관리 물자: {materialNames}
                            </p>
                          </div>
                        </div>
                        {(() => {
                          const m = cp as { manager_name?: string | null; manager_contact?: string | null };
                          if (!m.manager_name && !m.manager_contact) return null;
                          return (
                            <div className="mt-5 flex items-center gap-3">
                              <div className="flex items-center gap-2 rounded-full bg-[#F5F5F7]/80 px-4 py-1.5 text-[12px] font-semibold text-[#1D1D1F] border border-[#D2D2D7]/20">
                                <span className="opacity-50 text-[10px]">👤</span>
                                {m.manager_name || "—"}
                                {m.manager_contact && (
                                  <>
                                    <span className="w-[1px] h-2 bg-[#D2D2D7] mx-1"></span>
                                    <span className="text-[#86868B]">{m.manager_contact}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex flex-col gap-3 sm:w-56">
                        <CopyRecordLinkButton projectId={id} cpId={cp.id} />
                        <div className="flex gap-2">
                          <Link
                            href={`/projects/${id}/checkpoints/${cp.id}/edit`}
                            className="flex-1 flex items-center justify-center gap-2 rounded-full border border-[#D2D2D7] bg-white py-2.5 text-[12px] font-semibold text-[#1D1D1F] transition hover:bg-[#F5F5F7] active:scale-[0.98]"
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
