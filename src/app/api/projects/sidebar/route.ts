import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: projects, error } = await supabase
      .from("projects")
      .select("id, name, event_date")
      .order("event_date", { ascending: false });

    if (error) {
      console.error("Supabase error in sidebar API:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`API Sidebar: Found ${projects?.length || 0} projects`);
    return NextResponse.json({ projects: projects || [] });
  } catch (err) {
    console.error("API Sidebar crash:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
