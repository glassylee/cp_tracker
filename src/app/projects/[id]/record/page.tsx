import { createClient } from "@/lib/supabase/server";
import RecordPageClient from "./RecordPageClient";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cp?: string }>;
};

const VALID_STAGES = ["ready", "first_arrival", "recording", "closed"] as const;

function normalizeStage(stage: unknown): string {
  if (typeof stage === "string" && VALID_STAGES.includes(stage as (typeof VALID_STAGES)[number])) {
    return stage;
  }
  return "ready";
}

function normalizeMaterials(raw: unknown): { id: string; name: string; sort_order: number }[] {
  try {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((row: unknown) => {
        try {
          const r = row as Record<string, unknown>;
          const id = r?.id != null ? String(r.id) : null;
          const name = r?.name != null ? String(r.name) : "";
          const sort_order = typeof r?.sort_order === "number" ? r.sort_order : 0;
          if (id) return { id, name, sort_order };
          return null;
        } catch {
          return null;
        }
      })
      .filter((r): r is { id: string; name: string; sort_order: number } => r != null);
  } catch {
    return [];
  }
}

export default async function CpRecordPage(props: Props) {
  let projectId = "";
  let checkpointId: string | undefined;

  try {
    const params = await props.params;
    projectId = typeof params?.id === "string" ? params.id.trim() : "";
    const search = await props.searchParams;
    checkpointId = typeof search?.cp === "string" ? search.cp.trim() : undefined;
  } catch (e) {
    console.error("[record/page] params resolve error:", e);
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-center text-slate-600">페이지 로드 중 오류가 발생했습니다.</p>
      </div>
    );
  }

  if (!checkpointId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800">
          CP를 선택해 주세요. 대회 페이지에서 기록할 CP를 골라 주세요.
        </p>
      </div>
    );
  }

  if (!projectId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-center text-slate-600">대회 ID가 없습니다.</p>
      </div>
    );
  }

  try {
    const supabase = await createClient();

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError) {
      console.error("[record/page] project fetch error:", projectError.message, projectError.code);
    }
    if (!project?.id) {
      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-700">
            대회 정보를 찾을 수 없습니다.
          </p>
        </div>
      );
    }

    const { data: checkpoint, error: checkpointError } = await supabase
      .from("checkpoints")
      .select("id, name, code, access_password, inventory_items")
      .eq("id", checkpointId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (checkpointError) {
      console.error("[record/page] checkpoint fetch error:", checkpointError.message, checkpointError.code);
    }
    if (!checkpoint?.id) {
      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-700">
            CP 정보를 찾을 수 없습니다.
          </p>
        </div>
      );
    }

    const nameToUnit = (() => {
      const raw = (checkpoint as { inventory_items?: unknown }).inventory_items;
      if (!Array.isArray(raw)) return new Map<string, string>();
      const map = new Map<string, string>();
      for (const item of raw) {
        if (item && typeof item === "object" && "name" in (item as object)) {
          const name = String((item as { name: unknown }).name).trim();
          const unit = String((item as { unit?: unknown }).unit ?? "개").trim() || "개";
          if (name) map.set(name, unit);
        } else if (typeof item === "string" && item.trim()) {
          map.set(item.trim(), "개");
        }
      }
      return map;
    })();

    let materials: { id: string; name: string; sort_order: number; unit: string }[] = [];
    try {
      const { data: materialsData, error: materialsError } = await supabase
        .from("checkpoint_materials")
        .select("id, name, sort_order")
        .eq("checkpoint_id", checkpointId)
        .order("sort_order");
      if (materialsError) {
        console.error("[record/page] materials fetch error:", materialsError.message);
      }
      const base = normalizeMaterials(materialsData ?? []);
      materials = base.map((m) => ({ ...m, unit: nameToUnit.get(m.name) ?? "개" }));
    } catch (e) {
      console.error("[record/page] materials parse error:", e);
    }

    let session = { stage: "ready", first_arrival_at: null as string | null, closed_at: null as string | null };
    try {
      const { data: sessionData } = await supabase
        .from("checkpoint_sessions")
        .select("stage, first_arrival_at, closed_at")
        .eq("checkpoint_id", checkpointId)
        .maybeSingle();

      if (sessionData) {
        session = {
          stage: normalizeStage(sessionData.stage),
          first_arrival_at: sessionData.first_arrival_at ?? null,
          closed_at: sessionData.closed_at ?? null,
        };
      } else {
        const { data: created } = await supabase
          .from("checkpoint_sessions")
          .insert({ checkpoint_id: checkpointId, stage: "ready" })
          .select("stage, first_arrival_at, closed_at")
          .maybeSingle();
        if (created) {
          session = {
            stage: normalizeStage(created.stage),
            first_arrival_at: created.first_arrival_at ?? null,
            closed_at: created.closed_at ?? null,
          };
        }
      }
    } catch (e) {
      console.error("[record/page] session error:", e);
    }

    let lastRecordAt: string | null = null;
    try {
      const { data: lastRecord } = await supabase
        .from("cp_records")
        .select("recorded_at")
        .eq("checkpoint_id", checkpointId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      lastRecordAt = lastRecord?.recorded_at ?? null;
    } catch (e) {
      console.error("[record/page] lastRecord error:", e);
    }

    let recentRecords: {
      id: string;
      recorded_at: string;
      temperature: number | null;
      edited_at: string | null;
      cp_record_material_quantities?: { quantity: number; checkpoint_materials: { name: string } | null }[];
    }[] = [];
    try {
      const { data: recordsData } = await supabase
        .from("cp_records")
        .select("id, recorded_at, temperature")
        .eq("checkpoint_id", checkpointId)
        .order("recorded_at", { ascending: false })
        .limit(50);
      if (Array.isArray(recordsData)) {
        recentRecords = recordsData.map((r) => ({
          id: String(r.id),
          recorded_at: String(r.recorded_at ?? ""),
          temperature: r.temperature != null ? Number(r.temperature) : null,
          edited_at: null as string | null,
          cp_record_material_quantities: undefined,
        }));
      }
    } catch (e) {
      console.error("[record/page] recentRecords error:", e);
    }

    const hasPassword = !!(checkpoint.access_password && String(checkpoint.access_password).trim());

    return (
      <RecordPageClient
        projectId={project.id}
        projectName={project.name ?? ""}
        checkpointId={checkpoint.id}
        checkpointName={checkpoint.name ?? ""}
        hasPassword={hasPassword}
        materials={materials}
        session={session}
        lastRecordAt={lastRecordAt}
        recentRecords={recentRecords}
      />
    );
  } catch (e) {
    console.error("[record/page] unexpected error:", e);
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-800">
          기록 페이지를 불러오는 중 오류가 발생했습니다.
        </p>
      </div>
    );
  }
}
