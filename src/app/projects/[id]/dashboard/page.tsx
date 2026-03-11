import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ProjectDashboardClient from "./ProjectDashboardClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { params: Promise<{ id: string }> };

export default async function ProjectDashboardPage({ params }: Props) {
  const resolved = await params;
  const projectId = resolved.id;
  const supabase = await createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, dashboard_password")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    notFound();
  }

  const proj = project as { dashboard_password?: string | null };
  const hasDashboardPassword = !!(proj.dashboard_password?.trim());

  const { data: checkpoints } = await supabase
    .from("checkpoints")
    .select("id, name, code, sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });
  const checkpointIds = (checkpoints ?? []).map((c) => c.id);

  const { data: sessions } = await supabase
    .from("checkpoint_sessions")
    .select("checkpoint_id, first_arrival_at, stage")
    .in("checkpoint_id", checkpointIds);

  let records: Record<string, unknown>[] = [];
  if (checkpointIds.length > 0) {
    const { data: recordsData, error: recordsError } = await supabase
      .from("cp_records")
      .select(
        `
        id,
        checkpoint_id,
        recorded_at,
        material_quantity,
        temperature,
        humidity,
        notes,
        is_emergency,
        video_url,
        step_status,
        checkpoints (
          id,
          name,
          code,
          projects (id, name)
        ),
        cp_record_material_quantities (
          quantity,
          checkpoint_material_id,
          checkpoint_materials (id, name)
        )
      `
      )
      .in("checkpoint_id", checkpointIds)
      .order("recorded_at", { ascending: false })
      .limit(200);
    if (recordsError) {
      console.error("[dashboard] cp_records fetch error:", recordsError.message, recordsError.code);
    }
    records = (recordsData ?? []) as Record<string, unknown>[];
  }

  return (
    <ProjectDashboardClient
      projectId={projectId}
      projectName={project.name}
      hasDashboardPassword={hasDashboardPassword}
      records={records}
      checkpoints={checkpoints ?? []}
      sessions={(sessions ?? []) as any[]}
    />
  );
}
