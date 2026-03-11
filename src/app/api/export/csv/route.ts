import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  const supabase = await createClient();
  let query = supabase
    .from("cp_records")
    .select(
      `
      id,
      recorded_at,
      material_quantity,
      temperature,
      humidity,
      notes,
      video_url,
      checkpoints (
        name,
        code,
        projects (name, event_date)
      ),
      cp_record_material_quantities (
        quantity,
        checkpoint_materials (name)
      )
    `
    )
    .order("recorded_at", { ascending: false });

  if (projectId) {
    const { data: checkpoints } = await supabase
      .from("checkpoints")
      .select("id")
      .eq("project_id", projectId);
    const ids = (checkpoints ?? []).map((c) => c.id);
    if (ids.length > 0) {
      query = query.in("checkpoint_id", ids);
    } else {
      query = query.eq("checkpoint_id", "00000000-0000-0000-0000-000000000000");
    }
  }

  const { data: records, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 1. 해당 프로젝트(또는 전체)의 모든 고유 물자명 추출
  let uniqueMaterialNames: string[] = [];
  if (records && records.length > 0) {
    const materialNameSet = new Set<string>();
    records.forEach((r: any) => {
      const quantities = r.cp_record_material_quantities || [];
      quantities.forEach((q: any) => {
        if (q.checkpoint_materials?.name) {
          materialNameSet.add(q.checkpoint_materials.name);
        }
      });
    });
    uniqueMaterialNames = Array.from(materialNameSet).sort();
  }

  // 2. 헤더 구성
  const baseHeaders = [
    "대회명",
    "대회일자",
    "CP명",
    "CP코드",
    "기록시각",
    "온도",
    "습도",
    "특이사항",
    "영상URL",
  ];
  const headers = [...baseHeaders, ...uniqueMaterialNames];

  // 3. 로우 데이터 구성
  const rows = (records ?? []).map((r: Record<string, unknown>) => {
    const cp = r.checkpoints as { name?: string; code?: string; projects?: { name?: string; event_date?: string } } | null;
    const p = cp?.projects;
    const quantities = (r.cp_record_material_quantities as { quantity?: number; checkpoint_materials?: { name?: string } }[] | null) ?? [];
    
    // 물자별 수량 매핑 (이름 -> 수량)
    const materialMap: Record<string, number> = {};
    quantities.forEach((q) => {
      if (q.checkpoint_materials?.name) {
        materialMap[q.checkpoint_materials.name] = q.quantity ?? 0;
      }
    });

    const baseRow = [
      p?.name ?? "",
      p?.event_date ?? "",
      cp?.name ?? "",
      cp?.code ?? "",
      r.recorded_at ?? "",
      r.temperature ?? "",
      r.humidity ?? "",
      (r.notes as string) ?? "",
      (r.video_url as string) ?? "",
    ];

    // 고유 물자명 순서대로 수량 추가
    const materialRow = uniqueMaterialNames.map(name => materialMap[name] ?? "");

    return [...baseRow, ...materialRow];
  });

  const bom = "\uFEFF";
  const csv = [headers.join(","), ...rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\r\n");
  const body = bom + csv;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cp-records-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
