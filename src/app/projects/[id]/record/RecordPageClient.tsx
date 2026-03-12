"use client";

import { useState, useEffect } from "react";
import CpRecordScreen from "./CpRecordScreen";

/** 기록 폼은 hasPassword일 때 반드시 비밀번호 검증 통과 후에만 렌더링됨. 직접 URL 접근 시에도 비밀번호 없으면 내용 노출 안 됨. */
const STORAGE_KEY = (cpId: string) => `cp_verified_${cpId}`;

export type Stage = "ready" | "first_arrival" | "recording" | "closed";

type Session = {
  stage: Stage;
  first_arrival_at: string | null;
  closed_at: string | null;
};

type Material = { id: string; name: string; sort_order: number; unit?: string };

export type RecentRecordItem = {
  id: string;
  recorded_at: string;
  temperature: number | null;
  edited_at: string | null;
  cp_record_material_quantities?: { quantity: number; checkpoint_materials: { name: string } | null }[];
};

type Props = {
  projectId: string;
  projectName: string;
  checkpointId: string;
  checkpointName: string;
  hasPassword: boolean;
  materials: Material[];
  session: Session;
  lastRecordAt: string | null;
  recentRecords: RecentRecordItem[];
};

export default function RecordPageClient({
  projectId,
  projectName,
  checkpointId,
  checkpointName,
  hasPassword,
  materials,
  session,
  lastRecordAt,
  recentRecords,
}: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hasPassword) {
      setUnlocked(true);
      return;
    }
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY(checkpointId));
      if (stored === "1") setUnlocked(true);
    } catch {
      // ignore
    }
  }, [hasPassword, checkpointId]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/checkpoint-verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkpoint_id: checkpointId, password: password.trim() }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (data.ok) {
        try {
          sessionStorage.setItem(STORAGE_KEY(checkpointId), "1");
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

  if (hasPassword && !unlocked) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center px-8 py-12 bg-[#0F172A]">
        <div className="w-full max-w-sm rounded-[2.5rem] bg-slate-800 p-10 shadow-2xl border border-slate-700">
          <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-2xl shadow-inner border border-slate-700">
            🔒
          </div>
          <h2 className="text-center text-2xl font-black tracking-tight text-white uppercase">
            Passcode
          </h2>
          <p className="mt-2 text-center text-sm font-medium text-slate-400">
            접속을 위해 CP 비밀번호를 입력하세요
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
              {loading ? "Verifying..." : "ENTER APP"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#0F172A]">
      <header className="sticky top-0 z-10 shrink-0 border-b border-slate-800 bg-slate-900/80 px-6 py-5 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-[--brand-primary]">
              Live Tracking
            </span>
            <h1 className="text-lg font-black leading-tight text-white tracking-tight">
              {checkpointName}
            </h1>
          </div>
          <div className="rounded-full bg-slate-800 px-3 py-1 text-[10px] font-bold text-slate-400 border border-slate-700">
            {projectName}
          </div>
        </div>
      </header>
      <div className="flex-1 overflow-auto rounded-t-[2.5rem] bg-slate-50 px-4 py-8 shadow-2xl">
        <div className="mx-auto max-w-lg">
          <CpRecordScreen
            projectId={projectId}
            checkpointId={checkpointId}
            checkpointName={checkpointName}
            materials={materials}
            session={session}
            lastRecordAt={lastRecordAt}
            recentRecords={recentRecords}
          />
        </div>
      </div>
    </div>
  );
}
