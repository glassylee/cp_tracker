"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import DeleteProjectButton from "./DeleteProjectButton";

type Props = {
  projectId: string;
  projectName: string;
  variant?: "default" | "sidebar";
};

export default function ProjectSettingsMenu({ projectId, projectName, variant = "default" }: Props) {
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

  const isSidebar = variant === "sidebar";

  return (
    <div className={`${isSidebar ? "relative" : "absolute right-6 top-1/2 -translate-y-1/2"} z-10`} ref={menuRef}>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`flex items-center justify-center rounded-full transition-all border ${
          isSidebar 
            ? `h-6 w-6 ${isOpen ? "bg-black text-white border-black" : "bg-white/50 text-[#86868B] border-[#D2D2D7]/30 hover:bg-white hover:text-[#1D1D1F] shadow-sm"}`
            : `h-10 w-10 ${isOpen ? "bg-black text-white border-black" : "bg-white text-[#86868B] border-[#D2D2D7]/50 hover:bg-[#F5F5F7] hover:text-[#1D1D1F] shadow-sm"}`
        }`}
        title="설정"
      >
        <svg width={isSidebar ? "12" : "14"} height={isSidebar ? "12" : "14"} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 13C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13Z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M19 13C19.5523 13 20 12.5523 20 12C20 11.4477 19.5523 11 19 11C18.4477 11 18 11.4477 18 12C18 12.5523 18.4477 13 19 13Z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M5 13C5.55228 13 6 12.5523 6 12C6 11.4477 5.55228 11 5 11C4.44772 11 4 11.4477 4 12C4 12.5523 4.44772 13 5 13Z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {isOpen && (
        <div className={`absolute right-0 mt-3 w-44 overflow-hidden rounded-2xl border border-[#D2D2D7]/50 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.1)] animate-in fade-in zoom-in duration-200 ${isSidebar ? "top-full" : ""}`} style={{ zIndex: 100 }}>
          <Link
            href={`/projects/${projectId}/edit`}
            className="flex w-full items-center gap-2.5 px-5 py-3.5 text-[13px] font-semibold text-[#1D1D1F] hover:bg-black/5 transition-colors border-b border-[#F5F5F7]"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
          >
            <span className="text-sm">✏️</span>
            <span>수정하기</span>
          </Link>
          
          <DeleteProjectButton 
            projectId={projectId} 
            projectName={projectName} 
            variant="row"
            onDelete={() => setIsOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
