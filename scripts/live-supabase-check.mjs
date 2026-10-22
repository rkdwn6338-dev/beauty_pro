import assert from "node:assert/strict";
const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert(base && key, "Supabase 연결 환경변수가 필요합니다.");
const headers = { apikey: key, "Content-Type": "application/json" };
for (const table of [
  "agencies",
  "agency_members",
  "projects",
  "products",
  "source_files",
  "evidence",
  "sections",
  "section_evidence",
  "analysis_jobs",
]) {
  const response = await fetch(`${base}/rest/v1/${table}?select=*&limit=1`, {
    headers,
  });
  assert.equal(response.status, 200, `${table} 조회 응답`);
  assert.deepEqual(
    await response.json(),
    [],
    `${table} 비로그인 자료 노출 차단`,
  );
  console.log(`통과: 비로그인 ${table} 자료 노출 차단`);
}
const result = await fetch(
  `${base}/storage/v1/object/source-documents/00000000-0000-4000-8000-000000000000/probe.pdf`,
  {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/pdf" },
    body: "%PDF-1.7\n",
  },
);
assert(!result.ok, "비로그인 업로드가 차단되어야 합니다.");
console.log("통과: 비로그인 원본 업로드 차단");
