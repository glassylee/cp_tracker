"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import DeleteProjectButton from "./DeleteProjectButton";

type Props = {
  projectId: string;
  projectName: string;
};

export default function ProjectSettingsMenu({ projectId, projectName }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="absolute right-8 top-8 z-10" ref={menuRef}>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-all hover:bg-slate-900 hover:text-white shadow-sm border border-slate-100"
        title="설정"
      >
        <span className="text-xs">⚙️</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-32 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl animate-in fade-in zoom-in duration-200">
          <Link
            href={`/projects/${projectId}/edit`}
            className="flex w-full items-center gap-2 px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors border-b border-slate-50"
            onClick={() => setIsOpen(false)}
          >
            ✏️ 수정하기
          </Link>
          <div className="px-4 py-3 hover:bg-slate-50 transition-colors flex items-center gap-2 text-xs font-bold text-red-500">
             <DeleteProjectButton 
                projectId={projectId} 
                projectName={projectName} 
                variant="minimal"
                onDelete={() => setIsOpen(false)}
             />
             삭제하기
          </div>
        </div>
      )}
    </div>
  );
}
