import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiProjectAccess } from "@/lib/api-access";
// 임시 초안 API는 요청 보호·버전 저장을 우회하지 않도록 종료합니다.
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return apiError("허용되지 않은 요청입니다.", 403);
  const input = z
    .object({ projectId: z.uuid() })
    .safeParse(await request.json().catch(() => null));
  if (!input.success) return apiError("프로젝트 정보를 확인해 주세요.");
  const access = await apiProjectAccess(request, input.data.projectId);
  if (access.error) return access.error;
  return apiError("기획서 편집 화면에서 새 기획을 시작해 주세요.", 410);
}
