import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

type RouteParams = { params: Promise<{ cpId: string }> };

/** CP 삭제. cascade로 cp_records, checkpoint_materials, checkpoint_sessions 등 함께 삭제됨. */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { cpId } = await params;
    if (!cpId) {
      return NextResponse.json(
        { error: "cpId가 필요합니다." },
        { status: 400 }
      );
    }
    const supabase = await createClient();
    const { error } = await supabase
      .from("checkpoints")
      .delete()
      .eq("id", cpId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

/** CP 수정: name, code, access_password, inventory_items 및 checkpoint_materials 동기화 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { cpId } = await params;
    if (!cpId) {
      return NextResponse.json(
        { error: "cpId가 필요합니다." },
        { status: 400 }
      );
    }
    const body = await request.json();
    const {
      name,
      code,
      access_password,
      manager_name,
      manager_contact,
      inventory_items,
    } = body as {
      name?: string;
      code?: string | null;
      access_password?: string | null;
      manager_name?: string | null;
      manager_contact?: string | null;
      inventory_items?: string[] | { name: string; unit?: string }[];
    };
    const supabase = await createClient();
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (code !== undefined) updates.code = code == null || String(code).trim() === "" ? null : String(code).trim();
    if (access_password !== undefined) updates.access_password = access_password == null || String(access_password).trim() === "" ? null : String(access_password).trim();
    if (manager_name !== undefined) updates.manager_name = manager_name == null || String(manager_name).trim() === "" ? null : String(manager_name).trim();
    if (manager_contact !== undefined) updates.manager_contact = manager_contact == null || String(manager_contact).trim() === "" ? null : String(manager_contact).trim();
    const normalizedItems: { name: string; unit: string }[] = Array.isArray(inventory_items)
      ? inventory_items
        .map((item) =>
          typeof item === "string"
            ? { name: String(item).trim(), unit: "개" }
            : item && typeof item === "object" && "name" in item
              ? { name: String(item.name).trim(), unit: String((item as { unit?: string }).unit ?? "개").trim() || "개" }
              : null
        )
        .filter((item): item is { name: string; unit: string } => item != null && item.name.length > 0)
      : [];
    if (Array.isArray(inventory_items)) updates.inventory_items = normalizedItems;
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from("checkpoints")
        .update(updates)
        .eq("id", cpId);
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }
    if (Array.isArray(inventory_items)) {
      await supabase.from("checkpoint_materials").delete().eq("checkpoint_id", cpId);
      if (normalizedItems.length > 0) {
        await supabase.from("checkpoint_materials").insert(
          normalizedItems.map((item, sort_order) => ({ checkpoint_id: cpId, name: item.name, sort_order }))
        );
      }
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
