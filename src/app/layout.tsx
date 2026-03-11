import type { Metadata } from "next";
import "./globals.css";
import ConditionalLayout from "./ConditionalLayout";

export const metadata: Metadata = {
  title: "CP 기록 관리 | 트레일러닝 대회",
  description: "트레일러닝 대회 체크포인트 기록 관리",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900">
        <ConditionalLayout>{children}</ConditionalLayout>
      </body>
    </html>
  );
}
