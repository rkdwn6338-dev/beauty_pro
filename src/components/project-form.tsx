"use client";
import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { createProject, type ActionState } from "@/app/actions";
export function ProjectForm({
  agencies,
}: {
  agencies: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(
    createProject,
    {} as ActionState,
  );
  return (
    <form action={action} className="form-stack">
      <label>
        소속 회사
        <select name="agency_id" required>
          {agencies.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        고객사·브랜드
        <input
          name="brand"
          required
          maxLength={100}
          placeholder="브랜드 이름"
        />
      </label>
      <label>
        프로젝트명
        <input
          name="title"
          required
          maxLength={200}
          placeholder="예: 신제품 클렌징오일 상세페이지"
        />
      </label>
      {state.error && (
        <p role="alert" className="notice error">
          {state.error}
        </p>
      )}
      <button className="button primary" disabled={pending || !agencies.length}>
        {pending ? "생성 중…" : "프로젝트 만들기"}
        <ArrowRight size={18} />
      </button>
    </form>
  );
}
