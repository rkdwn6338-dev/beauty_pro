import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import {
  belongsToProject,
  BUCKET,
  fileSignatureMatches,
  storagePath,
  validateFile,
  fileTypes,
  MAX_FILE_BYTES,
} from "@/lib/files";

export const runtime = "nodejs";
export const maxDuration = 60;
const reply = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });
const requestSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("prepare"),
    projectId: z.uuid(),
    productId: z.uuid().nullable(),
    filename: z.string().min(1).max(240),
    size: z.number().int().min(1).max(MAX_FILE_BYTES),
    type: z.enum(
      Object.keys(fileTypes) as [
        keyof typeof fileTypes,
        ...(keyof typeof fileTypes)[],
      ],
    ),
  }),
  z.object({
    operation: z.enum(["complete", "download", "delete", "failed"]),
    fileId: z.uuid(),
    projectId: z.uuid(),
  }),
]);
export async function POST(request: NextRequest) {
  // 외부 사이트에서 쿠키를 이용한 업로드·삭제 요청을 보낼 수 없도록 확인합니다.
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return reply("허용되지 않은 요청입니다.", 403);
  const payload = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) return reply("파일 요청 정보를 확인해 주세요.");
  const input = parsed.data;
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return reply("로그인이 필요합니다.", 401);
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", input.projectId)
    .maybeSingle();
  if (!project) return reply("자료에 접근할 권한이 없습니다.", 404);
  if (input.operation === "prepare") {
    const invalid = validateFile({
      name: input.filename,
      type: input.type,
      size: input.size,
    });
    if (invalid) return reply(invalid);
    if (input.productId) {
      const { data: product } = await supabase
        .from("products")
        .select("id")
        .eq("id", input.productId)
        .eq("project_id", project.id)
        .maybeSingle();
      if (!product) return reply("제품 정보를 확인해 주세요.", 404);
    }
    const id = crypto.randomUUID();
    const path = storagePath(project.id, id, input.type);
    const { error } = await supabase
      .from("source_files")
      .insert({
        id,
        project_id: project.id,
        product_id: input.productId,
        uploaded_by: user.id,
        filename: input.filename,
        storage_path: path,
        mime_type: input.type,
        bytes: input.size,
        status: "processing",
      });
    if (error) return reply("업로드 정보를 저장하지 못했습니다.", 403);
    return NextResponse.json({ id, path });
  }
  const { data: file } = await supabase
    .from("source_files")
    .select("*")
    .eq("id", input.fileId)
    .eq("project_id", project.id)
    .maybeSingle();
  if (!file || !belongsToProject(file.storage_path, project.id))
    return reply("자료를 찾을 수 없습니다.", 404);
  const bucket = supabase.storage.from(BUCKET);
  if (input.operation === "failed") {
    if (file.uploaded_by !== user.id || file.status !== "processing")
      return reply("처리할 수 없는 요청입니다.", 409);
    const { error } = await supabase
      .from("source_files")
      .update({ status: "failed" })
      .eq("id", file.id)
      .eq("status", "processing");
    return error
      ? reply("업로드 상태를 갱신하지 못했습니다.", 500)
      : NextResponse.json({ success: true });
  }
  if (input.operation === "complete") {
    if (file.uploaded_by !== user.id || file.status !== "processing")
      return reply("처리할 수 없는 요청입니다.", 409);
    const { data: blob, error } = await bucket.download(file.storage_path);
    if (error || !blob)
      return reply("파일 전송을 확인하지 못했습니다. 다시 시도해 주세요.", 409);
    const header = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
    if (
      blob.size !== file.bytes ||
      !fileSignatureMatches(header, file.mime_type ?? "")
    ) {
      await supabase
        .from("source_files")
        .update({ status: "failed" })
        .eq("id", file.id)
        .eq("status", "processing");
      return reply(
        "파일 형식 또는 용량이 원본과 일치하지 않습니다. 올바른 파일을 업로드해 주세요.",
      );
    }
    const { data, error: updateError } = await supabase
      .from("source_files")
      .update({ status: "uploaded" })
      .eq("id", file.id)
      .eq("status", "processing")
      .select("id")
      .single();
    if (updateError || !data)
      return reply("완료 상태를 저장하지 못했습니다.", 500);
    return NextResponse.json({ success: true });
  }
  if (input.operation === "download") {
    if (!["uploaded", "analyzed"].includes(file.status))
      return reply("업로드가 완료된 파일만 열 수 있습니다.", 409);
    const { data, error } = await bucket.createSignedUrl(
      file.storage_path,
      60,
      { download: file.filename },
    );
    if (error) return reply("다운로드 주소를 만들지 못했습니다.", 403);
    return NextResponse.json({ url: data.signedUrl });
  }
  // 기존 프로젝트에 삭제 정책을 추가하기 전까지 삭제는 명시적으로 차단합니다.
  // 이 설정은 서버 전용이며, 검토한 정책을 적용한 뒤에만 켭니다.
  if (process.env.ENABLE_SOURCE_DELETE !== "true")
    return reply(
      "현재 저장소의 삭제 권한 설정이 필요합니다. 관리자에게 문의해 주세요.",
      403,
    );
  const [
    { count: evidenceCount, error: evidenceError },
    { count: jobCount, error: jobError },
  ] = await Promise.all([
    supabase
      .from("evidence")
      .select("id", { count: "exact", head: true })
      .eq("source_file_id", file.id),
    supabase
      .from("analysis_jobs")
      .select("id", { count: "exact", head: true })
      .eq("source_file_id", file.id),
  ]);
  if (evidenceError || jobError)
    return reply("자료의 연결 상태를 확인하지 못했습니다.", 500);
  if ((evidenceCount ?? 0) > 0 || (jobCount ?? 0) > 0)
    return reply("분석 작업이나 근거에 연결된 자료는 삭제할 수 없습니다.", 409);
  const { error: storageError } = await bucket.remove([file.storage_path]);
  if (storageError) return reply("파일 삭제 권한이 없습니다.", 403);
  const { data: remaining, error: listError } = await bucket.list(project.id, {
    search: file.storage_path.split("/")[1],
  });
  if (
    listError ||
    remaining?.some(
      (item) => `${project.id}/${item.name}` === file.storage_path,
    )
  )
    return reply("파일이 삭제되지 않았습니다. 권한을 확인해 주세요.", 403);
  const { data: deleted, error } = await supabase
    .from("source_files")
    .delete()
    .eq("id", file.id)
    .eq("project_id", project.id)
    .select("id");
  if (error || !deleted?.length)
    return reply(
      "원본은 삭제되었으나 목록 정리가 필요합니다. 관리자에게 문의해 주세요.",
      409,
    );
  return NextResponse.json({ success: true });
}
