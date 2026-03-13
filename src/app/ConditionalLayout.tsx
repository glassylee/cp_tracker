"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense, useMemo } from "react";
import ProjectSettingsMenu from "./projects/ProjectSettingsMenu";

interface Project {
  id: string;
  name: string;
  event_date: string | null;
}

function SidebarNav({ sidebarProjects }: { sidebarProjects: Project[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filter = searchParams ? searchParams.get('filter') || 'active' : 'active';
  
  // 클라이언트 사이드에서만 날짜를 계산하여 Hydration Mismatch 방지
  const [today, setToday] = useState<Date | null>(null);
  
  useEffect(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setToday(d);
  }, []);

  const { upcomingProjects, ongoingProjects, finishedProjects } = useMemo(() => {
    if (!today || !Array.isArray(sidebarProjects)) {
      return { upcomingProjects: [], ongoingProjects: sidebarProjects || [], finishedProjects: [] };
    }

    const upcoming: Project[] = [];
    const ongoing: Project[] = [];
    const finished: Project[] = [];

    sidebarProjects.forEach(p => {
      if (!p.event_date) {
        ongoing.push(p);
      } else {
        const eventDate = new Date(p.event_date);
        eventDate.setHours(0, 0, 0, 0);
        
        if (eventDate.getTime() === today.getTime()) {
          ongoing.push(p);
        } else if (eventDate > today) {
          upcoming.push(p);
        } else {
          finished.push(p);
        }
      }
    });

    return { upcomingProjects: upcoming, ongoingProjects: ongoing, finishedProjects: finished };
  }, [sidebarProjects, today]);

  // 하부 메뉴 렌더링 함수
  const renderProjectItem = (p: Project, isPast: boolean) => {
    const isProjectActive = pathname?.startsWith(`/projects/${p.id}`);
    
    return (
      <div key={p.id} className="space-y-0.5">
        <div className="group/item relative flex items-center">
          <a
            href={isPast ? `/projects/${p.id}/review` : `/projects/${p.id}`}
            className={`flex-1 rounded-lg px-4 py-1.5 text-[12px] font-medium truncate transition-all ${
              pathname === `/projects/${p.id}` || pathname === `/projects/${p.id}/review`
                ? "bg-white text-[#0071E3] shadow-sm ring-1 ring-black/5"
                : isProjectActive
                  ? "text-[#1D1D1F] font-bold"
                  : "text-[#86868B] hover:text-[#1D1D1F] hover:bg-white/20"
            }`}
          >
            {p.name}
          </a>
          <div className="absolute right-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
            <ProjectSettingsMenu projectId={p.id} projectName={p.name} variant="sidebar" />
          </div>
        </div>
        {isProjectActive && (
          <div className="ml-4 border-l border-[#D2D2D7]/30 pl-2 space-y-0.5 mt-0.5 mb-2 animate-in slide-in-from-left-2 duration-200">
            <a href={`/projects/${p.id}`} className={`block rounded-lg px-4 py-1 text-[11px] font-medium transition-all ${pathname === `/projects/${p.id}` ? "text-[#0071E3] bg-[#0071E3]/5" : "text-[#86868B] hover:text-[#1D1D1F]"}`}>CP 관리</a>
            <a href={`/projects/${p.id}/dashboard/settings`} className={`block rounded-lg px-4 py-1 text-[11px] font-medium transition-all ${pathname?.includes('/dashboard') ? "text-[#0071E3] bg-[#0071E3]/5" : "text-[#86868B] hover:text-[#1D1D1F]"}`}>대시보드</a>
          </div>
        )}
      </div>
    );
  };

  return (
    <nav className="flex-1 px-3 py-6 space-y-8">
      <div>
        <div className="px-4 mb-3">
          <p className="text-[11px] font-bold text-[#86868B] uppercase tracking-widest italic">Event Management</p>
        </div>
        
        <div className="space-y-0.5">
          {/* 1. 진행 중인 대회 */}
          <div className="flex items-center gap-2.5 px-4 py-2 text-[13px] font-bold text-[#1D1D1F]">
            <span className="w-5 text-center opacity-70">⚡</span>
            진행 대회
          </div>
          <div className="ml-4 border-l border-[#D2D2D7]/50 pl-2 space-y-0.5 mb-4">
            {ongoingProjects.map(p => renderProjectItem(p, false))}
            {today && ongoingProjects.length === 0 && (
              <span className="block px-4 py-1.5 text-[11px] text-[#A1A1A6] italic font-medium">진행 중인 대회 없음</span>
            )}
          </div>

          {/* 2. 예정된 대회 */}
          <div className="flex items-center gap-2.5 px-4 py-2 text-[13px] font-bold text-[#1D1D1F]">
            <span className="w-5 text-center opacity-70">📅</span>
            예정 대회
          </div>
          <div className="ml-4 border-l border-[#D2D2D7]/50 pl-2 space-y-0.5 mb-4">
            {upcomingProjects.map(p => renderProjectItem(p, false))}
            {today && upcomingProjects.length === 0 && (
              <span className="block px-4 py-1.5 text-[11px] text-[#A1A1A6] italic font-medium">예정된 대회 없음</span>
            )}
          </div>

          {/* 3. 종료된 대회 */}
          <div className="flex items-center gap-2.5 px-4 py-2 text-[13px] font-bold text-[#1D1D1F]">
            <span className="w-5 text-center opacity-70">📁</span>
            종료 대회
          </div>
          <div className="ml-4 border-l border-[#D2D2D7]/50 pl-2 space-y-0.5">
            {finishedProjects.map(p => renderProjectItem(p, true))}
            {today && finishedProjects.length === 0 && (
              <span className="block px-4 py-1.5 text-[11px] text-[#A1A1A6] italic font-medium">종료된 대회 없음</span>
            )}
          </div>
        </div>
      </div>
      
      <div>
        <div className="px-4 mb-3">
          <p className="text-[11px] font-bold text-[#86868B] uppercase tracking-widest italic">Analytics</p>
        </div>
        <div className="space-y-0.5">
          <a 
            href="/analytics" 
            className={`flex items-center gap-2.5 rounded-lg px-4 py-2 text-[13px] font-medium transition-all ${
              pathname === "/analytics"
                ? "bg-white text-black shadow-[0_1px_3px_rgba(0,0,0,0.1)] ring-1 ring-black/5"
                : "text-[#1D1D1F] hover:bg-white/50"
            }`}
          >
            <span className="w-5 text-center opacity-70">📊</span>
            통계 및 리포트
          </a>
        </div>
      </div>
    </nav>
  );
}

export default function ConditionalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarProjects, setSidebarProjects] = useState<Project[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function fetchSidebarProjects() {
      try {
        const res = await fetch('/api/projects/sidebar', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data.projects) {
          setSidebarProjects(data.projects);
        }
      } catch (e) {
        console.error("Sidebar projects fetch error:", e);
      }
    }
    fetchSidebarProjects();
    return () => { isMounted = false; };
  }, [pathname]);

  const isRecordPage = pathname?.match(/^\/projects\/[^/]+\/record$/);
  const isDashboardPage = pathname?.match(/^\/projects\/[^/]+\/dashboard$/);

  if (isRecordPage) return <>{children}</>;
  if (isDashboardPage) return <div className="min-h-screen bg-slate-50">{children}</div>;

  return (
    <div className="flex min-h-screen bg-[#F5F5F7]">
      <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r border-[#D2D2D7]/30 bg-[#F5F5F7]/80 backdrop-blur-xl hidden md:block overflow-y-auto">
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center px-8 shrink-0 border-b border-[#D2D2D7]/20">
            <a href="/projects" className="flex items-center gap-2 group">
              <div className="h-6 w-6 rounded-md bg-black flex items-center justify-center text-[--brand-primary] font-black italic text-[10px]">CP</div>
              <span className="text-lg font-semibold tracking-tight text-black">Tracker</span>
            </a>
          </div>

          <Suspense fallback={<div className="flex-1 px-3 py-6 animate-pulse bg-slate-100/50" />}>
            <SidebarNav sidebarProjects={sidebarProjects} />
          </Suspense>

          <div className="p-6 shrink-0 border-t border-[#D2D2D7]/20">
            <div className="rounded-xl bg-white/40 p-4 border border-[#D2D2D7]/20">
              <p className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-2">Admin Portal</p>
              <div className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-full bg-[#1D1D1F] text-white flex items-center justify-center text-[10px] font-bold">AD</div>
                <div>
                  <p className="text-[12px] font-semibold text-[#1D1D1F]">Administrator</p>
                  <p className="text-[10px] text-[#86868B]">v1.0.0 Stable</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 md:pl-64">
        <header className="sticky top-0 z-40 border-b border-[#D2D2D7]/30 bg-[#F5F5F7]/80 backdrop-blur-xl md:hidden">
          <div className="flex items-center justify-between px-6 py-4">
            <a href="/projects" className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-black flex items-center justify-center text-[--brand-primary] font-black italic text-[10px]">CP</div>
              <span className="text-lg font-semibold tracking-tight text-black">Tracker</span>
            </a>
            <button className="rounded-full p-2 text-black hover:bg-black/5 transition-colors">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 5H17M3 10H17M3 15H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-6 py-10 md:px-12 md:py-16">
          {children}
        </main>
      </div>
    </div>
  );
}
