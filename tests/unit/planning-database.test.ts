import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import {
  changeApproval,
  createDocument,
  type PlanDocument,
} from "@/lib/plan-document";
import { demoPlan, demoEvidence, demoFile } from "@/lib/analysis-demo";
const db = new PGlite();
const u1 = "c1000000-0000-4000-8000-000000000001",
  u2 = "c1000000-0000-4000-8000-000000000002";
const p1 = "c2000000-0000-4000-8000-000000000001",
  p2 = "c2000000-0000-4000-8000-000000000002";
const productId = "c3000000-0000-4000-8000-000000000001";
const makeDocument = () =>
  createDocument(
    demoPlan,
    {
      productId,
      brand: "검증",
      name: "검증 제품",
      category: "페이스 클렌징",
      subtype: "폼",
      ingredients: "정제수, 글리세린",
    },
    [
      {
        id: demoEvidence.id,
        sourceFileId: demoFile.id,
        filename: demoFile.filename,
        type: "clinical",
        excerpt: demoEvidence.source_excerpt,
        claim: demoEvidence.suggested_claim,
        page: 3,
      },
    ],
  );
async function append(
  snapshot: PlanDocument,
  revision = 1,
  parent: string | null = null,
  action = "create",
  section: string | null = null,
  restored: string | null = null,
  author = u1,
) {
  return (
    await db.query<{ id: string; snapshot: PlanDocument }>(
      `insert into public.planning_versions(project_id,product_id,revision,parent_id,action,changed_section_id,restored_from,snapshot,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id,snapshot`,
      [
        p1,
        productId,
        revision,
        parent,
        action,
        section,
        restored,
        JSON.stringify(snapshot),
        author,
      ],
    )
  ).rows[0];
}
async function blocked(work: () => Promise<unknown>) {
  await db.exec("savepoint expected_failure");
  let error: unknown;
  try {
    await work();
  } catch (e) {
    error = e;
  }
  await db.exec(
    "rollback to savepoint expected_failure; release savepoint expected_failure",
  );
  expect(error).toBeTruthy();
  return error;
}
beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;
    create table public.projects(id uuid primary key, brand text, owner_id uuid);
    create table public.products(id uuid primary key, project_id uuid references public.projects, name text, category text, subtype text, ingredients text);
    create table public.source_files(id uuid primary key, project_id uuid references public.projects, product_id uuid, filename text);
    create table public.evidence(id uuid primary key, source_file_id uuid references public.source_files, review_status text, evidence_type text, source_excerpt text, suggested_claim text, page_number integer);
    create function public.can_access_project(p uuid) returns boolean language sql stable as $$ select exists(select 1 from public.projects where id=p and owner_id=auth.uid()) $$;
    grant select on public.projects, public.products, public.source_files, public.evidence to authenticated;
    insert into auth.users values ('${u1}'),('${u2}');
    insert into public.projects values ('${p1}','검증','${u1}'),('${p2}','타사','${u2}');
    insert into public.products values ('${productId}','${p1}','검증 제품','페이스 클렌징','폼','정제수, 글리세린');
    insert into public.source_files values ('${demoFile.id}','${p1}','${productId}','${demoFile.filename}');
  `);
  await db.query(
    "insert into public.evidence values($1,$2,'approved','clinical',$3,$4,3)",
    [
      demoEvidence.id,
      demoFile.id,
      demoEvidence.source_excerpt,
      demoEvidence.suggested_claim,
    ],
  );
  await db.exec(
    await readFile(
      new URL("../../docs/기획서버전저장추가안.sql", import.meta.url),
      "utf8",
    ),
  );
}, 30000);
beforeEach(async () => {
  await db.exec(
    `begin; set local role authenticated; set local request.jwt.claim.sub = '${u1}';`,
  );
});
afterEach(async () => {
  await db.exec("rollback");
});
afterAll(async () => {
  await db.close();
});
describe("로컬 PostgreSQL 기획서 버전 보호", () => {
  it("구좌 재생성은 선택한 초안 구좌만 변경하고 다른 구좌는 유지한다", async () => {
    const doc = makeDocument();
    const v = await append(doc);
    const next = structuredClone(doc);
    next.sections[1].headline = "다시 쓴 제목";
    next.sections[0].body = "다른 구좌 변경";
    await blocked(() =>
      append(next, 2, v.id, "regenerate_section", doc.sections[1].id),
    );
    next.sections[0] = structuredClone(doc.sections[0]);
    await append(next, 2, v.id, "regenerate_section", doc.sections[1].id);
  });
  it("연결 원문과 일치하는 시험 수치는 승인할 수 있다", async () => {
    const doc = makeDocument();
    const v = await append(doc);
    const section = doc.sections.find((s) => s.type === "clinical")!;
    await append(
      changeApproval(doc, section.id, true, u1),
      2,
      v.id,
      "approve",
      section.id,
    );
  });
  it("같은 회사의 기획을 저장하고 읽는다", async () => {
    const v = await append(makeDocument());
    expect(v.id).toBeTruthy();
    expect(
      (await db.query("select * from public.planning_versions")).rows,
    ).toHaveLength(1);
  });
  it("다른 회사에는 버전이 보이지 않고 추가도 차단한다", async () => {
    const doc = makeDocument();
    await append(doc);
    await db.exec(`set local request.jwt.claim.sub = '${u2}'`);
    expect(
      (await db.query("select * from public.planning_versions")).rows,
    ).toEqual([]);
    await blocked(() => append(doc, 1, null, "create", null, null, u2));
  });
  it("비로그인 사용자는 읽을 수 없다", async () => {
    await db.exec("set local role anon");
    await blocked(() => db.query("select * from public.planning_versions"));
  });
  it("작성자를 다른 사용자로 위조할 수 없다", async () => {
    await blocked(() =>
      append(makeDocument(), 1, null, "create", null, null, u2),
    );
  });
  it("기존 버전을 직접 수정하거나 삭제할 수 없다", async () => {
    const v = await append(makeDocument());
    await blocked(() =>
      db.query(
        "update public.planning_versions set action='edit' where id=$1",
        [v.id],
      ),
    );
    await blocked(() =>
      db.query("delete from public.planning_versions where id=$1", [v.id]),
    );
  });
  it("관리 권한으로도 기존 행 UPDATE·DELETE는 트리거가 막는다", async () => {
    const v = await append(makeDocument());
    await db.exec("reset role");
    await blocked(() =>
      db.query(
        "update public.planning_versions set action='edit' where id=$1",
        [v.id],
      ),
    );
    await blocked(() =>
      db.query("delete from public.planning_versions where id=$1", [v.id]),
    );
  });
  it("이미 저장된 버전 번호와 오래된 부모 버전을 재사용하지 않는다", async () => {
    const doc = makeDocument();
    const v = await append(doc);
    await blocked(() => append(doc));
    const next = structuredClone(doc);
    next.coreUsp = "수정";
    await append(next, 2, v.id, "edit");
    await blocked(() => append(next, 2, v.id, "edit"));
  });
  it("처음부터 승인 상태인 구좌와 위조한 원문을 거절한다", async () => {
    const doc = makeDocument();
    const approved = changeApproval(doc, doc.sections[0].id, true, u1);
    await blocked(() => append(approved));
    doc.sources[0].excerpt = "바꾼 원문";
    await blocked(() => append(doc));
  });
  it("승인은 작성 내용을 바꾸지 않고 승인자와 서버 시각을 기록한다", async () => {
    const doc = makeDocument();
    const v = await append(doc);
    const approved = changeApproval(doc, doc.sections[0].id, true, u1);
    approved.sections[0].approvedAt = "2000-01-01T00:00:00Z";
    const next = await append(approved, 2, v.id, "approve", doc.sections[0].id);
    expect(next.snapshot.sections[0].approvedBy).toBe(u1);
    expect(next.snapshot.sections[0].approvedAt).not.toContain("2000-01-01");
    expect(next.snapshot.sections.slice(1)).toEqual(doc.sections.slice(1));
  });
  it("승인 요청으로 다른 구좌를 함께 수정할 수 없다", async () => {
    const doc = makeDocument();
    const v = await append(doc);
    const next = changeApproval(doc, doc.sections[0].id, true, u1);
    next.sections[1].headline = "함께 바꾸기";
    await blocked(() => append(next, 2, v.id, "approve", doc.sections[0].id));
  });
  it("승인한 구좌는 변경을 막고 해제 후 새 버전에서만 편집한다", async () => {
    const doc = makeDocument();
    const v1 = await append(doc);
    const v2 = await append(
      changeApproval(doc, doc.sections[0].id, true, u1),
      2,
      v1.id,
      "approve",
      doc.sections[0].id,
    );
    const changed = structuredClone(v2.snapshot);
    changed.sections[0].headline = "수정";
    await blocked(() => append(changed, 3, v2.id, "edit"));
    const unlocked = changeApproval(v2.snapshot, doc.sections[0].id, false, u1);
    const v3 = await append(
      unlocked,
      3,
      v2.id,
      "unapprove",
      doc.sections[0].id,
    );
    unlocked.sections[0].headline = "허용된 수정";
    await append(unlocked, 4, v3.id, "edit");
  });
  it("복구는 원본 스냅샷과 정확히 같아야 하고 새 버전으로 추가한다", async () => {
    const doc = makeDocument();
    const v1 = await append(doc);
    const changed = structuredClone(doc);
    changed.coreUsp = "새 기획";
    const v2 = await append(changed, 2, v1.id, "edit");
    await blocked(() => append(changed, 3, v2.id, "restore", null, v1.id));
    await append(doc, 3, v2.id, "restore", null, v1.id);
    expect(
      (await db.query("select * from public.planning_versions")).rows,
    ).toHaveLength(3);
  });
  it("근거에 없는 효능 수치는 직접 DB 승인 요청에서도 차단한다", async () => {
    const doc = makeDocument();
    const clinical = doc.sections.find((s) => s.type === "clinical")!;
    clinical.body = "개선 99.9%";
    const v1 = await append(doc);
    const forged = structuredClone(doc);
    const target = forged.sections.find((s) => s.id === clinical.id)!;
    target.status = "approved";
    target.approvedBy = u1;
    target.approvedAt = new Date().toISOString();
    await blocked(() => append(forged, 2, v1.id, "approve", clinical.id));
  });
  it("기존 제품의 소속이 바뀌어도 과거 기획이 다른 회사로 노출되지 않는다", async () => {
    await append(makeDocument());
    await db.exec(
      `reset role; update public.products set project_id='${p2}' where id='${productId}'; set local role authenticated; set local request.jwt.claim.sub='${u2}'`,
    );
    expect(
      (await db.query("select * from public.planning_versions")).rows,
    ).toHaveLength(0);
  });
});
