import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

function safeStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
function safeNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function safeBool(v: unknown): boolean {
  return v === true || v === "true";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      checkpoint_id: rawCheckpointId,
      material_quantity,
      material_quantities,
      temperature,
      humidity,
      notes,
      video_url,
      record_stage,
      step_status,
      is_bottleneck,
      is_emergency,
    } = body;

    const checkpoint_id = safeStr(rawCheckpointId);
    if (!checkpoint_id) {
      return NextResponse.json(
        { error: "checkpoint_id가 필요합니다.", field: "checkpoint_id" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const stepStatusValue = safeStr(step_status) ?? safeStr(record_stage);

    const insertPayload: { [key: string]: unknown } = {
      checkpoint_id,
      material_quantity: safeNum(material_quantity),
      temperature: safeNum(temperature),
      humidity: safeNum(humidity),
      notes: safeStr(notes),
      video_url: safeStr(video_url),
      step_status: stepStatusValue,
      is_bottleneck: safeBool(is_bottleneck),
      is_emergency: safeBool(is_emergency),
    };

    const { data, error } = await supabase
      .from("cp_records")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) {
      console.error("[cp-records POST] Supabase insert error:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        payload: insertPayload,
      });
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          hint: error.hint,
          field: "cp_records.insert",
        },
        { status: 500 }
      );
    }

    if (data?.id && Array.isArray(material_quantities) && material_quantities.length > 0) {
      const qPayload = material_quantities.map(
        (q: { checkpoint_material_id: string; quantity: number }) => ({
          cp_record_id: data.id,
          checkpoint_material_id: q.checkpoint_material_id,
          quantity: Number(q.quantity) || 0,
        })
      );
      const { error: qError } = await supabase.from("cp_record_material_quantities").insert(qPayload);
      if (qError) {
        console.error("[cp-records POST] material_quantities insert error:", qError.message, qPayload);
        return NextResponse.json(
          { error: qError.message, field: "cp_record_material_quantities" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(data);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error("[cp-records POST] Unexpected error:", err.message, err.stack);
    return NextResponse.json(
      {
        error: err.message,
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
        field: "server",
      },
      { status: 500 }
    );
  }
}
