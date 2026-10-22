"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser, projectAccess, uuid } from "@/lib/auth";
import { briefSchema } from "@/lib/brief";
import { supabaseServer } from "@/lib/supabase/server";

export type ActionState = { error?: string; success?: string };
export async function login(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({ email: z.email(), password: z.string().min(1).max(200) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "이메일과 비밀번호를 확인해 주세요." };
  try {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error)
      return {
        error:
          "로그인할 수 없습니다. 이메일·비밀번호 또는 이메일 인증 여부를 확인해 주세요.",
      };
  } catch {
    return { error: "로그인 연결에 실패했습니다. 잠시 후 다시 시도해 주세요." };
  }
  redirect("/workspace");
}
export async function logout() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
export async function createProject(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const parsed = z
    .object({
      agency_id: uuid,
      brand: z.string().trim().min(1).max(100),
      title: z.string().trim().min(1).max(200),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: "소속 회사, 브랜드와 프로젝트명을 확인해 주세요." };
  const { data: member } = await supabase
    .from("agency_members")
    .select("agency_id")
    .eq("agency_id", parsed.data.agency_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return { error: "이 회사에 프로젝트를 만들 권한이 없습니다." };
  const { data, error } = await supabase
    .from("projects")
    .insert({ ...parsed.data, created_by: user.id })
    .select("id")
    .single();
  if (error || !data)
    return {
      error:
        "프로젝트를 만들지 못했습니다. 소속 권한과 연결 상태를 확인해 주세요.",
    };
  revalidatePath("/workspace");
  redirect(`/workspace/${data.id}`);
}
export async function saveBrief(
  projectId: string,
  productId: string | null,
  input: unknown,
): Promise<ActionState & { productId?: string }> {
  const access = await projectAccess(projectId);
  if (!access) return { error: "프로젝트에 접근할 수 없습니다." };
  const parsed = briefSchema.safeParse(input);
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.",
    };
  let existingFeatures: Record<string, unknown> = {};
  if (productId) {
    const { data: existing } = await access.supabase
      .from("products")
      .select("features")
      .eq("id", productId)
      .eq("project_id", projectId)
      .maybeSingle();
    if (!existing) return { error: "수정할 제품을 찾을 수 없습니다." };
    if (
      existing.features &&
      typeof existing.features === "object" &&
      !Array.isArray(existing.features)
    )
      existingFeatures = existing.features;
  }
  const row = {
    ...parsed.data,
    project_id: projectId,
    features: {
      ...existingFeatures,
      ...parsed.data.features,
    } as typeof parsed.data.features,
  };
  const query = productId
    ? access.supabase
        .from("products")
        .update(row)
        .eq("id", productId)
        .eq("project_id", projectId)
    : access.supabase.from("products").insert(row);
  const { data, error } = await query.select("id").single();
  if (error || !data)
    return {
      error: "저장하지 못했습니다. 연결 상태와 편집 권한을 확인해 주세요.",
    };
  revalidatePath(`/workspace/${projectId}`);
  return { success: "제품 브리프를 저장했습니다.", productId: data.id };
}
