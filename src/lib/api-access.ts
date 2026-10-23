import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "./supabase/server";

export const apiError = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });
export async function apiProjectAccess(
  request: NextRequest,
  projectId: string,
) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return { error: apiError("허용되지 않은 요청입니다.", 403) };
  const supabase = await supabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { error: apiError("로그인이 필요합니다.", 401) };
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();
  if (!project)
    return { error: apiError("프로젝트에 접근할 수 없습니다.", 404) };
  return { supabase, user, project };
}
