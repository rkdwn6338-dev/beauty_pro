import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "뷰티 디테일 플래너 프로",
    template: "%s | 뷰티 디테일 플래너",
  },
  description:
    "제품 정보와 근거 자료를 한곳에. 뷰티 브랜드를 위한 상세페이지 기획 워크스페이스.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <a href="#main" className="skip-link">
          본문으로 건너뛰기
        </a>
        {children}
      </body>
    </html>
  );
}
