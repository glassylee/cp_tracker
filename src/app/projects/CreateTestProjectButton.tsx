"use client";

import { useState } from "react";
import { createTestProject } from "./actions";

export default function CreateTestProjectButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await createTestProject();
    } catch (e) {
      console.error(e);
      alert("테스트 대회 생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="rounded-lg border-2 border-amber-400 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
    >
      {loading ? "생성 중…" : "테스트용 대회 + CP 1개 생성"}
    </button>
  );
}
