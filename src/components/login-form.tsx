"use client";
import { useActionState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { login, type ActionState } from "@/app/actions";
export function LoginForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(login, {} as ActionState);
  return (
    <form action={action} className="form-stack">
      <label>
        이메일
        <input
          type="email"
          name="email"
          autoComplete="username"
          placeholder="이메일 주소를 입력해 주세요"
          required
          maxLength={200}
        />
      </label>
      <label>
        비밀번호
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="비밀번호를 입력해 주세요"
          required
          maxLength={200}
        />
      </label>
      {!configured && (
        <p role="alert" className="notice error">
          서비스 연결을 준비 중입니다. 관리자에게 문의해 주세요.
        </p>
      )}
      {state.error && (
        <p role="alert" className="notice error">
          {state.error}
        </p>
      )}
      <button className="button primary wide" disabled={pending || !configured}>
        {pending ? (
          <>
            <LoaderCircle className="spin" size={18} />
            로그인 중…
          </>
        ) : (
          <>
            워크스페이스로 이동
            <ArrowRight size={18} />
          </>
        )}
      </button>
      <p className="small muted">
        초대받은 계정으로 로그인해 주세요.
        <br />
        계정 또는 비밀번호 설정이 필요하면 서비스 관리자에게 문의해 주세요.
      </p>
    </form>
  );
}
