import Link from "next/link";
import { Logo } from "@/components/logo";
import { AnalysisWorkspace } from "@/components/analysis-workspace";
import { demoFile, demoEvidence } from "@/lib/analysis-demo";
export default function AnalysisPreviewPage() {
  return (
    <div>
      <header className="public-header">
        <Logo />
        <Link href="/brief-preview" className="text-link">
          브리프 체험
        </Link>
      </header>
      <main id="main" className="preview-main">
        <div className="page-heading">
          <div>
            <span className="eyebrow">근거 검토 화면 체험</span>
            <h1>원문을 확인하고, 기획으로 연결하세요.</h1>
            <p>
              가상 예시로 검토 흐름을 살펴보세요. 실제 자료나 AI 호출은 사용하지
              않습니다.
            </p>
          </div>
        </div>
        <AnalysisWorkspace
          projectId={demoFile.project_id}
          productId={null}
          files={[demoFile]}
          evidence={[demoEvidence]}
          jobs={[]}
          aiReady={false}
          writeReady={false}
          demo
        />
      </main>
    </div>
  );
}
