import { redirect } from "next/navigation";

/** 대시보드는 대회별 전용으로 이동. 기존 /dashboard 접근 시 대회 목록으로 리다이렉트 */
export default function DashboardPage() {
  redirect("/projects");
}
