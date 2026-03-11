"use client";

import { useState } from "react";

type Props = {
  projectId: string;
  cpId: string;
};

export default function CopyRecordLinkButton({ projectId, cpId }: Props) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    const path = `/projects/${projectId}/record?cp=${cpId}`;
    const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
    
    try {
      // 1. Modern Clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        // 2. Fallback for non-secure contexts (HTTP with IP)
        const textArea = document.createElement("textarea");
        textArea.value = url;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand("copy");
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (err) {
          console.error("Fallback copy failed", err);
        }
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error("Copy failed", err);
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-lg bg-slate-800 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-700"
    >
      {copied ? "✓ 복사됨" : "기록용 URL 복사"}
    </button>
  );
}
