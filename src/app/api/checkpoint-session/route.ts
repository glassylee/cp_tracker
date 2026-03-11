import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const STAGES = ["ready", "first_arrival", "recording", "closed"] as const;
type Stage = (typeof STAGES)[number];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const checkpoint_id = searchParams.get("checkpoint_id");
  if (!checkpoint_id) {
    return NextResponse.json(
      { error: "checkpoint_id가 필요합니다." },
      { status: 400 }
    );
  }
  const supabase = await createClient();
  let { data: session } = await supabase
    .from("checkpoint_sessions")
    .select("*")
    .eq("checkpoint_id", checkpoint_id)
    .single();
  if (!session) {
    const { data: created } = await supabase
      .from("checkpoint_sessions")
      .insert({ checkpoint_id, stage: "ready" })
      .select("*")
      .single();
    session = created;
  }
  return NextResponse.json(session ?? { stage: "ready" });
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { checkpoint_id, stage } = body as {
      checkpoint_id: string;
      stage: Stage;
    };
    if (!checkpoint_id || !STAGES.includes(stage)) {
      return NextResponse.json(
        { error: "checkpoint_id와 유효한 stage가 필요합니다." },
        { status: 400 }
      );
    }
    const supabase = await createClient();
    const updates: Record<string, unknown> = { stage };
    if (stage === "recording") {
      const { data: existing } = await supabase
        .from("checkpoint_sessions")
        .select("first_arrival_at")
        .eq("checkpoint_id", checkpoint_id)
        .single();
      if (existing && !existing.first_arrival_at) {
        updates.first_arrival_at = new Date().toISOString();
      }
    }
    if (stage === "closed") {
      updates.closed_at = new Date().toISOString();
    }
    const { data, error } = await supabase
      .from("checkpoint_sessions")
      .update(updates)
      .eq("checkpoint_id", checkpoint_id)
      .select("*")
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
