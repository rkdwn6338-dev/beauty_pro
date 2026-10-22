import Link from "next/link";
import { Logo } from "@/components/logo";
import { BriefForm } from "@/components/brief-form";
import { ArrowRight } from "lucide-react";
export default function PreviewPage() {
  return (
    <div>
      <header className="public-header">
        <Logo />
        <Link className="button secondary small-button" href="/login">
          로그인 후 저장하기
          <ArrowRight size={16} />
        </Link>
      </header>
      <main id="main" className="preview-main">
        <div className="page-heading">
          <div>
            <span className="eyebrow">스마트 제품 브리프 체험</span>
            <h1>제품의 이야기를 들려주세요.</h1>
            <p>품목을 선택하면 제품에 맞는 질문이 나타납니다.</p>
          </div>
        </div>
        <BriefForm preview />
      </main>
    </div>
  );
}
