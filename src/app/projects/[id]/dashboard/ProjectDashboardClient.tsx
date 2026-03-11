"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = (projectId: string) => `dashboard_verified_${projectId}`;
const POLL_INTERVAL_MS = 15 * 1000;

type Checkpoint = { id: string; name: string; code?: string | null };
type Session = { checkpoint_id: string; first_arrival_at: string | null; stage: string };
type Props = {
  projectId: string;
  projectName: string;
  hasDashboardPassword: boolean;
  records: Record<string, unknown>[];
  checkpoints: Checkpoint[];
  sessions?: Session[];
};

type QtyRow = { quantity?: number; checkpoint_material_id?: string; checkpoint_materials?: { id?: string; name?: string } };

function useConsumptionByCp(records: Record<string, unknown>[]) {
  return useMemo(() => {
    const initialByCp: Record<string, Record<string, number>> = {};
    const finalByCp: Record<string, Record<string, number>> = {};
    const materialNames: Record<string, string> = {};
    for (const r of records) {
      const cpId = r.checkpoint_id as string;
      const step = (r.step_status) as string | undefined;
      const quantities = (r.cp_record_material_quantities as QtyRow[] | null) ?? [];
      if (step === "pre_race" && !initialByCp[cpId]) {
        initialByCp[cpId] = {};
        for (const q of quantities) {
          const id = q.checkpoint_material_id ?? q.checkpoint_materials?.id;
          if (id) {
            initialByCp[cpId][id] = Number(q.quantity) ?? 0;
            if (q.checkpoint_materials?.name) materialNames[id] = q.checkpoint_materials.name;
          }
        }
      }
      if (step === "finished" && !finalByCp[cpId]) {
        finalByCp[cpId] = {};
        for (const q of quantities) {
          const id = q.checkpoint_material_id ?? q.checkpoint_materials?.id;
          if (id) {
            finalByCp[cpId][id] = Number(q.quantity) ?? 0;
            if (q.checkpoint_materials?.name) materialNames[id] = q.checkpoint_materials.name;
          }
        }
      }
    }
    return { initialByCp, finalByCp, materialNames };
  }, [records]);
}

function useCpStatuses(checkpoints: Checkpoint[], records: Record<string, unknown>[]) {
  return useMemo(() => {
    const statusMap: Record<string, { 
      lastRecordAt: string | null; 
      stage: string; 
      isEmergency: boolean;
      temp: number | null;
      hum: number | null;
    }> = {};

    // Initialize with default values
    checkpoints.forEach(cp => {
      statusMap[cp.id] = { 
        lastRecordAt: null, 
        stage: "ready", 
        isEmergency: false,
        temp: null,
        hum: null
      };
    });

    // Update with latest record for each CP
    // Records are sorted by recorded_at desc in the query usually, but let's be safe
    const sortedRecords = [...records].sort((a, b) => 
      new Date(b.recorded_at as string).getTime() - new Date(a.recorded_at as string).getTime()
    );

    for (const r of sortedRecords) {
      const cpId = r.checkpoint_id as string;
      if (statusMap[cpId] && statusMap[cpId].lastRecordAt === null) {
        statusMap[cpId] = {
          lastRecordAt: r.recorded_at as string,
          stage: (r.step_status ?? "operating") as string,
          isEmergency: !!r.is_emergency,
          temp: r.temperature as number | null,
          hum: r.humidity as number | null
        };
      }
    }

    return statusMap;
  }, [checkpoints, records]);
}

