import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const checkpointId = formData.get("checkpointId") as string | null;

    if (!file || !checkpointId) {
      return NextResponse.json(
        { error: "파일과 checkpointId가 필요합니다." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const ext = file.name.split(".").pop() || "mp4";
    const path = `cp-videos/${checkpointId}/${Date.now()}.${ext}`;

    const { data: uploadData, error } = await supabase.storage
      .from("cp-videos")
      .upload(path, file, { upsert: false });

    if (error) {
      return NextResponse.json(
        { error: error.message || "업로드 실패. Storage 버킷 'cp-videos' 생성 및 정책 확인 필요." },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from("cp-videos")
      .getPublicUrl(uploadData.path);
    return NextResponse.json({ url: urlData.publicUrl });
  } catch (e) {
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
