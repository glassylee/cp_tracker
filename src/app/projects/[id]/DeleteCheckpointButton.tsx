"use client";

import { useRouter } from "next/navigation";

type Props = {
  projectId: string;
  cpId: string;
  cpName: string;
};

export default function DeleteCheckpointButton({
  projectId,
  cpId,
  cpName,
}: Props) {
  const router = useRouter();

  const handleClick = async () => {
    const msg =
      `"${cpName}" CP를 삭제하시겠습니까?\n\n이 CP와 함께 저장된 모든 기록(물자·온습도·특이사항·영상)이 삭제되며 복구할 수 없습니다.`;
    if (!window.confirm(msg)) return;
    try {
      const res = await fetch(`/api/checkpoints/${cpId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "삭제 실패");
      }
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제 중 오류가 났습니다.");
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
      title="CP 삭제"
    >
      <span aria-hidden>🗑</span>
      삭제
    </button>
  );
}
