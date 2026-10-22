import "server-only";
import { redirect } from "next/navigation";
import { configured, supabaseServer } from "./supabase/server";
import { z } from "zod";
export const uuid = z.uuid();
export async function requireUser() {
  if (!configured()) redirect("/login?setup=1");
  const supabase = await supabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (!user || error) redirect("/login");
  return { supabase, user };
}
export async function projectAccess(projectId: string) {
  const { supabase, user } = await requireUser();
  if (!uuid.safeParse(projectId).success) return null;
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();
  if (error || !data) return null;
  return { supabase, user, project: data };
}
