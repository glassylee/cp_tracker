"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const TEST_PROJECT_NAME = "테스트 대회";
const TEST_DASHBOARD_PASSWORD = "1234";
const TEST_CP_NAME = "테스트 CP";
const TEST_CP_CODE = "CP1";
const TEST_CP_PASSWORD = "1234";
const TEST_INVENTORY_ITEMS: { name: string; unit: string }[] = [
  { name: "생수", unit: "개" },
  { name: "이온음료", unit: "개" },
  { name: "바나나", unit: "개" },
];

/** 개발/테스트용: 대회 1개 + CP 1개(고정)를 한 번에 생성 */
export async function createTestProject() {
  const supabase = await createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      name: TEST_PROJECT_NAME,
      description: "개발·테스트용 대회 (대시보드/CP 비밀번호: 1234)",
      dashboard_password: TEST_DASHBOARD_PASSWORD,
    })
    .select("id")
    .single();

  if (projectError || !project?.id) {
    console.error("[createTestProject] project insert error:", projectError);
    throw new Error(projectError?.message ?? "대회 생성 실패");
  }

  const projectId = project.id;

  const { data: cp, error: cpError } = await supabase
    .from("checkpoints")
    .insert({
      project_id: projectId,
      name: TEST_CP_NAME,
      code: TEST_CP_CODE,
      sort_order: 0,
      access_password: TEST_CP_PASSWORD,
      inventory_items: TEST_INVENTORY_ITEMS,
    })
    .select("id")
    .single();

  if (cpError || !cp?.id) {
    console.error("[createTestProject] checkpoint insert error:", cpError);
    throw new Error(cpError?.message ?? "CP 생성 실패");
  }

  const { error: materialsError } = await supabase.from("checkpoint_materials").insert(
    TEST_INVENTORY_ITEMS.map((item, i) => ({
      checkpoint_id: cp.id,
      name: item.name,
      sort_order: i,
    }))
  );

  if (materialsError) {
    console.error("[createTestProject] checkpoint_materials insert error:", materialsError);
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

/** 대회 삭제 */
export async function deleteProject(projectId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) {
    throw new Error(error.message);
  }
  revalidatePath("/projects");
}

/** 대회 수정 */
export async function updateProject(projectId: string, formData: FormData) {
  const name = formData.get("name") as string;
  const description = (formData.get("description") as string) || null;
  const event_date = (formData.get("event_date") as string) || null;
  const dashboard_password = (formData.get("dashboard_password") as string)?.trim() || null;

  if (!name?.trim()) throw new Error("대회명은 필수입니다.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({
      name: name.trim(),
      description: description?.trim() || null,
      event_date: event_date || null,
      dashboard_password: dashboard_password || null,
    })
    .eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}
