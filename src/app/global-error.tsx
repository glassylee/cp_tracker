"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: "system-ui", background: "#f8fafc", padding: "2rem" }}>
        <div style={{ maxWidth: "28rem", margin: "0 auto", background: "#fff", border: "1px solid #fecaca", borderRadius: "12px", padding: "2rem" }}>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#b91c1c" }}>오류가 발생했습니다</h1>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#475569" }}>
            {error?.message || "알 수 없는 오류입니다."}
          </p>
          <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "#64748b" }}>
            터미널에서 <code style={{ background: "#f1f5f9", padding: "0 4px" }}>npm run dev</code>가 실행 중인지 확인하세요.
            포트가 3001로 바뀌었을 수 있으니 주소창에 <strong>http://localhost:3001</strong> 을 입력해 보세요.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: "1.5rem", padding: "0.5rem 1rem", background: "#1e293b", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}
          >
            다시 시도
          </button>
          <a
            href="/"
            style={{ marginLeft: "0.75rem", padding: "0.5rem 1rem", border: "1px solid #cbd5e1", borderRadius: "8px", color: "#334155", textDecoration: "none", display: "inline-block" }}
          >
            홈으로
          </a>
        </div>
      </body>
    </html>
  );
}
