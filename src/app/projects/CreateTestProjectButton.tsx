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
      className="btn-active hidden sm:flex items-center gap-2 rounded-full border border-[#D2D2D7] bg-white px-6 py-3.5 text-[14px] font-semibold text-[#1D1D1F] transition-all hover:bg-[#F5F5F7] disabled:opacity-50 shadow-sm"
    >
      {loading ? (
        <>
          <span className="animate-spin text-[10px]">⌛</span>
          생성 중…
        </>
      ) : (
        <>
          <span className="opacity-50">🧪</span>
          테스트 대회 생성
        </>
      )}
    </button>
  );
}
