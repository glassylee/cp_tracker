import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import CopyDashboardLinkButton from "../../CopyDashboardLinkButton";

type Props = { params: Promise<{ id: string }> };

export default async function DashboardSettingsPage({ params }: Props) {
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

  return (
    <div className="space-y-16 pb-24">
      {/* Top Navigation & Title */}
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
            <p className="mt-4 text-xl font-medium text-[#86868B] tracking-tight">
              실시간 대시보드 설정
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/projects/${id}/dashboard`}
              className="btn-active inline-flex h-12 items-center justify-center rounded-full bg-black px-8 text-[14px] font-semibold text-white transition-all hover:bg-[#1D1D1F] shadow-[0_4px_14px_rgba(0,0,0,0.1)]"
            >
              대시보드 보기
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-2xl space-y-10">
        <section className="rounded-[2.5rem] border border-[#D2D2D7]/50 bg-white p-10 shadow-[0_2px_15px_rgba(0,0,0,0.02)]">
          <div className="mb-10">
            <h2 className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">
              공유 및 보안
            </h2>
            <p className="mt-2 text-[15px] font-medium text-[#86868B]">
              대시보드 접속 링크를 복사하거나 비밀번호를 관리하세요.
            </p>
          </div>

          <div className="space-y-8">
            <div className="p-6 rounded-3xl bg-[#F5F5F7] border border-[#D2D2D7]/30">
              <h3 className="text-[13px] font-semibold text-[#1D1D1F] mb-4 px-1 uppercase tracking-wider">접속 링크</h3>
              <CopyDashboardLinkButton projectId={id} />
              <p className="mt-4 text-[12px] text-[#86868B] px-1 font-medium leading-relaxed">
                이 링크를 복사하여 관제 담당자에게 전달하세요. 비밀번호가 설정된 경우 비밀번호도 함께 전달해야 합니다.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white border border-[#D2D2D7]/50">
              <h3 className="text-[13px] font-semibold text-[#1D1D1F] mb-4 px-1 uppercase tracking-wider">비밀번호 관리</h3>
              <Link
                href={`/projects/${id}/edit`}
                className="btn-active inline-flex items-center gap-2 text-[14px] font-semibold text-[#0071E3] hover:underline"
              >
                대회 정보 수정에서 비밀번호 변경하기 →
              </Link>
              <p className="mt-3 text-[12px] text-[#86868B] px-1 font-medium">
                대시보드 보안 비밀번호는 '대회 수정' 화면에서 변경하실 수 있습니다.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
