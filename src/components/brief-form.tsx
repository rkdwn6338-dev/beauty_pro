"use client";
import { useState, useTransition } from "react";
import { Check, Save, Info } from "lucide-react";
import { saveBrief } from "@/app/actions";
import {
  categories,
  type Brief,
  type Category,
  emptyBrief,
  emptyFeatures,
  conditionalFields,
  featureLabels,
  briefSchema,
} from "@/lib/brief";
import type { Tables } from "@/lib/database.types";

function initialBrief(product?: Tables<"products">): Brief {
  if (!product) return { ...emptyBrief, features: { ...emptyFeatures } };
  const features =
    typeof product.features === "object" &&
    product.features &&
    !Array.isArray(product.features)
      ? product.features
      : {};
  return {
    name: product.name,
    category: (product.category && product.category in categories
      ? product.category
      : "페이스 클렌징") as Category,
    subtype: product.subtype ?? "폼",
    ingredients: product.ingredients ?? "",
    highlighted_ingredients: product.highlighted_ingredients ?? "",
    features: {
      ...emptyFeatures,
      ...Object.fromEntries(
        Object.entries(features).filter(([, v]) => typeof v === "string"),
      ),
    },
  };
}
export function BriefForm({
  projectId,
  product,
  preview = false,
}: {
  projectId?: string;
  product?: Tables<"products">;
  preview?: boolean;
}) {
  const [brief, setBrief] = useState(() => initialBrief(product));
  const [productId, setProductId] = useState(product?.id ?? null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const update = (value: Partial<Brief>) => {
    setBrief((current) => ({ ...current, ...value }));
    setDirty(true);
    setMessage("");
  };
  const feature = (key: keyof Brief["features"], value: string) =>
    update({ features: { ...brief.features, [key]: value } });
  const options = categories[brief.category];
  const isCustom = !options.includes(brief.subtype as never);
  const completed = [
    brief.name,
    brief.ingredients,
    brief.highlighted_ingredients,
    brief.features.texture,
    brief.features.target,
  ].filter((v) => v.trim()).length;
  const renderFeature = (key: keyof Brief["features"]) => (
    <label key={key}>
      {featureLabels[key]}
      {key === "ph" ? (
        <input
          value={brief.features[key]}
          onChange={(e) => feature(key, e.target.value)}
          placeholder="예: 5.5"
          inputMode="decimal"
          maxLength={10}
        />
      ) : (
        <textarea
          rows={3}
          value={brief.features[key]}
          onChange={(e) => feature(key, e.target.value)}
          maxLength={10000}
          placeholder="확인된 제품 정보를 적어주세요. 모르는 내용은 비워두어도 괜찮습니다."
        />
      )}
    </label>
  );
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setError("");
        setMessage("");
        const parsed = briefSchema.safeParse(brief);
        if (!parsed.success) {
          setError(
            parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.",
          );
          return;
        }
        if (preview) {
          setMessage(
            "입력 형식이 올바릅니다. 실제 저장은 로그인 후 사용할 수 있습니다.",
          );
          return;
        }
        startTransition(async () => {
          try {
            const result = await saveBrief(projectId!, productId, brief);
            if (result.error) setError(result.error);
            else {
              setProductId(result.productId!);
              setDirty(false);
              setMessage(result.success!);
            }
          } catch {
            setError(
              "저장하지 못했습니다. 입력 내용은 유지됩니다. 다시 시도해 주세요.",
            );
          }
        });
      }}
      className="brief-layout"
    >
      <div className="brief-main">
        {preview && (
          <div className="notice">
            <Info size={18} />
            입력 체험 화면입니다. 입력한 내용은 서버에 저장되지 않습니다.
          </div>
        )}
        <section className="panel">
          <div className="section-heading">
            <span className="step-number">01</span>
            <div>
              <h2>제품의 기본 정보</h2>
              <p>기획의 시작이 되는 제품 정보를 알려주세요.</p>
            </div>
          </div>
          <div className="form-grid">
            <label className="full">
              제품명 <em>필수</em>
              <input
                required
                value={brief.name}
                onChange={(e) => update({ name: e.target.value })}
                maxLength={200}
                placeholder="제품의 정확한 이름"
              />
            </label>
            <label>
              대카테고리
              <select
                aria-label="대카테고리"
                value={brief.category}
                onChange={(e) => {
                  const category = e.target.value as Category;
                  update({ category, subtype: categories[category][0] });
                }}
              >
                {Object.keys(categories).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              세부 품목
              <select
                aria-label="세부 품목"
                value={isCustom ? "기타" : brief.subtype}
                onChange={(e) =>
                  update({
                    subtype: e.target.value === "기타" ? "" : e.target.value,
                  })
                }
              >
                {options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
                <option value="기타">그 외 품목 · 직접 입력</option>
              </select>
            </label>
            {isCustom && (
              <label className="full">
                직접 입력한 품목
                <input
                  aria-label="직접 입력한 품목"
                  value={brief.subtype}
                  required
                  maxLength={100}
                  onChange={(e) => update({ subtype: e.target.value })}
                />
              </label>
            )}
          </div>
        </section>
        <section className="panel">
          <div className="section-heading">
            <span className="step-number">02</span>
            <div>
              <h2>성분과 제품의 강점</h2>
              <p>전성분은 제품 표기 순서 그대로 입력해 주세요.</p>
            </div>
          </div>
          <div className="form-stack">
            <label>
              전성분 전체 <em>필수</em>
              <textarea
                rows={6}
                required
                value={brief.ingredients}
                onChange={(e) => update({ ingredients: e.target.value })}
                maxLength={10000}
                placeholder="정제수, 글리세린…"
              />
            </label>
            <label>
              강조하고 싶은 핵심 성분 및 함량
              <textarea
                rows={3}
                value={brief.highlighted_ingredients}
                onChange={(e) =>
                  update({ highlighted_ingredients: e.target.value })
                }
                maxLength={10000}
                placeholder="예: 스쿠알란 5% · 확인된 함량만 입력해 주세요"
              />
            </label>
            <div className="form-grid">
              {(["ph", "fragrance", "texture", "packaging"] as const).map(
                renderFeature,
              )}
              {conditionalFields(brief.category, brief.subtype).map(
                renderFeature,
              )}
            </div>
          </div>
        </section>
        <section className="panel">
          <div className="section-heading">
            <span className="step-number">03</span>
            <div>
              <h2>근거와 소비자</h2>
              <p>확인된 사실과 제품을 사용할 사람을 연결해 주세요.</p>
            </div>
          </div>
          <div className="form-grid">
            {(["certifications", "clinical", "target", "other"] as const).map(
              renderFeature,
            )}
          </div>
        </section>
        <div className="save-bar">
          <div aria-live="polite">
            {error ? (
              <p role="alert" className="text-error">
                {error}
              </p>
            ) : message ? (
              <p className="text-success">
                <Check size={17} />
                {message}
              </p>
            ) : (
              <p className="muted">
                {dirty
                  ? "저장하지 않은 변경사항이 있습니다."
                  : "필수 항목: 제품명 · 전성분 전체"}
              </p>
            )}
          </div>
          <button className="button primary" disabled={pending}>
            <Save size={17} />
            {pending ? "저장 중…" : preview ? "입력 확인하기" : "브리프 저장"}
          </button>
        </div>
      </div>
      <aside className="brief-aside">
        <div className="panel">
          <span className="eyebrow">브리프 가이드</span>
          <h3>
            좋은 기획은
            <br />
            정확한 정보에서.
          </h3>
          <p className="muted small">
            확실한 내용만 입력해 주세요. 아직 확인하지 못한 수치나 효능은
            비워두셔도 됩니다.
          </p>
          <div className="progress-track">
            <span style={{ width: `${(completed / 5) * 100}%` }} />
          </div>
          <p className="small muted">핵심 정보 {completed} / 5 입력</p>
          <hr />
          <p className="small">
            전성분과 제품 특징을 저장한 뒤, 임상 보고서와 제품 사진을 자료 탭에
            올려주세요.
          </p>
          <span className="badge">스마트 브리프 0.5</span>
        </div>
        <p className="small muted aside-note">
          자료 분석과 상세페이지 기획은 다음 단계에서 제공됩니다.
        </p>
      </aside>
    </form>
  );
}
