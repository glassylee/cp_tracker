import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";
import AnalyticsDashboard from "./AnalyticsDashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AnalyticsPage() {
  const supabase = await createClient();

  // 대회 목록 가져오기 (이름순/최근순 등 정렬 필요 시 추가)
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, event_date")
    .order("event_date", { ascending: false });

  return (
    <div className="space-y-12 pb-24">
      {/* Header */}
      <div className="border-b border-[#D2D2D7]/30 pb-12">
        <h1 className="text-4xl font-semibold tracking-tight text-[#1D1D1F]">
          통계 및 리포트
        </h1>
        <p className="mt-3 text-[#86868B] text-lg font-medium tracking-tight">
          수집된 모든 데이터를 기반으로 대회의 운영 효율성과 안전을 분석합니다.
        </p>
      </div>

      <Suspense fallback={<div>Loading stats...</div>}>
        <AnalyticsDashboard projects={projects || []} />
      </Suspense>
    </div>
  );
}
