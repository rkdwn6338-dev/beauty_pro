import Link from "next/link";
import { Logo } from "@/components/logo";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/actions";
import { FolderOpen, LogOut, LockKeyhole, Plus, Sparkles } from "lucide-react";
export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireUser();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo />
        <p className="nav-caption">워크스페이스</p>
        <nav>
          <Link href="/workspace" className="side-link active">
            <FolderOpen size={19} />
            프로젝트
          </Link>
          <Link href="/workspace/new" className="side-link">
            <Plus size={19} />새 프로젝트
          </Link>
        </nav>
        <div className="sidebar-note">
          <Sparkles size={20} />
          <strong>기획의 첫 단계를 함께.</strong>
          <p>
            제품 브리프와 자료를 모아
            <br />
            다음 기획을 준비하세요.
          </p>
        </div>
        <div className="sidebar-user">
          <span className="avatar">
            {user.email?.slice(0, 1).toUpperCase()}
          </span>
          <span className="user-email">
            {user.email}
            <small>비공개 계정</small>
          </span>
          <form action={logout}>
            <button className="icon-button" aria-label="로그아웃">
              <LogOut size={17} />
            </button>
          </form>
        </div>
      </aside>
      <div className="app-content">
        <header className="app-topbar">
          <span>제품에서 시작하는 더 좋은 기획</span>
          <span>
            <LockKeyhole size={14} />
            비공개 워크스페이스
          </span>
        </header>
        <main id="main" className="workspace-main">
          {children}
        </main>
      </div>
    </div>
  );
}
