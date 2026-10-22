import Link from "next/link";
import { Sparkles } from "lucide-react";
export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="뷰티 디테일 플래너 홈">
      <span className="logo-mark">
        <Sparkles size={22} />
      </span>
      <span>
        뷰티 디테일 플래너<small>프로페셔널 워크스페이스</small>
      </span>
      <sup>프로</sup>
    </Link>
  );
}
