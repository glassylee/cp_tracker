"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import InventoryItemsInput, { type InventoryItemWithUnit } from "../../new/InventoryItemsInput";

type Props = {
  projectId: string;
  cpId: string;
  initialName: string;
  initialCode: string | null;
  initialAccessPassword: string | null;
  initialManagerName: string | null;
  initialManagerContact: string | null;
  initialItems: InventoryItemWithUnit[];
};

export default function CheckpointEditForm({
  projectId,
  cpId,
  initialName,
  initialCode,
  initialAccessPassword,
  initialManagerName,
  initialManagerContact,
  initialItems,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState(initialCode ?? "");
  const [accessPassword, setAccessPassword] = useState(initialAccessPassword ?? "");
  const [managerName, setManagerName] = useState(initialManagerName ?? "");
  const [managerContact, setManagerContact] = useState(initialManagerContact ?? "");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("submitting");
    setMessage("");
    const form = e.currentTarget;
    const formData = new FormData(form);
    const inventoryItemsRaw = formData.get("inventory_items") as string;
    let inventoryItems: InventoryItemWithUnit[] = [];
    try {
      if (inventoryItemsRaw) {
        const parsed = JSON.parse(inventoryItemsRaw) as unknown;
        if (Array.isArray(parsed)) {
          inventoryItems = parsed
            .map((item: unknown) =>
              typeof item === "string"
                ? { name: String(item).trim(), unit: "개" }
                : item && typeof item === "object" && "name" in (item as object)
                  ? { name: String((item as { name: unknown }).name).trim(), unit: String((item as { unit?: unknown }).unit ?? "개").trim() || "개" }
                  : null
            )
            .filter((item): item is InventoryItemWithUnit => item != null && item.name.length > 0);
        }
      }
    } catch {
      inventoryItems = [];
    }
    try {
      const res = await fetch(`/api/checkpoints/${cpId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim() || null,
          access_password: accessPassword.trim() || null,
          manager_name: managerName.trim() || null,
          manager_contact: managerContact.trim() || null,
          inventory_items: inventoryItems,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "저장 실패");
      }
      router.push(`/projects/${projectId}`);
      router.refresh();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "저장 중 오류");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-lg space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-slate-700">
          CP명 *
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          placeholder="예: 1번 체크포인트"
        />
      </div>
      <div>
        <label htmlFor="code" className="block text-sm font-medium text-slate-700">
          CP 코드 (선택)
        </label>
        <input
          id="code"
          name="code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          placeholder="예: CP1"
        />
      </div>
      <div>
        <label htmlFor="access_password" className="block text-sm font-medium text-slate-700">
          접속 비밀번호 (선택)
        </label>
        <input
          id="access_password"
          name="access_password"
          type="text"
          autoComplete="off"
          value={accessPassword}
          onChange={(e) => setAccessPassword(e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          placeholder="CP 기록 화면 접속 시 사용할 비밀번호"
        />
      </div>
      <div>
        <label htmlFor="manager_name" className="block text-sm font-medium text-slate-700">
          기록 담당자 이름 (선택)
        </label>
        <input
          id="manager_name"
          name="manager_name"
          type="text"
          value={managerName}
          onChange={(e) => setManagerName(e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          placeholder="예: 홍길동"
        />
      </div>
      <div>
        <label htmlFor="manager_contact" className="block text-sm font-medium text-slate-700">
          기록 담당자 연락처 (선택)
        </label>
        <input
          id="manager_contact"
          name="manager_contact"
          type="text"
          inputMode="tel"
          value={managerContact}
          onChange={(e) => setManagerContact(e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          placeholder="예: 010-1234-5678"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">
          관리할 물자 목록 (선택)
        </label>
        <p className="mt-1 text-xs text-slate-500">
          쉼표로 구분해 입력하거나 항목을 하나씩 추가하세요.
        </p>
        <div className="mt-2">
          <InventoryItemsInput defaultValue={initialItems} />
        </div>
      </div>
      {message && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {message}
        </div>
      )}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={status === "submitting"}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
        >
          {status === "submitting" ? "저장 중…" : "저장"}
        </button>
        <a
          href={`/projects/${projectId}`}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          취소
        </a>
      </div>
    </form>
  );
}
