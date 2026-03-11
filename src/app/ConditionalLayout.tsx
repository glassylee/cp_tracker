"use client";

import { usePathname } from "next/navigation";

export default function ConditionalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isRecordPage = pathname?.match(/^\/projects\/[^/]+\/record$/);
  const isDashboardPage = pathname?.match(/^\/projects\/[^/]+\/dashboard$/);

  if (isRecordPage) {
    return <>{children}</>;
  }
  if (isDashboardPage) {
    return <div className="min-h-screen bg-slate-50">{children}</div>;
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <a href="/" className="flex items-center gap-2 group">
            <div className="h-8 w-8 rounded-lg bg-slate-900 flex items-center justify-center text-[--brand-primary] font-black italic shadow-lg group-hover:scale-105 transition-transform">
              CP
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900 uppercase">
              Tracker
            </span>
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
    </>
  );
}
