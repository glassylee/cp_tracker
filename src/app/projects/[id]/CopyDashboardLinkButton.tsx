"use client";

import { useState } from "react";
import Link from "next/link";

type Props = {
  projectId: string;
};

export default function CopyDashboardLinkButton({ projectId }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const path = `/projects/${projectId}/dashboard`;
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${path}`
        : path;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          {copied ? "링크가 복사되었습니다" : "대시보드 URL 복사"}
        </button>
        <Link
          href={`/projects/${projectId}/dashboard`}
          className="inline-flex items-center rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          title="대시보드 직접 열기"
        >
          직접 열기
        </Link>
      </div>
      <p className="text-xs text-slate-500">
        이 링크와 설정한 대시보드 비밀번호를 관계자에게 전달하세요
      </p>
    </div>
  );
}
