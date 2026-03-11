import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

/** 해당 CP의 최근 기록 목록 (기록 제출 후 목록 갱신용). 쿠키 없이 anon 키만 사용 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ cpId: string }> }
) {
  let cpId: string;
  try {
    const params = await context.params;
    cpId = params?.cpId ?? "";
  } catch (e) {
    console.error("[recent-records] params error:", e);
    return NextResponse.json(
      { error: "params 오류", detail: String(e) },
      { status: 500 }
    );
  }

  if (!cpId) {
    return NextResponse.json({ error: "cpId가 필요합니다." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    console.error("[recent-records] Supabase env missing");
    return NextResponse.json(
      { error: "Supabase 설정이 없습니다. .env.local을 확인하세요." },
      { status: 500 }
    );
  }

  try {
    const supabase = createClient(url, key);
    const { data: recordsData, error } = await supabase
      .from("cp_records")
      .select("id, recorded_at, temperature")
      .eq("checkpoint_id", cpId)
      .order("recorded_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[recent-records] Supabase error:", error.message, error.code);
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 500 }
      );
    }

    const list = Array.isArray(recordsData) ? recordsData : [];
    const recentRecords = list.map((r: { id?: unknown; recorded_at?: unknown; temperature?: unknown }) => ({
      id: String(r?.id ?? ""),
      recorded_at: String(r?.recorded_at ?? ""),
      temperature: r?.temperature != null ? Number(r.temperature) : null,
      edited_at: null as string | null,
      cp_record_material_quantities: undefined,
    }));

    return NextResponse.json(recentRecords);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    console.error("[recent-records] catch:", message, stack);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
