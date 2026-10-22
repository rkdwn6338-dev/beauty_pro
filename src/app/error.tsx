"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="error-page">
      <span className="eyebrow">연결을 확인해 주세요</span>
      <h1>화면을 불러오지 못했습니다.</h1>
      <p>입력 중인 내용이 있다면 먼저 복사해 두고 다시 시도해 주세요.</p>
      <button className="button primary" onClick={reset}>
        다시 시도
      </button>
      <Link href="/workspace" className="text-link">
        프로젝트 목록으로
      </Link>
    </main>
  );
}
