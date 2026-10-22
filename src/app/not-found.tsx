import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="error-page">
      <span className="eyebrow">페이지를 찾을 수 없습니다</span>
      <h1>주소 또는 접근 권한을 확인해 주세요.</h1>
      <p>프로젝트가 없거나 접근할 권한이 없습니다.</p>
      <Link href="/workspace" className="button primary">
        프로젝트 목록으로
      </Link>
    </main>
  );
}
