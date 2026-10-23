import type { Tables } from "./database.types";
import type { Finding } from "./analysis";
import type { Plan } from "./planning";
export const demoFinding: Finding = {
  evidenceType: "clinical",
  studyName: "가상 세정력 시험",
  institution: "체험용 가상 기관",
  subjects: "가상 대상자 20명",
  duration: "가상 시험 2주",
  result: "가상 시험에서 세정 지표가 12.5% 변화했습니다.",
  measurements: [{ metric: "세정 지표 변화", value: "12.5", unit: "%" }],
  pageNumber: 3,
  sourceExcerpt:
    "[체험용 가상 문구] 대상자 20명, 2주 사용 후 세정 지표 12.5% 변화. 실제 제품의 시험 결과가 아닙니다.",
  suggestedClaim: "체험용 예시: 세정 지표 12.5% 변화",
  limitations: [
    "이 자료와 수치는 화면 체험을 위한 가상 예시이며 실제 제품에 사용할 수 없습니다.",
  ],
};
export const demoFile: Tables<"source_files"> = {
  id: "a1000000-0000-4000-8000-000000000001",
  project_id: "a2000000-0000-4000-8000-000000000001",
  product_id: null,
  filename: "체험용_가상시험.pdf",
  storage_path: "",
  bytes: 0,
  status: "uploaded",
  mime_type: "application/pdf",
  uploaded_by: null,
  created_at: "2026-10-23T00:00:00Z",
};
export const demoEvidence: Tables<"evidence"> = {
  id: "a3000000-0000-4000-8000-000000000001",
  source_file_id: demoFile.id,
  evidence_type: "clinical",
  extracted_result: { ...demoFinding },
  page_number: 3,
  source_excerpt: demoFinding.sourceExcerpt,
  suggested_claim: demoFinding.suggestedClaim,
  review_status: "pending",
  reviewed_by: null,
  created_at: demoFile.created_at,
};
export const demoPlan: Plan = {
  coreUsp: "체험용 초안: 매일의 세정을 편안한 경험으로",
  strategy:
    "성분·거품·사용 경험을 연결하는 예시 전략입니다. 실제 제품 기획이 아닙니다.",
  ingredientInsights: [
    {
      ingredient: "글리세린",
      role: "일반적인 보습제 역할을 검토합니다.",
      limitation: "원료적 역할이며 완제품 보습 효능을 입증하지 않습니다.",
    },
  ],
  sections: [
    {
      type: "hero",
      headline: "하루의 끝, 나를 위한 세정 시간",
      body: "체험용 카피 예시입니다.",
      visualGuide: "제품과 물의 절제된 연출",
      evidenceIds: [],
    },
    {
      type: "foam",
      headline: "거품으로 전하는 사용 경험",
      body: "실제 제품의 거품 특성과 사용 사진을 확인한 뒤 카피를 정합니다.",
      visualGuide: "실제 거품 밀도와 세안 장면 촬영 필요",
      evidenceIds: [],
    },
    {
      type: "clinical",
      headline: "근거를 확인하는 시간",
      body: "가상 예시의 세정 지표 12.5% 변화. 실제 제품에 사용할 수 없습니다.",
      visualGuide: "체험용이라는 문구와 원본 페이지 연결",
      evidenceIds: [demoEvidence.id],
    },
    {
      type: "recommendation",
      headline: "이런 분들께 제안합니다",
      body: "제품에 맞는 타깃을 확인한 뒤 작성합니다.",
      visualGuide: "타깃의 사용 장면",
      evidenceIds: [],
    },
    {
      type: "closing",
      headline: "매일의 루틴을 위한 한 걸음",
      body: "체험용 마무리 카피입니다.",
      visualGuide: "한 가지 메시지로 정리",
      evidenceIds: [],
    },
    {
      type: "how_to_use",
      headline: "사용방법",
      body: "실제 제품 라벨의 사용방법을 확인해 작성합니다.",
      visualGuide: "확인된 사용 순서 촬영",
      evidenceIds: [],
    },
    {
      type: "product_visual",
      headline: "제품의 마지막 인상",
      body: "",
      visualGuide: "실제 제품 단독 연출",
      evidenceIds: [],
    },
  ],
  cautions: [
    "모든 내용은 화면 체험용 예시입니다. 실제 시험·AI 분석·완성된 기획 결과가 아닙니다.",
  ],
};
