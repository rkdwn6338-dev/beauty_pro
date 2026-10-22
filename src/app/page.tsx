import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Fingerprint,
  Files,
  Layers3,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/logo";
export default function Home() {
  return (
    <div className="landing">
      <header className="public-header">
        <Logo />
        <nav>
          <Link href="/brief-preview">브리프 체험</Link>
          <Link className="button secondary small-button" href="/login">
            로그인
            <ArrowUpRight size={16} />
          </Link>
        </nav>
      </header>
      <main id="main">
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="live-dot" />
              뷰티 브랜드의 기획 워크스페이스
            </span>
            <h1>
              제품의 가능성을,
              <br />
              <span>설득력 있는</span>
              <br />
              상세페이지로.
            </h1>
            <p className="hero-description">
              제품 정보부터 근거 자료까지 한곳에.
              <br />
              브랜드의 강점을 발견하는 기획의 첫 단계를 시작하세요.
            </p>
            <div className="hero-actions">
              <Link href="/login" className="button primary">
                프로젝트 시작하기
                <ArrowRight size={18} />
              </Link>
              <Link href="/brief-preview" className="text-link">
                브리프 먼저 살펴보기
                <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="hero-assurances">
              <span>
                <Check size={15} />
                제품별 맞춤 브리프
              </span>
              <span>
                <Check size={15} />
                비공개 자료 보관
              </span>
            </div>
          </div>
          <div
            className="hero-visual"
            aria-label="제품 정보와 근거 자료를 연결하는 기획 과정"
          >
            <div className="visual-topline">
              <span>제품을 이해하는 첫 단계</span>
              <Sparkles size={18} />
            </div>
            <div className="visual-paper">
              <span className="eyebrow">하나의 제품, 명확한 이야기</span>
              <h2>
                본질에서 시작하는
                <br />
                뷰티 기획.
              </h2>
              <div className="bottle-scene" aria-hidden="true">
                <div className="orb orb-one" />
                <div className="orb orb-two" />
                <div className="bottle">
                  <div className="bottle-cap" />
                  <div className="bottle-label">
                    <span>제품의 본질</span>
                    <strong>
                      매일의
                      <br />
                      좋은 변화.
                    </strong>
                    <i />한 방울에서 시작되는 이야기
                  </div>
                </div>
                <div className="bottle-shadow" />
              </div>
              <div className="visual-bottom">
                <span>성분</span>
                <i />
                <span>경험</span>
                <i />
                <span>근거</span>
              </div>
            </div>
            <div className="floating-note">
              <span className="note-check">
                <Check size={15} />
              </span>
              <div>
                <strong>흩어진 정보가, 하나의 기획으로.</strong>
                <small>브리프와 원본 자료를 함께 관리하세요.</small>
              </div>
            </div>
          </div>
        </section>
        <section className="workflow-section">
          <div className="section-intro">
            <span className="eyebrow">기획의 흐름을 더 단순하게</span>
            <h2>
              좋은 상세페이지를 위한,
              <br />
              단단한 시작.
            </h2>
            <p>
              현재는 브리프 작성과 자료 업로드를 사용할 수 있습니다.
              <br />
              자료 분석과 기획·디자인 기능은 단계적으로 이어집니다.
            </p>
          </div>
          <div className="workflow-cards">
            {[
              {
                icon: Fingerprint,
                title: "스마트 제품 브리프",
                description:
                  "제품 카테고리에 맞는 질문으로 핵심 정보와 전성분을 정리하세요.",
                status: "사용 가능",
              },
              {
                icon: Files,
                title: "근거 자료 한곳에",
                description:
                  "시험 보고서와 제품 사진을 원본 그대로 안전하게 보관하세요.",
                status: "사용 가능",
              },
              {
                icon: Layers3,
                title: "분석에서 기획까지",
                description:
                  "근거를 검토하고 상세페이지의 이야기와 디자인으로 연결합니다.",
                status: "다음 단계",
              },
            ].map((item, index) => (
              <article key={item.title} className="workflow-card">
                <div className="card-top">
                  <item.icon size={25} />
                  <span className="small muted">0{index + 1}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <span className={`badge ${index === 2 ? "neutral" : ""}`}>
                  {item.status}
                </span>
              </article>
            ))}
          </div>
        </section>
      </main>
      <footer className="public-footer">
        <span>뷰티 디테일 플래너 프로</span>
        <span>정확한 정보에서 시작하는, 더 좋은 기획.</span>
      </footer>
    </div>
  );
}
