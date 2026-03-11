import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

type RouteParams = { params: Promise<{ projectId: string }> };

/** 대회 대시보드 비밀번호만 수정 (관리자 설정용) */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { projectId } = await params;
    if (!projectId) {
      return NextResponse.json(
        { error: "projectId가 필요합니다." },
        { status: 400 }
      );
    }
    const body = await request.json();
    const { dashboard_password } = body as { dashboard_password?: string | null };
    const value =
      dashboard_password == null || String(dashboard_password).trim() === ""
        ? null
        : String(dashboard_password).trim();
    const supabase = await createClient();
    const { error } = await supabase
      .from("projects")
      .update({ dashboard_password: value })
      .eq("id", projectId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
