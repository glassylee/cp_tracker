import { createBrowserClient } from "@supabase/ssr";

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return { url, key };
}

export function createClient() {
  const { url, key } = getEnv();
  if (!url || !key) {
    throw new Error(
      "Supabase 설정이 없습니다. .env.local에 NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY를 넣고 개발 서버를 재시작하세요."
    );
  }
  return createBrowserClient(url, key);
}
