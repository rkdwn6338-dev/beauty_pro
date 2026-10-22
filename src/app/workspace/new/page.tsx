import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ProjectForm } from "@/components/project-form";
import { ArrowLeft } from "lucide-react";
export default async function NewProjectPage() {
  const { supabase } = await requireUser();
  const { data: agencies, error } = await supabase
    .from("agencies")
    .select("id,name");
  if (error) throw new Error("회사 정보를 불러오지 못했습니다.");
  return (
    <>
      <Link href="/workspace" className="text-link">
        <ArrowLeft size={16} />
        프로젝트 목록
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">새로운 이야기의 시작</span>
          <h1>프로젝트 만들기</h1>
          <p>브랜드와 프로젝트 이름을 정하고 제품 브리프를 시작하세요.</p>
        </div>
      </div>
      <section className="panel new-project-panel">
        {agencies?.length ? (
          <ProjectForm agencies={agencies} />
        ) : (
          <p className="notice">
            계정의 회사 연결이 필요합니다. 서비스 관리자에게 문의해 주세요.
          </p>
        )}
      </section>
    </>
  );
}
