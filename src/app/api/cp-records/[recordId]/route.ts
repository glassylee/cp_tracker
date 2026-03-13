import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

type RouteParams = { params: Promise<{ recordId: string }> };

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key);
}

/** 단일 기록 조회 (수정 폼 로드용). edited_at 없이 조회해 DB 컬럼 없어도 동작 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { recordId } = await params;
    if (!recordId) {
      return NextResponse.json(
        { error: "recordId가 필요합니다." },
        { status: 400 }
      );
    }
    const supabase = getSupabase();
    const { data: record, error: recordError } = await supabase
      .from("cp_records")
      .select("id, checkpoint_id, recorded_at, material_quantity, temperature, humidity, notes, video_url")
      .eq("id", recordId)
      .single();

    if (recordError || !record) {
      return NextResponse.json(
        { error: "기록을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const { data: qtyData } = await supabase
      .from("cp_record_material_quantities")
      .select("quantity, checkpoint_material_id, checkpoint_materials(id, name)")
      .eq("cp_record_id", recordId);

    const cp_record_material_quantities = Array.isArray(qtyData) ? qtyData : [];
    return NextResponse.json({
      ...record,
      edited_at: null,
      cp_record_material_quantities,
    });
  } catch {
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

/** 단일 기록 수정 (최근 기록 목록에서 수정용) */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { recordId } = await params;
    if (!recordId) {
      return NextResponse.json(
        { error: "recordId가 필요합니다." },
        { status: 400 }
      );
    }
    const body = await request.json();
    const {
      material_quantity,
      material_quantities,
      temperature,
      humidity,
      notes,
      video_url,
    } = body;

    const supabase = getSupabase();

    const updatePayload: { [key: string]: unknown } = {
      material_quantity: material_quantity ?? null,
      temperature: temperature ?? null,
      humidity: humidity ?? null,
      notes: notes ?? null,
      video_url: video_url ?? null,
    };

    const { error: updateError } = await supabase
      .from("cp_records")
      .update(updatePayload)
      .eq("id", recordId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (Array.isArray(material_quantities) && material_quantities.length > 0) {
      const { data: existing } = await supabase
        .from("cp_record_material_quantities")
        .select("id")
        .eq("cp_record_id", recordId);
      if (existing?.length) {
        await supabase
          .from("cp_record_material_quantities")
          .delete()
          .eq("cp_record_id", recordId);
      }
      await supabase.from("cp_record_material_quantities").insert(
        material_quantities.map(
          (q: { checkpoint_material_id: string; quantity: number }) => ({
            cp_record_id: recordId,
            checkpoint_material_id: q.checkpoint_material_id,
            quantity: Number(q.quantity) || 0,
          })
        )
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
