import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, password } = body as {
      project_id: string;
      password: string;
    };
    if (!project_id) {
      return NextResponse.json(
        { ok: false, error: "project_id가 필요합니다." },
        { status: 400 }
      );
    }
    const supabase = await createClient();
    const { data: project, error } = await supabase
      .from("projects")
      .select("dashboard_password")
      .eq("id", project_id)
      .single();
    if (error || !project) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }
    const expected = (project as { dashboard_password?: string | null }).dashboard_password ?? "";
    const match = expected !== "" && String(password ?? "").trim() === expected;
    return NextResponse.json({ ok: match });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
