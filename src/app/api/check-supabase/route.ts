import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Supabase 연결 및 API 키 검증용 엔드포인트
 * 브라우저에서 /api/check-supabase 호출해서 확인 가능
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 1. env 변수 존재 여부
  if (!url || !key) {
    return NextResponse.json(
      {
        ok: false,
        error: "환경 변수가 설정되지 않았습니다.",
        details: {
          hasUrl: !!url,
          hasKey: !!key,
          hint: ".env.local에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY가 있는지 확인하고, 서버를 재시작하세요.",
        },
      },
      { status: 500 }
    );
  }

  // 2. 공백/줄바꿈 제거 (복사 시 붙은 경우 대비)
  const trimmedUrl = url.trim();
  const trimmedKey = key.trim();
  if (trimmedUrl !== url || trimmedKey !== key) {
    return NextResponse.json(
      {
        ok: false,
        error: "URL 또는 키 앞뒤에 공백/줄바꿈이 있습니다. .env.local에서 제거하세요.",
      },
      { status: 500 }
    );
  }

  // 3. URL 형식 및 프로젝트 ref 추출
  let urlHost: string;
  try {
    const parsed = new URL(trimmedUrl);
    urlHost = parsed.hostname; // e.g. xxxx.supabase.co
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "NEXT_PUBLIC_SUPABASE_URL 형식이 올바르지 않습니다. (예: https://xxxx.supabase.co)",
      },
      { status: 500 }
    );
  }

  const urlProjectRef = urlHost.replace(".supabase.co", "");

  // 4. JWT payload에서 ref 확인 (키와 URL이 같은 프로젝트인지)
  try {
    const parts = trimmedKey.split(".");
    if (parts.length !== 3) {
      return NextResponse.json(
        {
          ok: false,
          error: "API 키 형식이 올바르지 않습니다.",
          details: {
            hint: "Supabase 대시보드 → Project Settings → API 에서 'anon' 'public' 키를 통째로 복사했는지 확인하세요. 키가 잘리지 않았는지도 확인하세요.",
          },
        },
        { status: 500 }
      );
    }
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(
      Buffer.from(b64, "base64").toString("utf8")
    ) as { ref?: string };
    const keyProjectRef = payload.ref;
    if (keyProjectRef && urlProjectRef && keyProjectRef !== urlProjectRef) {
      return NextResponse.json(
        {
          ok: false,
          error: "API 키와 URL의 프로젝트가 일치하지 않습니다.",
          details: {
            urlProjectRef,
            keyProjectRef,
            hint: "같은 Supabase 프로젝트에서 Project URL과 anon public key를 함께 복사해 주세요. (다른 프로젝트 키를 쓰면 Invalid API key가 납니다.)",
          },
        },
        { status: 500 }
      );
    }
  } catch {
    // JWT 파싱 실패 시 아래에서 실제 연결로 에러 확인
  }

  // 5. 실제 Supabase 연결 테스트 (anon key 검증)
  try {
    const supabase = createClient(trimmedUrl, trimmedKey);
    const { data, error } = await supabase.from("projects").select("id").limit(1);

    if (error) {
      const isInvalidKey = error.message?.toLowerCase().includes("invalid") || error.message?.toLowerCase().includes("api key") || error.code === "PGRST301";
      return NextResponse.json(
        {
          ok: false,
          error: "Supabase 연결 실패",
          details: {
            message: error.message,
            code: error.code,
            hint: isInvalidKey
              ? "Supabase 대시보드 → Project Settings → API 에서 Project URL과 anon public key를 다시 복사해 .env.local에 넣어보세요. (service_role 키가 아닌 anon public 키여야 합니다.)"
              : "테이블이 없으면 schema.sql을 먼저 실행하세요.",
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "연결 성공. API 키와 URL이 올바릅니다.",
      details: { rowCount: data?.length ?? 0 },
    });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    return NextResponse.json(
      {
        ok: false,
        error: "연결 중 예외 발생",
        details: { message: err.message },
      },
      { status: 500 }
    );
  }
}
