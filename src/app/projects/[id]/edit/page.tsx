import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import EditProjectForm from "./EditProjectForm";

type Props = { params: Promise<{ id: string }> };

export default async function EditProjectPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (!project) {
    notFound();
  }

  return (
    <div className="space-y-10">
      <div className="border-b border-slate-200 pb-8">
        <Link
          href={`/projects/${id}`}
          className="group flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-900 transition-colors"
        >
          <span className="group-hover:-translate-x-1 transition-transform">←</span> {project.name}
        </Link>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 uppercase">
          대회 정보 수정
        </h1>
      </div>

      <div className="max-w-xl">
        <EditProjectForm project={project} />
      </div>
    </div>
  );
}
