import type { Metadata, Viewport } from "next";
import "./globals.css";
import ConditionalLayout from "./ConditionalLayout";

export const metadata: Metadata = {
  title: "CP 기록 관리 | 트레일러닝 대회",
  description: "트레일러닝 대회 체크포인트 기록 관리",
};

// ⚠️ 브라우저 시스템 테마가 강제로 색상을 반전시키지 못하도록 라이트 모드 고정
export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f8fafc',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="light" style={{ colorScheme: 'light' }}>
      <head>
        {/* iOS 및 시스템 다크모드 무시를 위한 최상위 선언 */}
        <meta name="color-scheme" content="light" />
      </head>
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900" style={{ colorScheme: 'light' }}>
        <ConditionalLayout>{children}</ConditionalLayout>
      </body>
    </html>
  );
}