export default function ProjectDashboardClient({
  projectId,
  projectName,
  hasDashboardPassword,
  records,
  checkpoints,
  sessions = [],
}: Props) {
  const router = useRouter();
  const { initialByCp, finalByCp, materialNames } = useConsumptionByCp(records);
  const cpStatuses = useCpStatuses(checkpoints, records);
  
  const sessionMap = useMemo(() => {
    const map: Record<string, Session> = {};
    sessions.forEach(s => {
      map[s.checkpoint_id] = s;
    });
    return map;
  }, [sessions]);

  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!hasDashboardPassword) {
      setUnlocked(true);
      return;
    }
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY(projectId));
      if (stored === "1") setUnlocked(true);
    } catch {
      // ignore
    }
  }, [hasDashboardPassword, projectId]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    router.refresh();
    // router.refresh() doesn't return a promise, so we use a small delay to show feedback
    setTimeout(() => {
      setLastRefreshedAt(new Date());
      setIsRefreshing(false);
    }, 1000);
  };

  useEffect(() => {
    if (!unlocked) return;
    const id = setInterval(() => {
      setIsRefreshing(true);
      router.refresh();
      setTimeout(() => {
        setLastRefreshedAt(new Date());
        setIsRefreshing(false);
      }, 1000);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [unlocked, router]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/project-dashboard-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, password: password.trim() }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (data.ok) {
        try {
          sessionStorage.setItem(STORAGE_KEY(projectId), "1");
        } catch {
          // ignore
        }
        setUnlocked(true);
      } else {
        setError("비밀번호가 일치하지 않습니다.");
      }
    } catch {
      setError("확인 중 오류가 났습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (hasDashboardPassword && !unlocked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0F172A] px-6">
        <div className="w-full max-w-sm rounded-[2.5rem] bg-slate-800 p-10 shadow-2xl border border-slate-700">
          <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-2xl shadow-inner border border-slate-700">
            📊
          </div>
          <h2 className="text-center text-2xl font-black tracking-tight text-white uppercase">
            Dashboard Key
          </h2>
          <p className="mt-2 text-center text-sm font-medium text-slate-400">
            실시간 대시보드 접근 비밀번호를 입력하세요
          </p>
          <form onSubmit={handleVerify} className="mt-10 space-y-6">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••"
              autoComplete="off"
              autoFocus
              className="w-full rounded-2xl bg-slate-900 border-2 border-slate-700 px-6 py-5 text-center text-2xl font-black tracking-[0.5em] text-[--brand-primary] placeholder:text-slate-700 focus:border-[--brand-primary] focus:outline-none focus:ring-4 focus:ring-[--brand-primary]/20 transition-all"
            />
            {error && (
              <p className="text-center text-sm font-bold text-red-400">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="btn-active w-full rounded-2xl bg-[--brand-primary] py-5 text-lg font-black text-slate-900 shadow-xl shadow-[--brand-primary]/10 transition-all active:bg-[--brand-primary]/80 disabled:opacity-50"
            >
              {loading ? "Checking..." : "ACCESS DASHBOARD"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] p-4 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[--brand-primary] flex items-center justify-center text-slate-900 font-black italic shadow-[0_0_20px_rgba(223,255,0,0.3)]">
                CT
              </div>
              <h1 className="text-3xl font-black text-white tracking-tight uppercase">
                {projectName} <span className="text-[--brand-primary]">Control Tower</span>
              </h1>
            </div>
            <div className="mt-2 flex items-center gap-4">
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                </span>
                Live Status
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                Auto-refresh every 15s
              </span>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <span className={`h-1.5 w-1.5 rounded-full ${isRefreshing ? "bg-blue-500 animate-ping" : "bg-slate-700"}`} />
                Last updated: {lastRefreshedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className={`btn-active rounded-xl bg-white/5 border border-white/10 p-3 text-white transition hover:bg-white/10 ${isRefreshing ? "opacity-50 cursor-not-allowed" : ""}`}
              title="Manual Refresh"
            >
              <span className={`block transition-transform duration-500 ${isRefreshing ? "animate-spin" : ""}`}>
                🔄
              </span>
            </button>
            <a
              href={`/api/export/csv?projectId=${projectId}`}
              className="btn-active rounded-xl bg-white/5 border border-white/10 px-6 py-3 text-xs font-black text-white transition hover:bg-white/10 uppercase tracking-widest"
            >
              Export CSV
            </a>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          <StatCard title="Total Checkpoints" value={checkpoints.length} unit="CPs" />
          <StatCard title="Latest Record" value={records[0] ? new Date(records[0].recorded_at as string).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : "-"} unit="Recent" />
          <StatCard title="Total Records" value={records.length} unit="Entries" />
          <StatCard title="Emergencies" value={records.filter(r => r.is_emergency).length} unit="Alerts" variant="warning" />
        </div>

        {/* 3번: 선수 흐름 타임라인 (Runner Flow) */}
        <section className="space-y-6">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Runner Flow Timeline (Leader Board)</h2>
          <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-800 bg-slate-900/50 p-8 shadow-2xl backdrop-blur-xl">
            <div className="relative flex items-center justify-between gap-4 overflow-x-auto pb-4 scrollbar-hide">
              {/* 타임라인 연결선 */}
              <div className="absolute top-1/2 left-0 h-0.5 w-full -translate-y-1/2 bg-slate-800" />
              
              {checkpoints.map((cp, index) => {
                const session = sessionMap[cp.id];
                const isReached = session?.first_arrival_at != null;
                const isCurrentFrontier = isReached && (index === checkpoints.length - 1 || !sessionMap[checkpoints[index+1].id]?.first_arrival_at);

                return (
                  <div key={cp.id} className="relative z-10 flex flex-col items-center min-w-[140px]">
                    {/* CP 포인트 원 */}
                    <div className={`flex h-12 w-12 items-center justify-center rounded-full border-4 transition-all duration-500 ${
                      isCurrentFrontier 
                        ? "bg-[--brand-primary] border-white shadow-[0_0_20px_rgba(223,255,0,0.6)] scale-125" 
                        : isReached 
                          ? "bg-slate-700 border-slate-500" 
                          : "bg-slate-900 border-slate-800"
                    }`}>
                      {isCurrentFrontier ? (
                        <span className="text-xl animate-bounce">🏃</span>
                      ) : isReached ? (
                        <span className="text-white text-xs font-black">✓</span>
                      ) : (
                        <span className="text-slate-600 text-xs font-black">{index + 1}</span>
                      )}
                    </div>
                    
                    {/* 정보 레이블 */}
                    <div className="mt-4 text-center">
                      <p className={`text-xs font-black uppercase tracking-tight ${isReached ? "text-white" : "text-slate-600"}`}>
                        {cp.name}
                      </p>
                      {session?.first_arrival_at && (
                        <p className="mt-1 text-[10px] font-bold text-[--brand-primary] tabular-nums">
                          {new Date(session.first_arrival_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>

                    {isCurrentFrontier && (
                      <div className="absolute -top-8 bg-[--brand-primary] px-2 py-0.5 rounded text-[8px] font-black text-slate-900 uppercase tracking-widest animate-pulse">
                        Race Leader
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 2번: 환경 모니터링 (Weather Matrix Summary) */}
        <section className="space-y-6">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Weather & Safety Matrix</h2>
          <div className="overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900/50 p-6 shadow-2xl backdrop-blur-xl">
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:grid-cols-6">
              {checkpoints.map((cp) => {
                const status = cpStatuses[cp.id];
                if (status.temp === null) return null;
                
                // 기온에 따른 색상 (추움/적당/더움)
                let tempColor = "text-white";
                if (status.temp < 10) tempColor = "text-blue-400";
                else if (status.temp > 28) tempColor = "text-orange-500";
                
                return (
                  <div key={cp.id} className="group relative text-center border-r border-slate-800 last:border-0 last:pr-0 pr-8">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 truncate mb-2">{cp.name}</p>
                    <div className="flex flex-col items-center">
                      <span className={`text-2xl font-black italic tracking-tighter ${tempColor}`}>
                        {status.temp}°
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        {status.hum}%
                      </span>
                    </div>
                  </div>
                );
              }).filter(Boolean)}
            </div>
            {checkpoints.filter(cp => cpStatuses[cp.id].temp !== null).length === 0 && (
              <p className="text-center text-xs font-bold text-slate-600 py-4 uppercase tracking-widest">Waiting for environmental data...</p>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Live CP Status Grid</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {checkpoints.map((cp) => {
              const status = cpStatuses[cp.id];
              const now = Date.now();
              const lastUpdate = status.lastRecordAt ? new Date(status.lastRecordAt).getTime() : 0;
              const diffMins = Math.floor((now - lastUpdate) / (1000 * 60));

              let statusColor = "bg-slate-800 border-slate-700 text-slate-400"; // Gray (Ready/None)
              let statusLabel = "READY";
              let dotColor = "bg-slate-600";
              let pulse = false;
              let isLowSupply = false;

              // 물자 부족 체크 (20% 미만 남았을 때)
              const cpInitial = initialByCp[cp.id] || {};
              const cpFinal = finalByCp[cp.id] || {};
              const materialIds = Array.from(new Set([...Object.keys(cpInitial), ...Object.keys(cpFinal)]));
              
              for (const mid of materialIds) {
                const init = cpInitial[mid] || 0;
                const fin = cpFinal[mid] || 0;
                if (init > 0 && fin / init < 0.2) {
                  isLowSupply = true;
                  break;
                }
              }

              if (status.stage === "closed") {
                statusLabel = "CLOSED";
              } else if (status.isEmergency) {
                statusColor = "bg-red-900/40 border-red-500 text-red-100 shadow-[0_0_15px_rgba(239,68,68,0.3)]";
                statusLabel = "EMERGENCY";
                dotColor = "bg-red-500";
                pulse = true;
              } else if (isLowSupply) {
                statusColor = "bg-orange-900/30 border-orange-500 text-orange-100 shadow-[0_0_15px_rgba(249,115,22,0.3)]";
                statusLabel = "LOW SUPPLY";
                dotColor = "bg-orange-500";
                pulse = true;
              } else if (status.lastRecordAt) {
                if (diffMins > 20) {
                  statusColor = "bg-red-900/20 border-red-800 text-red-200 shadow-[0_0_10px_rgba(153,27,27,0.2)]";
                  statusLabel = "CRITICAL DELAY";
                  dotColor = "bg-red-700";
                  pulse = true;
                } else if (diffMins > 10) {
                  statusColor = "bg-amber-900/30 border-amber-500 text-amber-100 shadow-[0_0_10px_rgba(245,158,11,0.2)]";
                  statusLabel = "DELAYED";
                  dotColor = "bg-amber-500";
                  pulse = true;
                } else {
                  statusColor = "bg-green-900/20 border-green-500/50 text-green-50 shadow-[0_0_10px_rgba(34,197,94,0.15)]";
                  statusLabel = "NORMAL";
                  dotColor = "bg-green-500";
                }
              }

              return (
                <div key={cp.id} className={`relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:scale-[1.02] ${statusColor}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${dotColor} ${pulse ? "animate-pulse" : ""}`} />
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-70">
                          {statusLabel}
                        </span>
                      </div>
                      <h3 className="mt-2 truncate text-lg font-black tracking-tight text-white uppercase italic">
                        {cp.name}
                      </h3>
                    </div>
                    {status.temp !== null && (
                      <div className="text-right">
                        <div className="text-xl font-black text-white tracking-tighter italic">
                          {status.temp}°
                        </div>
                        <div className="text-[10px] font-bold opacity-60 uppercase tracking-widest">
                          {status.hum}% Hum
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-6 flex items-end justify-between border-t border-white/5 pt-4">
                    <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                      Last Update
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black text-white italic">
                        {status.lastRecordAt ? new Date(status.lastRecordAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : "No Data"}
                      </div>
                      {status.lastRecordAt && (
                        <div className={`text-[10px] font-bold ${diffMins > 10 ? "text-amber-400" : "opacity-60"}`}>
                          {diffMins} min ago
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Material Consumption Analysis</h2>
          <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
            {checkpoints.map((cp) => {
              const cpInitial = initialByCp[cp.id] || {};
              const cpFinal = finalByCp[cp.id] || {};
              const materialIds = Array.from(new Set([...Object.keys(cpInitial), ...Object.keys(cpFinal)]));

              if (materialIds.length === 0) return null;

              return (
                <div key={cp.id} className="overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900/50 p-8 shadow-xl">
                  <h3 className="flex items-center gap-2 text-lg font-black text-white tracking-tight">
                    <span className="text-[--brand-primary] italic">#</span> {cp.name}
                  </h3>
                  <div className="mt-8 space-y-6">
                    {materialIds.map((mid) => {
                      const init = cpInitial[mid] || 0;
                      const fin = cpFinal[mid] || 0;
                      const consumed = init - fin;
                      const percent = init > 0 ? Math.round((consumed / init) * 100) : 0;

                      return (
                        <div key={mid} className="space-y-3">
                          <div className="flex items-end justify-between">
                            <div>
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{materialNames[mid] || "Material"}</span>
                              <div className="mt-1 text-sm font-black text-white">
                                {init} → {fin} <span className="ml-2 text-[--brand-primary]">{consumed > 0 ? `-${consumed}` : "0"}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-xl font-black text-white tracking-tighter">{percent}%</span>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Consumed</p>
                            </div>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                            <div
                              className="h-full bg-[--brand-primary] transition-all duration-500 shadow-[0_0_10px_rgba(223,255,0,0.5)]"
                              style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Activity Log</h2>
          <div className="overflow-hidden rounded-[2.5rem] border border-slate-800 bg-slate-900/50 shadow-2xl backdrop-blur-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-slate-800 bg-slate-900/50">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Checkpoint</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Time</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Materials</th>
                    <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Temp/Hum</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {!records.length ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-20 text-center text-sm font-bold text-slate-600">
                        NO ACTIVITY LOGS FOUND
                      </td>
                    </tr>
                  ) : (
                    records.map((r: Record<string, unknown>) => {
                      const cp = r.checkpoints as { name?: string; code?: string } | null;
                      const quantities = (r.cp_record_material_quantities as any[]) || [];
                      const isEmergency = r.is_emergency as boolean;

                      return (
                        <tr key={r.id as string} className={`group hover:bg-slate-800/30 transition-colors ${isEmergency ? "bg-red-900/10" : ""}`}>
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className={`h-2 w-2 rounded-full ${isEmergency ? "bg-red-500 animate-pulse" : "bg-slate-700"}`} />
                              <span className="text-sm font-black text-white tracking-tight">{cp?.name || "-"}</span>
                            </div>
                          </td>
                          <td className="px-8 py-5 text-xs font-bold text-slate-400 tracking-tighter">
                            {new Date(r.recorded_at as string).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex flex-wrap gap-2">
                              {quantities.map((q, i) => (
                                <span key={i} className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-black text-slate-300 border border-slate-700">
                                  {q.checkpoint_materials?.name} {q.quantity}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-8 py-5 text-right">
                            <span className="text-sm font-black text-white">{String(r.temperature ?? "-")}°C</span>
                            <span className="ml-2 text-[10px] font-bold text-slate-600">{String(r.humidity ?? "-")}%</span>
                          </td>
                          <td className="px-8 py-5">
                            {isEmergency ? (
                              <span className="rounded-full bg-red-500/10 px-3 py-1 text-[10px] font-black text-red-500 border border-red-500/20 uppercase">Alert</span>
                            ) : (
                              <span className="rounded-full bg-slate-800 px-3 py-1 text-[10px] font-black text-slate-500 border border-slate-700 uppercase">Normal</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ title, value, unit, variant = "default" }: { title: string, value: string | number, unit: string, variant?: "default" | "warning" }) {
  const isNumeric = typeof value === "number";
  const isPositive = isNumeric && (value as number) > 0;

  return (
    <div className={`rounded-[2rem] border p-8 shadow-xl transition-all hover:-translate-y-1 ${
      variant === "warning" && isPositive 
        ? "border-red-900 bg-red-900/20 shadow-red-900/20" 
        : "border-slate-800 bg-slate-900 shadow-slate-950/50"
    }`}>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</p>
      <div className="mt-4 flex items-baseline gap-2">
        <span className={`text-4xl font-black tracking-tighter ${
          variant === "warning" && isPositive ? "text-red-500" : "text-white"
        }`}>
          {value}
        </span>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{unit}</span>
      </div>
    </div>
  );
}
