import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { checkpoint_id, materials } = body as {
      checkpoint_id: string;
      materials: { id: string | null; name: string }[];
    };
    if (!checkpoint_id || !Array.isArray(materials)) {
      return NextResponse.json(
        { error: "checkpoint_id와 materials 배열이 필요합니다." },
        { status: 400 }
      );
    }
    const supabase = await createClient();
    await supabase
      .from("checkpoint_materials")
      .delete()
      .eq("checkpoint_id", checkpoint_id);
    const toInsert = materials
      .map((m) => m.name?.trim())
      .filter(Boolean)
      .map((name, sort_order) => ({ checkpoint_id, name, sort_order }));
    if (toInsert.length > 0) {
      await supabase.from("checkpoint_materials").insert(toInsert);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
