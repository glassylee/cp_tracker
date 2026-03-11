import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          트레일러닝 대회 CP 기록 관리
        </h1>
        <p className="mt-2 text-slate-600">
          체크포인트별 물자·온습도·특이사항·영상을 기록하고 대시보드에서
          확인하세요.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/projects"
          className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow"
        >
          <h2 className="font-semibold text-slate-800">대회 목록</h2>
          <p className="mt-1 text-sm text-slate-600">
            대회를 만들고 CP를 등록·관리합니다.
          </p>
        </Link>
        <Link
          href="/dashboard"
          className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow"
        >
          <h2 className="font-semibold text-slate-800">실시간 대시보드</h2>
          <p className="mt-1 text-sm text-slate-600">
            모든 CP 기록 현황을 한눈에 확인합니다.
          </p>
        </Link>
      </div>
    </div>
  );
}
