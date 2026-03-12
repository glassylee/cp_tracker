import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { params: Promise<{ id: string }> };

export default async function ProjectReviewPage({ params }: Props) {
  const { id: projectId } = await params;
  const supabase = await createClient();

  // 1. 대회 기본 정보 가져오기
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    console.error("Project fetch error:", projectError);
    notFound();
  }

  // 2. CP 목록 가져오기 (가장 단순한 형태로 먼저 시도)
  const { data: checkpoints, error: cpError } = await supabase
    .from("checkpoints")
    .select(`
      id, 
      name, 
      code, 
      sort_order
    `)
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (cpError) {
    console.error("Checkpoints fetch error:", cpError);
  }

  const safeCheckpoints = checkpoints || [];
  const cpIds = safeCheckpoints.map(cp => cp.id);

  // 3. 물자 설정 가져오기 (별도 쿼리)
  const { data: allMaterials } = await supabase
    .from("checkpoint_materials")
    .select("id, name, checkpoint_id")
    .in("checkpoint_id", cpIds);

  // 4. 모든 기록 가져오기
  const { data: records, error: recordsError } = await supabase
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
    .in("checkpoint_id", cpIds)
    .order("recorded_at", { ascending: true });

  if (recordsError) {
    console.error("Records fetch error:", recordsError);
  }

  const safeRecords = records || [];

  // 5. 데이터 가공
  const reviewData = safeCheckpoints.map(cp => {
    const cpRecords = safeRecords.filter(r => String(r.checkpoint_id) === String(cp.id));
    const cpMaterials = allMaterials?.filter(m => String(m.checkpoint_id) === String(cp.id)) || [];
    
    // 초기 물량 (pre_race 단계)
    const preRaceRecord = cpRecords.find(r => r.step_status === "pre_race");
    const initialStocks: Record<string, number> = {};
    preRaceRecord?.cp_record_material_quantities?.forEach((q: any) => {
      initialStocks[String(q.checkpoint_material_id)] = Number(q.quantity) || 0;
    });

    // 시간대별 통계
    const hourlyStats: Record<string, { temp: number[], hum: number[], consumption: Record<string, number> }> = {};
    cpRecords.forEach(r => {
      if (!r.recorded_at) return;
      const hourKey = `${new Date(r.recorded_at).getHours()}:00`;
      
      if (!hourlyStats[hourKey]) {
        hourlyStats[hourKey] = { temp: [], hum: [], consumption: {} };
      }
      
      if (r.temperature != null) hourlyStats[hourKey].temp.push(Number(r.temperature));
      if (r.humidity != null) hourlyStats[hourKey].hum.push(Number(r.humidity));
      
      r.cp_record_material_quantities?.forEach((q: any) => {
        const mId = String(q.checkpoint_material_id);
        hourlyStats[hourKey].consumption[mId] = (hourlyStats[hourKey].consumption[mId] || 0) + (Number(q.quantity) || 0);
      });
    });

    return {
      ...cp,
      materials: cpMaterials,
      initialStocks,
      hourlyStats,
      events: cpRecords.filter(r => r.is_emergency || (r.notes && r.notes.trim()))
    };
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-12">
      <div className="border-b pb-8">
        <Link href={`/projects/${projectId}`} className="text-sm text-slate-500 hover:underline font-bold">← 대회 관리로 돌아가기</Link>
        <h1 className="text-4xl font-black text-black mt-4">{project.name} 리포트</h1>
        <p className="text-slate-500 font-bold mt-2">대회 종료 후 데이터 분석 및 리뷰</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-8 bg-white rounded-3xl border-2 border-slate-100 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">운영 CP 수</p>
          <p className="text-3xl font-black text-black mt-2">{safeCheckpoints.length}개소</p>
        </div>
        <div className="p-8 bg-white rounded-3xl border-2 border-slate-100 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">총 기록 데이터</p>
          <p className="text-3xl font-black text-black mt-2">{safeRecords.length}건</p>
        </div>
        <div className="p-8 bg-red-50 rounded-3xl border-2 border-red-100 shadow-sm">
          <p className="text-xs font-black text-red-400 uppercase tracking-widest">발생 이벤트</p>
          <p className="text-3xl font-black text-red-600 mt-2">{safeRecords.filter(r => r.is_emergency).length}건</p>
        </div>
      </div>

      {/* 상세 리포트 */}
      <div className="space-y-12">
        <h2 className="text-2xl font-black text-black">CP별 상세 리포트</h2>
        {reviewData.length === 0 ? (
          <div className="p-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed">
            <p className="text-slate-400 font-bold">등록된 체크포인트가 없습니다.</p>
          </div>
        ) : (
          reviewData.map((cp) => (
            <div key={cp.id} className="bg-white rounded-[2.5rem] border-2 border-slate-100 overflow-hidden shadow-sm">
              <div className="bg-slate-50 px-10 py-6 border-b flex items-center justify-between">
                <h3 className="text-xl font-black text-black">{cp.name} <span className="text-slate-400 ml-2 text-sm font-bold">[{cp.code || "CP"}]</span></h3>
              </div>
              <div className="p-10 space-y-10">
                {/* 물자 섹션 */}
                <div>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-5">물자 운영 요약</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {cp.materials.map((m: any) => {
                      const totalUsed = Object.values(cp.hourlyStats).reduce((acc, s) => acc + (s.consumption[m.id] || 0), 0);
                      return (
                        <div key={m.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-[11px] font-bold text-slate-500 mb-1">{m.name}</p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl font-black text-black">{totalUsed}</span>
                            <span className="text-xs text-slate-400 font-bold">소진</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">초기 물량: {cp.initialStocks[m.id] || 0}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 시간대별 섹션 */}
                <div>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-5">시간대별 온습도 및 소진량</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left border-b-2 border-slate-50">
                          <th className="pb-4 text-xs font-black text-slate-400 uppercase">시간</th>
                          <th className="pb-4 text-xs font-black text-slate-400 uppercase">평균 온/습도</th>
                          <th className="pb-4 text-xs font-black text-slate-400 uppercase">물자 소진 기록</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {Object.entries(cp.hourlyStats).sort().map(([hour, stats]) => (
                          <tr key={hour}>
                            <td className="py-5 font-black text-black">{hour}</td>
                            <td className="py-5">
                              <span className="font-bold text-black">{stats.temp.length ? (stats.temp.reduce((a,b)=>a+b,0)/stats.temp.length).toFixed(1) : "-"}°C</span>
                              <span className="text-slate-400 mx-2">/</span>
                              <span className="font-bold text-black">{stats.hum.length ? (stats.hum.reduce((a,b)=>a+b,0)/stats.hum.length).toFixed(1) : "-"}%</span>
                            </td>
                            <td className="py-5">
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(stats.consumption).map(([mId, qty]) => (
                                  <span key={mId} className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black text-slate-600">
                                    {cp.materials.find((m:any) => String(m.id) === mId)?.name || "기타"}: {qty}
                                  </span>
                                ))}
                                {Object.keys(stats.consumption).length === 0 && <span className="text-slate-300 text-xs italic">기록 없음</span>}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 이벤트 섹션 */}
                {cp.events.length > 0 && (
                  <div>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-5">특이사항 로그</h4>
                    <div className="grid gap-3">
                      {cp.events.map((ev: any) => (
                        <div key={ev.id} className={`p-5 rounded-2xl border-2 ${ev.is_emergency ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                          <div className="flex justify-between items-center mb-2">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${ev.is_emergency ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                              {ev.is_emergency ? 'EMERGENCY' : 'NOTE'}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">{new Date(ev.recorded_at).toLocaleTimeString("ko-KR")}</span>
                          </div>
                          <p className="text-sm text-slate-800 font-bold leading-relaxed">{ev.notes}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
