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

  // 2. CP 목록 가져오기
  const { data: checkpoints } = await supabase
    .from("checkpoints")
    .select(`
      id, name, code,
      checkpoint_materials (id, name)
    `)
    .eq("project_id", projectId)
    .order("sort_order");

  const cpIds = checkpoints?.map(cp => cp.id) || [];

  // 3. 해당 CP들의 모든 기록 가져오기
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

  // 4. 데이터 가공
  const reviewData = checkpoints?.map(cp => {
    const cpRecords = safeRecords.filter(r => r.checkpoint_id === cp.id);
    
    // 기초 물량
    const preRaceRecord = cpRecords.find(r => r.step_status === "pre_race");
    const initialStocks: Record<string, number> = {};
    preRaceRecord?.cp_record_material_quantities?.forEach((q: any) => {
      initialStocks[q.checkpoint_material_id] = q.quantity;
    });

    // 시간대별 통계
    const hourlyStats: Record<string, { temp: number[], hum: number[], consumption: Record<string, number> }> = {};
    cpRecords.forEach(r => {
      if (!r.recorded_at) return;
      const date = new Date(r.recorded_at);
      const hourKey = `${date.getHours()}:00`;
      
      if (!hourlyStats[hourKey]) {
        hourlyStats[hourKey] = { temp: [], hum: [], consumption: {} };
      }
      
      if (r.temperature != null) hourlyStats[hourKey].temp.push(Number(r.temperature));
      if (r.humidity != null) hourlyStats[hourKey].hum.push(Number(r.humidity));
      
      r.cp_record_material_quantities?.forEach((q: any) => {
        hourlyStats[hourKey].consumption[q.checkpoint_material_id] = 
          (hourlyStats[hourKey].consumption[q.checkpoint_material_id] || 0) + (Number(q.quantity) || 0);
      });
    });

    return {
      ...cp,
      initialStocks,
      hourlyStats,
      events: cpRecords.filter(r => r.is_emergency || (r.notes && r.notes.trim()))
    };
  }) || [];

  return (
    <div className="space-y-12 pb-20">
      <div className="border-b pb-8">
        <Link href={`/projects/${projectId}`} className="text-sm text-slate-500 hover:underline">← 대회 관리로 돌아가기</Link>
        <h1 className="text-4xl font-black text-black mt-4">{project.name} 리포트</h1>
        <p className="text-slate-500 font-bold mt-2">대회 종료 후 기록 분석 및 리뷰</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-8 bg-white rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">총 기록 수</p>
          <p className="text-3xl font-black text-black mt-2">{safeRecords.length}건</p>
        </div>
        <div className="p-8 bg-white rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">응급/특이사항</p>
          <p className="text-3xl font-black text-red-600 mt-2">{safeRecords.filter(r => r.is_emergency).length}건</p>
        </div>
        <div className="p-8 bg-white rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">평균 온도</p>
          <p className="text-3xl font-black text-black mt-2">
            {safeRecords.filter(r => r.temperature != null).length 
              ? (safeRecords.reduce((acc, r) => acc + (Number(r.temperature) || 0), 0) / safeRecords.filter(r => r.temperature != null).length).toFixed(1)
              : "-"}°C
          </p>
        </div>
      </div>

      <div className="space-y-10">
        {reviewData.map((cp) => (
          <div key={cp.id} className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-8 py-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-black text-black">{cp.name} ({cp.code || "CP"})</h2>
            </div>
            <div className="p-8 space-y-10">
              {/* 물자 요약 */}
              <div>
                <h3 className="text-sm font-black text-slate-400 uppercase mb-4">물자 운영 현황</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {cp.checkpoint_materials?.map((m: any) => {
                    const totalConsumed = Object.values(cp.hourlyStats).reduce((acc, stat) => acc + (stat.consumption[m.id] || 0), 0);
                    return (
                      <div key={m.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400">{m.name}</p>
                        <p className="text-lg font-black text-black mt-1">총 소진: {totalConsumed}</p>
                        <p className="text-[10px] text-slate-500">초기량: {cp.initialStocks[m.id] || 0}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 시간대별 기록 */}
              <div>
                <h3 className="text-sm font-black text-slate-400 uppercase mb-4">시간대별 통계</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-400 border-b">
                        <th className="py-3 text-left">시간</th>
                        <th className="py-3 text-left">평균 온/습도</th>
                        <th className="py-3 text-left">주요 소진 물자</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {Object.entries(cp.hourlyStats).sort().map(([hour, stats]) => (
                        <tr key={hour}>
                          <td className="py-4 font-bold text-black">{hour}</td>
                          <td className="py-4 text-black">
                            {stats.temp.length ? (stats.temp.reduce((a,b)=>a+b,0)/stats.temp.length).toFixed(1) : "-"}°C / 
                            {stats.hum.length ? (stats.hum.reduce((a,b)=>a+b,0)/stats.hum.length).toFixed(1) : "-"}%
                          </td>
                          <td className="py-4">
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(stats.consumption).map(([mId, qty]) => (
                                <span key={mId} className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-600">
                                  {cp.checkpoint_materials?.find((m:any)=>m.id===mId)?.name}: {qty}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 특이사항 */}
              {cp.events.length > 0 && (
                <div>
                  <h3 className="text-sm font-black text-slate-400 uppercase mb-4">특이사항 및 이벤트</h3>
                  <div className="space-y-3">
                    {cp.events.map((ev: any) => (
                      <div key={ev.id} className={`p-4 rounded-2xl border ${ev.is_emergency ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-[10px] font-black ${ev.is_emergency ? 'text-red-600' : 'text-slate-400'}`}>{ev.is_emergency ? '🚨 긴급' : '📝 기록'}</span>
                          <span className="text-[10px] text-slate-400">{new Date(ev.recorded_at).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-sm text-black font-medium">{ev.notes}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
