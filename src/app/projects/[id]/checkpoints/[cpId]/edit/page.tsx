import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import CheckpointEditForm from "./CheckpointEditForm";

type Props = { params: Promise<{ id: string; cpId: string }> };

export default async function EditCheckpointPage({ params }: Props) {
  const { id: projectId, cpId } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .single();
  const { data: checkpoint } = await supabase
    .from("checkpoints")
    .select("id, name, code, access_password, manager_name, manager_contact, inventory_items")
    .eq("id", cpId)
    .eq("project_id", projectId)
    .single();
  const { data: materials } = await supabase
    .from("checkpoint_materials")
    .select("name, sort_order")
    .eq("checkpoint_id", cpId)
    .order("sort_order");

  if (!project || !checkpoint) notFound();

  const raw = (checkpoint as { inventory_items?: unknown }).inventory_items;
  type ItemWithUnit = { name: string; unit: string };
  let initialItems: ItemWithUnit[] = [];
  if (Array.isArray(raw) && raw.length > 0) {
    initialItems = raw.map((item: unknown) =>
      typeof item === "string"
        ? { name: String(item).trim(), unit: "개" }
        : item && typeof item === "object" && "name" in (item as object)
          ? { name: String((item as { name: unknown }).name).trim(), unit: String((item as { unit?: unknown }).unit ?? "개").trim() || "개" }
          : { name: "", unit: "개" }
    ).filter((item) => item.name.length > 0);
  }
  if (initialItems.length === 0 && (materials?.length ?? 0) > 0) {
    initialItems = (materials ?? []).map((m) => ({ name: m.name, unit: "개" }));
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
        <h1 className="mt-2 text-2xl font-bold text-slate-800">
          CP 수정
          {checkpoint.code && (
            <span className="ml-2 font-normal text-slate-500">
              ({checkpoint.code})
            </span>
          )}
        </h1>
      </div>
      <CheckpointEditForm
        projectId={projectId}
        cpId={cpId}
        initialName={checkpoint.name}
        initialCode={checkpoint.code}
        initialAccessPassword={(checkpoint as { access_password?: string | null }).access_password ?? null}
        initialManagerName={(checkpoint as { manager_name?: string | null }).manager_name ?? null}
        initialManagerContact={(checkpoint as { manager_contact?: string | null }).manager_contact ?? null}
        initialItems={initialItems}
      />
    </div>
  );
}
