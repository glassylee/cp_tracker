import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import InventoryItemsInput from "./InventoryItemsInput";

type Props = { params: Promise<{ id: string }> };

export default async function NewCheckpointPage({ params }: Props) {
  const { id: projectId } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .single();
  if (!project) notFound();

  async function createCheckpoint(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    const code = (formData.get("code") as string) || null;
    const accessPassword = (formData.get("access_password") as string)?.trim() || null;
    const managerName = (formData.get("manager_name") as string)?.trim() || null;
    const managerContact = (formData.get("manager_contact") as string)?.trim() || null;
    const inventoryItemsRaw = formData.get("inventory_items") as string;
    let inventoryItems: { name: string; unit: string }[] = [];
    try {
      if (inventoryItemsRaw) {
        const parsed = JSON.parse(inventoryItemsRaw) as unknown;
        if (Array.isArray(parsed)) {
          inventoryItems = parsed
            .map((item: unknown) =>
              typeof item === "string"
                ? { name: String(item).trim(), unit: "개" }
                : typeof item === "object" && item != null && "name" in item
                  ? { name: String((item as { name: unknown }).name).trim(), unit: String((item as { unit?: unknown }).unit ?? "개").trim() || "개" }
                  : null
            )
            .filter((item): item is { name: string; unit: string } => item != null && item.name.length > 0);
        }
      }
    } catch {
      inventoryItems = [];
    }
    if (!name?.trim()) return;
    const supabase = await createClient();
    const { data: cp } = await supabase
      .from("checkpoints")
      .insert({
        project_id: projectId,
        name: name.trim(),
        code: code?.trim() || null,
        sort_order: 0,
        access_password: accessPassword,
        manager_name: managerName,
        manager_contact: managerContact,
        inventory_items: inventoryItems.length > 0 ? inventoryItems : [],
      })
      .select("id")
      .single();
    if (!cp?.id) redirect(`/projects/${projectId}`);
    if (inventoryItems.length > 0) {
      await supabase.from("checkpoint_materials").insert(
        inventoryItems.map((item, i) => ({
          checkpoint_id: cp.id,
          name: item.name,
          sort_order: i,
        }))
      );
    }
    redirect(`/projects/${projectId}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/projects/${projectId}`}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← {project.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-800">CP 추가</h1>
      </div>
      <form
        action={createCheckpoint}
        className="max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700">
              CP명 *
            </label>
            <input
              id="name"
              name="name"
              required
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
              <InventoryItemsInput />
            </div>
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <button
            type="submit"
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            CP 추가
          </button>
          <Link
            href={`/projects/${projectId}`}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            취소
          </Link>
        </div>
      </form>
    </div>
  );
}
