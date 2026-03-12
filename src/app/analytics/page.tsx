import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AnalyticsPage() {
  const supabase = await createClient();

  // 1. 전체 통계 데이터 가져오기
  const { data: projects } = await supabase.from("projects").select("id, name, event_date");
  const { count: totalRecords } = await supabase.from("cp_records").select("*", { count: "exact", head: true });
  const { data: emergencies } = await supabase.from("cp_records").select("id").eq("is_emergency", true);
  
  // 2. 물자 소진량 합계 계산 (모든 대회 통합)
  const { data: materialData } = await supabase
    .from("cp_record_material_quantities")
    .select(`
      quantity,
      checkpoint_materials (name)
    `);

  const materialTotals: Record<string, number> = {};
  materialData?.forEach(item => {
    const name = (item.checkpoint_materials as any)?.name || "기타";
    materialTotals[name] = (materialTotals[name] || 0) + (Number(item.quantity) || 0);
  });

  const sortedMaterials = Object.entries(materialTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5); // 상위 5개만

  return (
    <div className="space-y-16 pb-24">
      {/* Header */}
      <div className="border-b border-[#D2D2D7]/30 pb-12">
        <h1 className="text-4xl font-semibold tracking-tight text-[#1D1D1F]">
          통계 및 리포트
        </h1>
        <p className="mt-3 text-[#86868B] text-lg font-medium tracking-tight">
          전체 대회의 운영 데이터와 물자 소진 현황을 분석합니다.
        </p>
      </div>

      {/* Global Stat Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[2.5rem] bg-white border border-[#D2D2D7]/50 p-8 shadow-sm">
          <p className="text-[13px] font-semibold text-[#86868B] uppercase tracking-wider">총 대회 수</p>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-semibold text-[#1D1D1F]">{projects?.length || 0}</span>
            <span className="text-[14px] font-medium text-[#86868B]">Events</span>
          </div>
        </div>
        <div className="rounded-[2.5rem] bg-white border border-[#D2D2D7]/50 p-8 shadow-sm">
          <p className="text-[13px] font-semibold text-[#86868B] uppercase tracking-wider">누적 기록 수</p>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-semibold text-[#1D1D1F]">{totalRecords || 0}</span>
            <span className="text-[14px] font-medium text-[#86868B]">Entries</span>
          </div>
        </div>
        <div className="rounded-[2.5rem] bg-white border border-[#D2D2D7]/50 p-8 shadow-sm">
          <p className="text-[13px] font-semibold text-[#86868B] uppercase tracking-wider">총 소진 물자</p>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-semibold text-[#0071E3]">
              {Object.values(materialTotals).reduce((a, b) => a + b, 0).toLocaleString()}
            </span>
            <span className="text-[14px] font-medium text-[#86868B]">Items</span>
          </div>
        </div>
        <div className="rounded-[2.5rem] bg-[#FFF2F2] border border-[#FF3B30]/10 p-8 shadow-sm">
          <p className="text-[13px] font-semibold text-[#FF3B30] uppercase tracking-wider">누적 긴급 상황</p>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-semibold text-[#FF3B30]">{emergencies?.length || 0}</span>
            <span className="text-[14px] font-medium text-[#FF3B30]/60">Alerts</span>
          </div>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        {/* Material Chart */}
        <section className="rounded-[2.5rem] border border-[#D2D2D7]/50 bg-white p-10">
          <h2 className="text-2xl font-semibold text-[#1D1D1F] tracking-tight mb-8">주요 물자 소비 트렌드</h2>
          <div className="space-y-8">
            {sortedMaterials.length > 0 ? sortedMaterials.map(([name, total]) => {
              const max = Math.max(...Object.values(materialTotals));
              const percentage = (total / max) * 100;
              return (
                <div key={name} className="space-y-3">
                  <div className="flex justify-between items-end px-1">
                    <span className="text-[15px] font-semibold text-[#1D1D1F]">{name}</span>
                    <span className="text-[17px] font-bold text-[#1D1D1F]">{total.toLocaleString()}</span>
                  </div>
                  <div className="h-3 w-full bg-[#F5F5F7] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#0071E3] rounded-full transition-all duration-1000"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            }) : (
              <p className="text-center py-10 text-[#86868B]">분석할 데이터가 없습니다.</p>
            )}
          </div>
        </section>

        {/* Project List */}
        <section className="rounded-[2.5rem] border border-[#D2D2D7]/50 bg-white p-10">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">대회별 요약</h2>
            <Link href="/projects" className="text-[13px] font-semibold text-[#0071E3] hover:underline">
              전체 보기 →
            </Link>
          </div>
          <div className="divide-y divide-[#F5F5F7]">
            {projects?.slice(0, 5).map((project) => (
              <div key={project.id} className="py-5 flex items-center justify-between group">
                <div>
                  <p className="text-[15px] font-semibold text-[#1D1D1F] group-hover:text-[#0071E3] transition-colors">
                    {project.name}
                  </p>
                  <p className="text-[12px] text-[#86868B] font-medium mt-0.5">
                    {project.event_date ? new Date(project.event_date).toLocaleDateString() : "날짜 미정"}
                  </p>
                </div>
                <Link 
                  href={`/projects/${project.id}/dashboard/settings`}
                  className="h-8 w-8 rounded-full bg-[#F5F5F7] flex items-center justify-center text-[#1D1D1F] opacity-0 group-hover:opacity-100 transition-all"
                >
                  →
                </Link>
              </div>
            ))}
            {(!projects || projects.length === 0) && (
              <p className="text-center py-10 text-[#86868B]">등록된 대회가 없습니다.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
