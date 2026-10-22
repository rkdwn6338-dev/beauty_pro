import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  Plus,
  ArrowUpRight,
  FolderOpen,
  FileText,
  ArrowRight,
} from "lucide-react";
export default async function WorkspacePage() {
  const { supabase } = await requireUser();
  const [{ data: projects, error }, { data: agencies, error: agencyError }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("*,products(id),source_files(id)")
        .order("created_at", { ascending: false }),
      supabase.from("agencies").select("id,name"),
    ]);
  if (error || agencyError)
    throw new Error("프로젝트 목록을 불러오지 못했습니다.");
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">나의 워크스페이스</span>
          <h1>모든 기획의 시작, 프로젝트.</h1>
          <p>제품의 정보와 근거를 모아 브랜드의 다음 이야기를 준비하세요.</p>
        </div>
        {!!agencies?.length && (
          <Link className="button primary" href="/workspace/new">
            <Plus size={18} />새 프로젝트
          </Link>
        )}
      </div>
      {!agencies?.length ? (
        <section className="panel onboarding">
          <span className="step-number">01</span>
          <h2>계정의 회사 연결을 준비하고 있습니다.</h2>
          <p>
            로그인은 완료되었습니다. 프로젝트를 만들려면 관리자가 이 계정을 소속
            회사에 연결해야 합니다.
          </p>
          <p className="small muted">
            회사 연결이 완료되면 이 화면에서 바로 프로젝트를 시작할 수 있습니다.
          </p>
        </section>
      ) : (
        <>
          <div className="stats-row">
            <div>
              <span>전체 프로젝트</span>
              <strong>
                {projects?.length ?? 0}
                <small>개</small>
              </strong>
            </div>
            <div>
              <span>등록한 제품</span>
              <strong>
                {projects?.reduce((n, p) => n + p.products.length, 0) ?? 0}
                <small>개</small>
              </strong>
            </div>
            <div>
              <span>업로드한 자료</span>
              <strong>
                {projects?.reduce((n, p) => n + p.source_files.length, 0) ?? 0}
                <small>개</small>
              </strong>
            </div>
            <div>
              <span>소속 회사</span>
              <strong className="company-stat">
                {agencies.map((a) => a.name).join(", ")}
              </strong>
            </div>
          </div>
          <div className="list-heading">
            <h2>
              프로젝트 <span className="count">{projects?.length ?? 0}</span>
            </h2>
            <span className="small muted">최근 만든 순서</span>
          </div>
          {!projects?.length ? (
            <section className="panel empty-state">
              <FolderOpen size={40} />
              <h2>첫 번째 제품의 이야기를 시작하세요.</h2>
              <p>새 프로젝트를 만들고 제품 정보와 자료를 모아보세요.</p>
              <Link className="button primary" href="/workspace/new">
                첫 프로젝트 만들기
                <ArrowRight size={17} />
              </Link>
            </section>
          ) : (
            <div className="project-grid">
              {projects.map((project) => (
                <Link
                  className="project-card"
                  href={`/workspace/${project.id}`}
                  key={project.id}
                >
                  <div className="card-top">
                    <span className="project-brand">{project.brand}</span>
                    <ArrowUpRight size={20} />
                  </div>
                  <h3>{project.title}</h3>
                  <span className="badge neutral">
                    {project.products.length
                      ? "브리프 작성 중"
                      : "브리프 시작 전"}
                  </span>
                  <div className="project-card-footer">
                    <span>
                      <FileText size={15} />
                      자료 {project.source_files.length}개
                    </span>
                    <time>
                      {new Date(project.created_at).toLocaleDateString(
                        "ko-KR",
                        { timeZone: "Asia/Seoul" },
                      )}
                    </time>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
