import { Logo } from "@/components/logo";
import { LoginForm } from "@/components/login-form";
import { configured } from "@/lib/supabase/server";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import Link from "next/link";
export default function LoginPage() {
  return (
    <div className="login-page">
      <header className="public-header">
        <Logo />
        <Link href="/" className="text-link">
          <ArrowLeft size={16} />
          홈으로
        </Link>
      </header>
      <main id="main" className="login-grid">
        <section className="login-story">
          <span className="eyebrow">당신의 다음 프로젝트</span>
          <h1>
            좋은 제품의 이야기가
            <br />
            시작되는 곳.
          </h1>
          <p>
            제품 정보와 근거 자료를 연결하고,
            <br />
            브랜드다운 상세페이지를 준비하세요.
          </p>
          <div className="login-art" aria-hidden="true">
            <div className="art-ring" />
            <div className="art-ring second" />
            <span>
              성분에서
              <br />
              <strong>이야기로.</strong>
            </span>
          </div>
          <p className="small secure-caption">
            <ShieldCheck size={18} />
            회사별로 분리되는 비공개 워크스페이스
          </p>
        </section>
        <section className="login-card">
          <span className="eyebrow">다시 만나 반갑습니다</span>
          <h2>로그인</h2>
          <p className="muted login-subtitle">
            작업하던 프로젝트를 이어가세요.
          </p>
          <LoginForm configured={configured()} />
        </section>
      </main>
    </div>
  );
}
