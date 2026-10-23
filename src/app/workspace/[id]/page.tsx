import Link from "next/link";
import { notFound } from "next/navigation";
import { projectAccess } from "@/lib/auth";
import { BriefForm } from "@/components/brief-form";
import { FileManager } from "@/components/file-manager";
import { PlanningWorkspace } from "@/components/planning-workspace";
import { AnalysisWorkspace } from "@/components/analysis-workspace";
import { aiEnabled, evidenceWriteEnabled } from "@/lib/ai";
import { ArrowLeft, FileText, UploadCloud, Sparkles } from "lucide-react";
export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const access = await projectAccess(id);
  if (!access) notFound();
  const { tab } = await searchParams;
  const [
    { data: products, error: productError },
    { data: files, error: fileError },
  ] = await Promise.all([
    access.supabase
      .from("products")
      .select("*")
      .eq("project_id", id)
      .order("created_at")
      .limit(1),
    access.supabase
      .from("source_files")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (productError || fileError)
    throw new Error("제품 자료를 불러오지 못했습니다.");
  const product = products?.[0];
  const analysisTab = tab === "analysis";
  const planningTab = tab === "planning";
  const fileIds = (files ?? []).map((file) => file.id);
  const [
    { data: evidence, error: evidenceError },
    { data: jobs, error: jobError },
  ] =
    analysisTab && fileIds.length
      ? await Promise.all([
          access.supabase
            .from("evidence")
            .select("*")
            .in("source_file_id", fileIds)
            .order("created_at", { ascending: false }),
          access.supabase
            .from("analysis_jobs")
            .select("id,source_file_id,status,error_message,created_at")
            .in("source_file_id", fileIds)
            .order("created_at", { ascending: false })
            .limit(30),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];
  if (evidenceError || jobError)
    throw new Error("분석 결과를 불러오지 못했습니다.");
  return (
    <>
      <Link className="text-link" href="/workspace">
        <ArrowLeft size={15} />
        프로젝트 목록
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{access.project.brand}</span>
          <h1>{access.project.title}</h1>
          <p>제품을 이해하고, 이야기를 만드는 공간.</p>
        </div>
        <span className="badge">자료 준비 단계</span>
      </div>
      <nav className="project-tabs" aria-label="프로젝트 작업">
        <Link
          href={`/workspace/${id}`}
          className={
            tab !== "files" && !analysisTab && !planningTab ? "selected" : ""
          }
          aria-current={
            tab !== "files" && !analysisTab && !planningTab ? "page" : undefined
          }
        >
          <FileText size={17} />
          제품 브리프
        </Link>
        <Link
          href={`/workspace/${id}?tab=files`}
          className={tab === "files" ? "selected" : ""}
          aria-current={tab === "files" ? "page" : undefined}
        >
          <UploadCloud size={18} />
          자료 업로드<span className="count">{files?.length ?? 0}</span>
        </Link>
        <Link
          href={`/workspace/${id}?tab=analysis`}
          className={analysisTab ? "selected" : ""}
          aria-current={analysisTab ? "page" : undefined}
        >
          <Sparkles size={16} />
          자료 분석
        </Link>
        <Link
          href={`/workspace/${id}?tab=planning`}
          className={planningTab ? "selected" : ""}
          aria-current={planningTab ? "page" : undefined}
        >
          <FileText size={17} />
          기획서 편집
        </Link>
      </nav>
      {planningTab ? (
        <PlanningWorkspace
          projectId={id}
          productId={product?.id ?? null}
          storageReady={process.env.ENABLE_PLAN_STORAGE === "true"}
          aiReady={
            aiEnabled() && process.env.ENABLE_GENERATION_GUARD === "true"
          }
        />
      ) : analysisTab ? (
        <AnalysisWorkspace
          projectId={id}
          productId={product?.id ?? null}
          files={files ?? []}
          evidence={evidence ?? []}
          jobs={jobs ?? []}
          aiReady={aiEnabled()}
          writeReady={evidenceWriteEnabled()}
        />
      ) : tab === "files" ? (
        <FileManager
          projectId={id}
          productId={product?.id ?? null}
          files={files ?? []}
          deleteEnabled={process.env.ENABLE_SOURCE_DELETE === "true"}
        />
      ) : (
        <BriefForm projectId={id} product={product} />
      )}
    </>
  );
}
