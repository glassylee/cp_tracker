import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("id");

  if (!projectId) {
    return NextResponse.json({ error: "Missing Project ID" }, { status: 400 });
  }

  const supabase = await createClient();

  // 1. 체크포인트 가져오기
  const { data: checkpoints } = await supabase
    .from("checkpoints")
    .select("id, name, sort_order")
    .eq("project_id", projectId)
    .order("sort_order");

  if (!checkpoints) return NextResponse.json({ checkpoints: [], records: [], materials: [] });

  const checkpointIds = checkpoints.map(cp => cp.id);

  // 2. 기록 가져오기 (온습도, 긴급, 타임라인)
  const { data: records } = await supabase
    .from("cp_records")
    .select("id, checkpoint_id, record_stage, recorded_at, temperature, humidity, notes, is_emergency, video_url")
    .in("checkpoint_id", checkpointIds)
    .order("recorded_at");

  // 3. 물량 소진량 가져오기
  const { data: materials } = await supabase
    .from("cp_record_material_quantities")
    .select(`
      checkpoint_material_id,
      checkpoint_id,
      quantity,
      checkpoint_materials (name, unit)
    `)
    .in("checkpoint_id", checkpointIds);

  return NextResponse.json({
    checkpoints: checkpoints || [],
    records: records || [],
    materials: materials || []
  });
}
