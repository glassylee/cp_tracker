import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { checkpoint_id, password } = body as {
      checkpoint_id: string;
      password: string;
    };
    if (!checkpoint_id) {
      return NextResponse.json(
        { ok: false, error: "checkpoint_id가 필요합니다." },
        { status: 400 }
      );
    }
    const supabase = await createClient();
    const { data: cp, error } = await supabase
      .from("checkpoints")
      .select("access_password")
      .eq("id", checkpoint_id)
      .single();
    if (error || !cp) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }
    const expected = cp.access_password ?? "";
    const match = expected !== "" && String(password ?? "").trim() === expected;
    return NextResponse.json({ ok: match });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
