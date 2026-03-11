"use client";

import { useState } from "react";
import { deleteProject } from "./actions";

export default function DeleteProjectButton({
  projectId,
  projectName,
  variant = "default",
  onDelete,
}: {
  projectId: string;
  projectName: string;
  variant?: "default" | "minimal";
  onDelete?: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`'${projectName}' 대회를 정말 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며 모든 CP와 기록이 함께 삭제됩니다.`)) {
      return;
    }

    setLoading(true);
    try {
      await deleteProject(projectId);
      onDelete?.();
    } catch (e) {
      console.error(e);
      alert("대회 삭제에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  if (variant === "minimal") {
    return (
      <button
        onClick={handleDelete}
        disabled={loading}
        className="text-red-500 hover:text-red-700 disabled:opacity-50"
        title="대회 삭제"
      >
        {loading ? "..." : "🗑️"}
      </button>
    );
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-500 transition hover:bg-red-500 hover:text-white disabled:opacity-50"
      title="대회 삭제"
    >
      {loading ? (
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <span className="text-xs">🗑️</span>
      )}
    </button>
  );
}
