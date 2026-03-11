import type { Viewport } from "next";

/** 기록용 URL 접속 시 앱 전용 화면: 전체 화면, 노치/홈인디케이터 안전 영역, 모바일 터치 최적화 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export default function RecordAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="record-app-shell min-h-[100dvh] min-h-screen bg-slate-900">
      {children}
    </div>
  );
}
