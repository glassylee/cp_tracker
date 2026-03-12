import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { params: Promise<{ id: string }> };

export default async function ProjectReviewPage({ params }: Props) {
  const { id: projectId } = await params;
  const supabase = await createClient();

  // 1. 대회 정보 가져오기
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (!project) notFound();

  // 2. CP 목록 및 기초 물자 설정 가져오기
  const { data: checkpoints } = await supabase
    .from("checkpoints")
    .select(`
      id, name, code,
      checkpoint_materials (id, name)
    `)
    .eq("project_id", projectId)
    .order("sort_order");

  // 3. 전체 기록 데이터 가져오기 (물자 소진량 포함)
  const { data: records } = await supabase
    .from("cp_records")
    .select(`
      id,
      checkpoint_id,
      recorded_at,
      temperature,
      humidity,
      notes,
      is_emergency,
      step_status,
      cp_record_material_quantities (
        quantity,
        checkpoint_material_id
      )
    `)
    .eq("project_id", projectId)
    .order("recorded_at", { ascending: true });

  const safeRecords = records || [];

  // 데이터 가공 로직
  const reviewData = checkpoints?.map(cp => {
    const cpRecords = safeRecords.filter(r => r.checkpoint_id === cp.id);
    
    // 기초 물량 (준비 단계의 첫 기록 기준)
    const preRaceRecord = cpRecords.find(r => r.step_status === "pre_race");
    const initialStocks: Record<string, number> = {};
    preRaceRecord?.cp_record_material_quantities?.forEach((q: any) => {
      initialStocks[q.checkpoint_material_id] = q.quantity;
    });

    // 시간대별 요약 (시간 단위로 그룹화)
    const hourlyStats: Record<string, { temp: number[], hum: number[], consumption: Record<string, number> }> = {};
    cpRecords.forEach(r => {
      const date = new Date(r.recorded_at);
      const hourKey = `${date.getHours()}:00`;
      
      if (!hourlyStats[hourKey]) {
        hourlyStats[hourKey] = { temp: [], hum: [], consumption: {} };
      }
      
      if (r.temperature) hourlyStats[hourKey].temp.push(r.temperature);
      if (r.humidity) hourlyStats[hourKey].hum.push(r.humidity);
      
      // 운영 단계에서의 소진량 합산
      if (r.step_status === "operating") {
        r.cp_record_material_quantities?.forEach((q: any) => {
          hourlyStats[hourKey].consumption[q.checkpoint_material_id] = 
            (hourlyStats[hourKey].consumption[q.checkpoint_material_id] || 0) + q.quantity;
        });
      }
    });

    // 이벤트 로그
    const events = cpRecords.filter(r => r.is_emergency || (r.notes && r.notes.trim().length > 0));

    return {
      ...cp,
      initialStocks,
      hourlyStats,
      events
    };
  });

  return (
    <div className="space-y-16 pb-24">
      {/* Title Section */}
      <div className="border-b border-[#D2D2D7]/30 pb-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-block px-3 py-1 rounded-full bg-[#F5F5F7] text-[11px] font-bold text-[#86868B] uppercase tracking-wider mb-4">Post-Event Review</span>
            <h1 className="text-5xl font-semibold tracking-tight text-[#1D1D1F] leading-tight">
              {project.name}
            </h1>
            <p className="mt-4 text-xl font-medium text-[#86868B] tracking-tight">
              {project.event_date ? new Date(project.event_date).toLocaleDateString("ko-KR", { year: 'numeric', month: 'long', day: 'numeric' }) : "날짜 미정"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`/api/export/csv?projectId=${projectId}`}
              className="btn-active inline-flex h-12 items-center justify-center rounded-full bg-[#0071E3] px-8 text-[14px] font-semibold text-white transition-all hover:bg-[#0077ED] shadow-[0_4px_14px_rgba(0,113,227,0.2)]"
            >
              전체 데이터 CSV 다운로드
            </a>
          </div>
        </div>
      </div>

      {/* Summary Stat */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-[2.5rem] bg-white border border-[#D2D2D7]/50 p-10 shadow-sm">
          <p className="text-[13px] font-semibold text-[#86868B] uppercase tracking-wider">총 체크포인트</p>
          <p className="mt-4 text-4xl font-semibold text-[#1D1D1F]">{checkpoints?.length || 0}<span className="text-xl ml-1">CPs</span></p>
        </div>
        <div className="rounded-[2.5rem] bg-white border border-[#D2D2D7]/50 p-10 shadow-sm">
          <p className="text-[13px] font-semibold text-[#86868B] uppercase tracking-wider">누적 기록 데이터</p>
          <p className="mt-4 text-4xl font-semibold text-[#1D1D1F]">{safeRecords.length}<span className="text-xl ml-1">Entries</span></p>
        </div>
        <div className="rounded-[2.5rem] bg-[#FFF2F2] border border-[#FF3B30]/10 p-10 shadow-sm">
          <p className="text-[13px] font-semibold text-[#FF3B30] uppercase tracking-wider">발생 이벤트</p>
          <p className="mt-4 text-4xl font-semibold text-[#FF3B30]">{safeRecords.filter(r => r.is_emergency).length}<span className="text-xl ml-1">Alerts</span></p>
        </div>
      </div>

      {/* CP Details */}
      <div className="space-y-12">
        <h2 className="text-3xl font-semibold tracking-tight text-[#1D1D1F] px-2">CP별 상세 리포트</h2>
        
        {reviewData?.map((cp) => (
          <section key={cp.id} className="rounded-[3rem] border border-[#D2D2D7]/50 bg-white overflow-hidden shadow-[0_2px_20px_rgba(0,0,0,0.02)]">
            <div className="bg-[#F5F5F7]/50 px-10 py-8 border-b border-[#D2D2D7]/30 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-black text-white flex items-center justify-center font-bold text-lg italic">
                  {cp.code || "CP"}
                </div>
                <h3 className="text-2xl font-semibold text-[#1D1D1F]">{cp.name}</h3>
              </div>
            </div>

            <div className="p-10 space-y-12">
              {/* 물자 준비 정보 */}
              <div>
                <h4 className="text-[13px] font-bold text-[#86868B] uppercase tracking-[0.1em] mb-6">최초 준비 물자</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                  {cp.checkpoint_materials?.map((m: any) => (
                    <div key={m.id} className="p-5 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7]/20">
                      <p className="text-[11px] font-semibold text-[#86868B] mb-1">{m.name}</p>
                      <p className="text-xl font-bold text-[#1D1D1F]">{cp.initialStocks[m.id] || 0}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 시간대별 소진량 및 환경 */}
              <div>
                <h4 className="text-[13px] font-bold text-[#86868B] uppercase tracking-[0.1em] mb-6">시간대별 운영 통계 (평균 온습도 및 소진량)</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[#F5F5F7]">
                        <th className="py-4 text-[12px] font-semibold text-[#86868B]">시간</th>
                        <th className="py-4 text-[12px] font-semibold text-[#86868B]">평균 온도/습도</th>
                        <th className="py-4 text-[12px] font-semibold text-[#86868B]">물자 소진 내역</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F5F5F7]">
                      {Object.entries(cp.hourlyStats).map(([hour, stats]) => {
                        const avgTemp = stats.temp.length ? (stats.temp.reduce((a, b) => a + b, 0) / stats.temp.length).toFixed(1) : "-";
                        const avgHum = stats.hum.length ? (stats.hum.reduce((a, b) => a + b, 0) / stats.hum.length).toFixed(1) : "-";
                        
                        return (
                          <tr key={hour} className="group">
                            <td className="py-5 text-[14px] font-bold text-[#1D1D1F]">{hour}</td>
                            <td className="py-5">
                              <span className="text-[14px] font-medium text-[#1D1D1F]">{avgTemp}°C</span>
                              <span className="text-[12px] text-[#86868B] ml-2">/ {avgHum}%</span>
                            </td>
                            <td className="py-5">
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(stats.consumption).map(([mId, qty]) => {
                                  const mName = cp.checkpoint_materials?.find((m: any) => m.id === mId)?.name || "기타";
                                  return (
                                    <span key={mId} className="px-3 py-1 rounded-full bg-[#0071E3]/5 text-[#0071E3] text-[11px] font-bold">
                                      {mName} -{qty}
                                    </span>
                                  );
                                })}
                                {Object.keys(stats.consumption).length === 0 && <span className="text-[12px] text-[#D2D2D7]">소진 기록 없음</span>}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 이벤트 로그 */}
              <div>
                <h4 className="text-[13px] font-bold text-[#86868B] uppercase tracking-[0.1em] mb-6">현장 이벤트 및 특이사항</h4>
                <div className="space-y-3">
                  {cp.events.map((ev: any) => (
                    <div key={ev.id} className={`p-6 rounded-2xl border ${ev.is_emergency ? "bg-[#FFF2F2] border-[#FF3B30]/10" : "bg-[#F5F5F7] border-[#D2D2D7]/20"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[11px] font-bold uppercase tracking-widest ${ev.is_emergency ? "text-[#FF3B30]" : "text-[#86868B]"}`}>
                          {ev.is_emergency ? "🚨 Emergency" : "📝 Note"}
                        </span>
                        <span className="text-[11px] font-medium text-[#86868B]">
                          {new Date(ev.recorded_at).toLocaleTimeString("ko-KR", { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[14px] text-[#1D1D1F] font-medium leading-relaxed">{ev.notes || "내용 없음"}</p>
                    </div>
                  ))}
                  {cp.events.length === 0 && (
                    <p className="text-center py-8 text-[13px] text-[#D2D2D7] font-medium">기록된 이벤트가 없습니다.</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
