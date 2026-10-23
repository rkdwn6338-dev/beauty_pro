// 브라우저 자동 검사 전용 진입점입니다. 서비스 라우트에 포함되지 않습니다.
import { createRoot } from "react-dom/client";
import { PlanningWorkspace } from "../../src/components/planning-workspace";
createRoot(document.getElementById("root")!).render(
  <PlanningWorkspace
    projectId="d1000000-0000-4000-8000-000000000001"
    productId="d2000000-0000-4000-8000-000000000001"
    storageReady
    aiReady={new URLSearchParams(window.location.search).get("ai") === "1"}
  />,
);
