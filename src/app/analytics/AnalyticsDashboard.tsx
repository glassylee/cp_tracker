"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";

interface Project {
  id: string;
  name: string;
  event_date: string | null;
}

interface Checkpoint {
  id: string;
  name: string;
  sort_order: number;
}

interface CpRecord {
  id: string;
  checkpoint_id: string;
  record_stage: string;
  recorded_at: string;
  temperature: number | null;
  humidity: number | null;
  notes: string | null;
  is_emergency: boolean;
  video_url: string | null;
}

interface MaterialQuantity {
  checkpoint_material_id: string;
  checkpoint_id: string;
  quantity: number;
  checkpoint_materials: {
    name: string;
    unit: string | null;
  };
}

export default function AnalyticsDashboard({ projects }: { projects: Project[] }) {
  const searchParams = useSearchParams();
  const projectIdFromUrl = searchParams ? searchParams.get("projectId") : null;
  
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectIdFromUrl || projects[0]?.id || "");
  const [data, setData] = useState<{
    checkpoints: Checkpoint[];
    records: CpRecord[];
    materials: MaterialQuantity[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  // URL 파라미터가 변경되면 선택된 프로젝트 업데이트
  useEffect(() => {
    if (projectIdFromUrl && projectIdFromUrl !== selectedProjectId) {
      setSelectedProjectId(projectIdFromUrl);
      setIsDemo(false);
    }
  }, [projectIdFromUrl]);

  useEffect(() => {
    if (!selectedProjectId || isDemo) return;

    async function fetchProjectData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/analytics/project?id=${selectedProjectId}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (e) {
        console.error("Fetch error:", e);
      } finally {
        setLoading(false);
      }
    }

    fetchProjectData();
  }, [selectedProjectId, isDemo]);

  // 데모 데이터 생성
  const demoData = useMemo(() => {
    if (!selectedProjectId) return null;
    const mockCPs = [
      { id: "cp1", name: "CP1 (출발)", sort_order: 1 },
      { id: "cp2", name: "CP2 (정상)", sort_order: 2 },
      { id: "cp3", name: "CP3 (계곡)", sort_order: 3 },
      { id: "cp4", name: "CP4 (종료)", sort_order: 4 },
    ];
    const mockRecords = [
      { id: "r1", checkpoint_id: "cp1", record_stage: "first_runner", recorded_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), temperature: 18, humidity: 45, notes: null, is_emergency: false, video_url: null },
      { id: "r2", checkpoint_id: "cp2", record_stage: "first_runner", recorded_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), temperature: 15, humidity: 60, notes: null, is_emergency: false, video_url: null },
      { id: "r3", checkpoint_id: "cp3", record_stage: "first_runner", recorded_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), temperature: 22, humidity: 55, notes: "[부상] 1234번 선수 찰과상 처치", is_emergency: true, video_url: "https://example.com/video.mp4" },
      { id: "r4", checkpoint_id: "cp4", record_stage: "first_runner", recorded_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), temperature: 24, humidity: 50, notes: "[컴플레인] 코스 마킹이 부실하여 헤멤", is_emergency: true, video_url: null },
    ];
    const mockMaterials = [
      { checkpoint_material_id: "m1", checkpoint_id: "cp1", quantity: 500, checkpoint_materials: { name: "생수 500ml", unit: "병" } },
      { checkpoint_material_id: "m1", checkpoint_id: "cp2", quantity: 350, checkpoint_materials: { name: "생수 500ml", unit: "병" } },
      { checkpoint_material_id: "m2", checkpoint_id: "cp1", quantity: 200, checkpoint_materials: { name: "에너지젤", unit: "개" } },
      { checkpoint_material_id: "m2", checkpoint_id: "cp3", quantity: 150, checkpoint_materials: { name: "에너지젤", unit: "개" } },
      { checkpoint_material_id: "m3", checkpoint_id: "cp2", quantity: 100, checkpoint_materials: { name: "바나나", unit: "송이" } },
    ];
    return { checkpoints: mockCPs, records: mockRecords, materials: mockMaterials };
  }, [selectedProjectId]);

  const activeData = isDemo ? demoData : data;

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  // 1. Logistics Summary
  const logisticsData = useMemo(() => {
    if (!activeData) return [];
    
    const materialUsage: Record<string, { total: number; unit: string; byCP: Record<string, number> }> = {};
    
    activeData.materials.forEach(m => {
      const name = m.checkpoint_materials.name;
      const unit = m.checkpoint_materials.unit || "개";
      if (!materialUsage[name]) {
        materialUsage[name] = { total: 0, unit, byCP: {} };
      }
      materialUsage[name].total += m.quantity;
      const cpName = activeData.checkpoints.find(cp => cp.id === m.checkpoint_id)?.name || "기타";
      materialUsage[name].byCP[cpName] = (materialUsage[name].byCP[cpName] || 0) + m.quantity;
    });

    return Object.entries(materialUsage).map(([name, info]) => ({ name, ...info }));
  }, [activeData]);

  // 2. Timeline Summary
  const timelineData = useMemo(() => {
    if (!activeData) return [];
    return activeData.checkpoints
      .map(cp => {
        const firstArrival = activeData.records.find(r => r.checkpoint_id === cp.id && r.record_stage === "first_runner");
        return {
          name: cp.name,
          time: firstArrival ? new Date(firstArrival.recorded_at).toLocaleTimeString("ko-KR", { hour: '2-digit', minute: '2-digit' }) : "기록 없음",
          timestamp: firstArrival ? new Date(firstArrival.recorded_at).getTime() : Infinity,
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [activeData]);

  // 3. Emergency & Environment
  const emergencyData = useMemo(() => {
    if (!activeData) return { total: 0, byType: {} as Record<string, number>, logs: [] as CpRecord[] };
    const emergencies = activeData.records.filter(r => r.is_emergency);
    const byType: Record<string, number> = {};
    
    emergencies.forEach(e => {
      const typeMatch = e.notes?.match(/\[(.*?)\]/);
      const type = typeMatch ? typeMatch[1] : "기타";
      byType[type] = (byType[type] || 0) + 1;
    });

    return {
      total: emergencies.length,
      byType,
      logs: emergencies.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()),
    };
  }, [activeData]);

  const environmentData = useMemo(() => {
    if (!activeData) return { avgTemp: 0, avgHum: 0 };
    const validRecords = activeData.records.filter(r => r.temperature !== null && r.humidity !== null);
    if (validRecords.length === 0) return { avgTemp: 0, avgHum: 0 };
    
    const sumTemp = validRecords.reduce((acc, r) => acc + (r.temperature || 0), 0);
    const sumHum = validRecords.reduce((acc, r) => acc + (r.humidity || 0), 0);
    
    return {
      avgTemp: (sumTemp / validRecords.length).toFixed(1),
      avgHum: (sumHum / validRecords.length).toFixed(0),
    };
  }, [activeData]);

  if (!projects.length) {
    return (
      <div className="text-center py-20 bg-white rounded-[2.5rem] border border-[#D2D2D7]/50">
        <p className="text-[#86868B] text-lg">아직 등록된 대회가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Project Selector & Demo Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-white p-8 rounded-[2rem] border border-[#D2D2D7]/50 shadow-sm">
        <div className="flex-1">
          <h2 className="text-[13px] font-bold text-[#86868B] uppercase tracking-widest mb-1 italic">Project Statistics</h2>
          <div className="flex items-center gap-3">
            <p className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">{selectedProject?.name}</p>
            {isDemo && <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-tight">Demo Mode</span>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setIsDemo(!isDemo);
              if (!isDemo) setData(null);
            }}
            className={`px-5 h-12 rounded-2xl text-[13px] font-black transition-all ${
              isDemo 
                ? "bg-[#0071E3] text-white shadow-lg shadow-[#0071E3]/20" 
                : "bg-white border-2 border-[#D2D2D7]/50 text-[#1D1D1F] hover:bg-slate-50"
            }`}
          >
            {isDemo ? "✨ 실기록 보기" : "📊 예시 데이터 보기"}
          </button>
          <select 
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="h-12 px-6 rounded-2xl bg-[#F5F5F7] border-none text-[15px] font-semibold text-[#1D1D1F] focus:ring-2 focus:ring-[#0071E3] transition-all"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <div className="h-10 w-10 border-4 border-[#0071E3]/20 border-t-[#0071E3] rounded-full animate-spin" />
          <p className="text-[#86868B] font-medium">데이터 분석 중...</p>
        </div>
      ) : activeData ? (
        <div className="space-y-16 animate-in fade-in duration-700">
          
          {/* 1. Summary Cards */}
          <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[2.5rem] bg-white border border-[#D2D2D7]/50 p-8 shadow-sm">
              <p className="text-[12px] font-bold text-[#86868B] uppercase tracking-wider mb-4">총 CP 개수</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold text-[#1D1D1F]">{activeData.checkpoints.length}</span>
                <span className="text-[14px] font-medium text-[#86868B]">CPs</span>
              </div>
            </div>
            <div className="rounded-[2.5rem] bg-white border border-[#D2D2D7]/50 p-8 shadow-sm">
              <p className="text-[12px] font-bold text-[#86868B] uppercase tracking-wider mb-4">물자 소진 종류</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold text-[#0071E3]">{logisticsData.length}</span>
                <span className="text-[14px] font-medium text-[#86868B]">Types</span>
              </div>
            </div>
            <div className="rounded-[2.5rem] bg-[#FDF7FF] border border-[#AF52DE]/10 p-8 shadow-sm">
              <p className="text-[12px] font-bold text-[#AF52DE] uppercase tracking-wider mb-4">평균 온/습도</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold text-[#AF52DE]">{environmentData.avgTemp}°</span>
                <span className="text-[14px] font-medium text-[#AF52DE]/60">{environmentData.avgHum}%</span>
              </div>
            </div>
            <div className="rounded-[2.5rem] bg-[#FFF2F2] border border-[#FF3B30]/10 p-8 shadow-sm">
              <p className="text-[12px] font-bold text-[#FF3B30] uppercase tracking-wider mb-4">긴급 상황 건수</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold text-[#FF3B30]">{emergencyData.total}</span>
                <span className="text-[14px] font-medium text-[#FF3B30]/60">Alerts</span>
              </div>
            </div>
          </section>

          {/* 2. Logistics Efficiency */}
          <section className="rounded-[2.5rem] border border-[#D2D2D7]/50 bg-white p-10 shadow-sm">
            <div className="mb-10">
              <h3 className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">물자 운영 효율성 분석</h3>
              <p className="text-[#86868B] mt-2 font-medium">품목별 총 소진량 및 CP별 분배 현황입니다.</p>
            </div>
            <div className="grid gap-12 lg:grid-cols-2">
              <div className="space-y-8">
                {logisticsData.map(item => {
                  const max = Math.max(...logisticsData.map(d => d.total));
                  const percentage = (item.total / max) * 100;
                  return (
                    <div key={item.name} className="space-y-3">
                      <div className="flex justify-between items-end">
                        <span className="text-[15px] font-bold text-[#1D1D1F]">{item.name}</span>
                        <span className="text-[16px] font-black text-[#0071E3]">{item.total.toLocaleString()} {item.unit}</span>
                      </div>
                      <div className="h-4 w-full bg-[#F5F5F7] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#0071E3] rounded-full transition-all duration-1000"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {logisticsData.length === 0 && <p className="text-[#86868B] italic">물자 소진 데이터가 없습니다.</p>}
              </div>
              <div className="bg-[#F5F5F7]/50 rounded-[2rem] p-8">
                <h4 className="text-[13px] font-bold text-[#86868B] uppercase tracking-wider mb-6">CP별 주요 소진 구간</h4>
                <div className="space-y-4">
                  {logisticsData.slice(0, 1).map(mainItem => (
                    Object.entries(mainItem.byCP)
                      .sort(([, a], [, b]) => b - a)
                      .map(([cpName, qty]) => (
                        <div key={cpName} className="flex justify-between items-center py-2 border-b border-[#D2D2D7]/20 last:border-0">
                          <span className="text-[14px] font-semibold text-[#1D1D1F]">{cpName}</span>
                          <span className="text-[14px] font-bold text-[#86868B]">{qty.toLocaleString()} {mainItem.unit}</span>
                        </div>
                      ))
                  ))}
                  {logisticsData.length === 0 && <p className="text-sm text-slate-400">표시할 데이터 없음</p>}
                </div>
              </div>
            </div>
          </section>

          {/* 3. Race Progress & Timeline */}
          <section className="grid gap-10 lg:grid-cols-2">
            <div className="rounded-[2.5rem] border border-[#D2D2D7]/50 bg-white p-10 shadow-sm">
              <h3 className="text-2xl font-semibold text-[#1D1D1F] tracking-tight mb-8">레이스 타임라인 (1등 도착)</h3>
              <div className="relative pl-8 space-y-10 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-[#D2D2D7]/30">
                {timelineData.map((step, idx) => (
                  <div key={idx} className="relative flex justify-between items-center">
                    <div className="absolute -left-[30px] h-6 w-6 rounded-full bg-white border-4 border-[#0071E3] z-10" />
                    <span className="text-[15px] font-bold text-[#1D1D1F]">{step.name}</span>
                    <span className="text-[15px] font-black text-[#0071E3] bg-[#0071E3]/5 px-3 py-1 rounded-full">{step.time}</span>
                  </div>
                ))}
                {timelineData.length === 0 && <p className="text-slate-400 italic">도착 기록 없음</p>}
              </div>
            </div>

            {/* 4. Safety Distribution */}
            <div className="rounded-[2.5rem] border border-[#D2D2D7]/50 bg-white p-10 shadow-sm">
              <h3 className="text-2xl font-semibold text-[#1D1D1F] tracking-tight mb-8">안전 사고 및 특이사항 분포</h3>
              <div className="flex flex-col h-full justify-between">
                <div className="space-y-6">
                  {Object.entries(emergencyData.byType).map(([type, count]) => {
                    const percentage = (count / emergencyData.total) * 100;
                    return (
                      <div key={type} className="flex items-center gap-4">
                        <span className="w-20 text-[13px] font-bold text-[#86868B]">{type}</span>
                        <div className="flex-1 h-8 bg-[#F5F5F7] rounded-lg overflow-hidden relative">
                          <div 
                            className="h-full bg-[#FF3B30]/80 rounded-lg transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                          <span className="absolute inset-y-0 right-3 flex items-center text-[11px] font-black text-[#1D1D1F]">{count}건</span>
                        </div>
                      </div>
                    );
                  })}
                  {emergencyData.total === 0 && <p className="text-center py-20 text-[#86868B]">기록된 특이사항이 없습니다.</p>}
                </div>
              </div>
            </div>
          </section>

          {/* 5. Archive: Emergency Logs */}
          <section className="rounded-[2.5rem] border border-[#D2D2D7]/50 bg-white p-10 shadow-sm">
            <h3 className="text-2xl font-semibold text-[#1D1D1F] tracking-tight mb-8">긴급/특이사항 상세 아카이브</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#D2D2D7]/30">
                    <th className="py-4 text-[13px] font-bold text-[#86868B] uppercase tracking-wider">시각</th>
                    <th className="py-4 text-[13px] font-bold text-[#86868B] uppercase tracking-wider">CP</th>
                    <th className="py-4 text-[13px] font-bold text-[#86868B] uppercase tracking-wider">상세 내용</th>
                    <th className="py-4 text-[13px] font-bold text-[#86868B] uppercase tracking-wider">현장 영상</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F5F7]">
                  {emergencyData.logs.map((log) => (
                    <tr key={log.id} className="group hover:bg-[#F5F5F7]/50 transition-colors">
                      <td className="py-5">
                        <p className="text-[14px] font-bold text-[#1D1D1F]">
                          {new Date(log.recorded_at).toLocaleTimeString("ko-KR", { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </td>
                      <td className="py-5">
                        <span className="text-[13px] font-semibold text-[#86868B]">
                          {activeData.checkpoints.find(cp => cp.id === log.checkpoint_id)?.name}
                        </span>
                      </td>
                      <td className="py-5">
                        <p className="text-[14px] font-medium text-[#1D1D1F] line-clamp-1 max-w-xs">{log.notes}</p>
                      </td>
                      <td className="py-5">
                        {log.video_url ? (
                          <a 
                            href={log.video_url} 
                            target="_blank" 
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0071E3] text-white text-[11px] font-black hover:bg-[#0077ED] transition-colors"
                          >
                            🎥 영상 보기
                          </a>
                        ) : (
                          <span className="text-[11px] font-bold text-[#D2D2D7]">영상 없음</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {emergencyData.logs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-20 text-center text-[#86868B] font-medium">기록된 데이터가 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      ) : (
        <div className="text-center py-32 bg-white rounded-[2.5rem] border border-[#D2D2D7]/50 shadow-sm">
          <p className="text-[#86868B] text-lg">데이터를 불러오는 중입니다...</p>
        </div>
      )}
    </div>
  );
}
