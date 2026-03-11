"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md rounded-xl border border-red-200 bg-white p-8 shadow-sm">
        <h1 className="text-lg font-semibold text-red-800">오류가 발생했습니다</h1>
        <p className="mt-2 text-sm text-slate-600">
          {error.message || "알 수 없는 오류입니다."}
        </p>
        <p className="mt-4 text-xs text-slate-500">
          터미널에서 <code className="rounded bg-slate-100 px-1">npm run dev</code>가 실행 중인지 확인하고, 
          .env.local에 Supabase 설정이 있는지 확인하세요.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          다시 시도
        </button>
        <a
          href="/"
          className="ml-3 inline-block rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          홈으로
        </a>
      </div>
    </div>
  );
}
