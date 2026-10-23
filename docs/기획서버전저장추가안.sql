-- 검토안: 아직 기존 Supabase에 적용하지 않았습니다.
-- 기존 9개 테이블/데이터/정책을 변경하지 않습니다.
-- 제품별 기획서 스냅샷을 새 planning_versions 테이블에 추가만 합니다.
-- 적용 후 별도 권한 검증 전까지 ENABLE_PLAN_STORAGE=false 유지.

create table public.planning_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  revision integer not null check (revision > 0),
  parent_id uuid references public.planning_versions(id) on delete restrict,
  restored_from uuid references public.planning_versions(id) on delete restrict,
  action text not null check (action in ('create','generate','edit','approve','unapprove','restore','regenerate_section')),
  changed_section_id uuid,
  snapshot jsonb not null check (octet_length(snapshot::text) <= 550000),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (product_id, revision)
);
-- 위 복합 유니크 인덱스는 제품별 최신 버전 조회와 동시 저장 충돌 방지에 사용합니다.
create index planning_versions_project_idx on public.planning_versions(project_id);
create index planning_versions_created_by_idx on public.planning_versions(created_by);
create index planning_versions_parent_idx on public.planning_versions(parent_id);
create index planning_versions_restored_from_idx on public.planning_versions(restored_from);
alter table public.planning_versions enable row level security;
revoke all on public.planning_versions from anon, authenticated;
grant select, insert on public.planning_versions to authenticated;
create policy planning_versions_read on public.planning_versions for select to authenticated
using (public.can_access_project(project_id));
create policy planning_versions_append on public.planning_versions for insert to authenticated
with check (created_by = (select auth.uid()) and exists (
  select 1 from public.products p where p.id = product_id and p.project_id = planning_versions.project_id and public.can_access_project(p.project_id)
));

create function public.phase_c_guard_planning_version() returns trigger
language plpgsql set search_path = '' as $$
declare
  previous public.planning_versions%rowtype;
  restored public.planning_versions%rowtype;
  product public.products%rowtype;
  brand_name text;
  item jsonb;
  prior_item jsonb;
  target jsonb;
  expected jsonb;
  citation jsonb;
  matching_citation jsonb;
  position integer;
  ids uuid[] := '{}';
  source_ids uuid[] := '{}';
  ref text;
  copy_text text;
  source_text text;
  quantity text[];
  supported text[];
  quantity_pattern constant text := '-?[0-9]+(,[0-9]{3})*(\.[0-9]+)?\s*(%|mg|ml|ppm|g|명|일|주|시간|분|초|배|종)|pH\s*[0-9]+(\.[0-9]+)?';
begin
  if TG_OP <> 'INSERT' then raise exception 'Planning history is append only' using errcode = '42501'; end if;
  if auth.uid() is null or new.created_by is distinct from auth.uid() then raise exception 'Invalid author' using errcode = '42501'; end if;
  select * into product from public.products where id = new.product_id;
  if product.id is null or product.project_id is distinct from new.project_id or not public.can_access_project(new.project_id) then raise exception 'Product unavailable' using errcode = '42501'; end if;
  select * into previous from public.planning_versions where product_id = new.product_id order by revision desc limit 1;
  if (previous.id is not null and new.project_id is distinct from previous.project_id) or new.parent_id is distinct from previous.id or new.revision <> coalesce(previous.revision, 0) + 1 then
    raise exception 'Stale planning version' using errcode = '40001';
  end if;
  -- 동시에 저장하면 같은 revision의 유니크 제약에서도 충돌합니다.
  new.created_at := statement_timestamp();
  if jsonb_typeof(new.snapshot) is distinct from 'object' or new.snapshot->'schemaVersion' is distinct from '1'::jsonb
    or jsonb_typeof(new.snapshot->'sections') is distinct from 'array'
    or jsonb_array_length(new.snapshot->'sections') not between 5 and 25
    or jsonb_typeof(new.snapshot->'sources') is distinct from 'array'
    or jsonb_array_length(new.snapshot->'sources') > 100
    or jsonb_typeof(new.snapshot->'coreUsp') is distinct from 'string'
    or jsonb_typeof(new.snapshot->'strategy') is distinct from 'string'
    or jsonb_typeof(new.snapshot->'ingredientInsights') is distinct from 'array'
    or jsonb_typeof(new.snapshot->'cautions') is distinct from 'array'
    or jsonb_typeof(new.snapshot->'basis') is distinct from 'object'
    or new.snapshot->'basis'->>'productId' is distinct from new.product_id::text then
    raise exception 'Invalid planning document';
  end if;
  for citation in select value from jsonb_array_elements(new.snapshot->'sources') loop
    if (citation->>'id')::uuid = any(source_ids) then raise exception 'Duplicate citation'; end if;
    source_ids := array_append(source_ids, (citation->>'id')::uuid);
  end loop;
  for item, position in select value, ordinality::integer from jsonb_array_elements(new.snapshot->'sections') with ordinality loop
    if jsonb_typeof(item) is distinct from 'object' or item->>'id' is null or item->>'status' is null
      or item->>'type' is null or item->>'type' not in ('hero','problem','point','foam','clinical','recommendation','closing','how_to_use','product_visual')
      or item->>'status' not in ('draft','approved')
      or jsonb_typeof(item->'headline') is distinct from 'string' or length(item->>'headline') not between 1 and 200
      or jsonb_typeof(item->'body') is distinct from 'string' or length(item->>'body') > 3000
      or jsonb_typeof(item->'visualGuide') is distinct from 'string' or length(item->>'visualGuide') not between 1 and 2000
      or jsonb_typeof(item->'evidenceIds') is distinct from 'array' or jsonb_array_length(item->'evidenceIds') > 20 then
      raise exception 'Invalid section';
    end if;
    if (item->>'id')::uuid = any(ids) then raise exception 'Duplicate section'; end if;
    ids := array_append(ids, (item->>'id')::uuid);
    if (item->>'status' = 'draft' and (item->'approvedBy' is distinct from 'null'::jsonb or item->'approvedAt' is distinct from 'null'::jsonb))
      or (item->>'status' = 'approved' and (item->>'approvedBy' is null or item->>'approvedAt' is null)) then raise exception 'Invalid approval metadata'; end if;
    for ref in select jsonb_array_elements_text(item->'evidenceIds') loop
      if not (ref::uuid = any(source_ids)) then raise exception 'Unknown citation'; end if;
    end loop;
  end loop;
  if new.action in ('create','generate') then
    if (new.action = 'create' and previous.id is not null) or (new.action = 'generate' and previous.id is null)
      or new.changed_section_id is not null or new.restored_from is not null then raise exception 'Invalid creation'; end if;
    select brand into brand_name from public.projects where id = product.project_id;
    if new.snapshot->'basis' is distinct from jsonb_build_object('productId', product.id, 'brand', brand_name, 'name', product.name,
      'category', product.category, 'subtype', product.subtype, 'ingredients', product.ingredients) then raise exception 'Invalid product basis'; end if;
    for item in select value from jsonb_array_elements(new.snapshot->'sections') loop
      if item->>'status' <> 'draft' then raise exception 'New sections must be drafts'; end if;
    end loop;
    for citation in select value from jsonb_array_elements(new.snapshot->'sources') loop
      select jsonb_build_object('id', e.id, 'sourceFileId', f.id, 'filename', f.filename, 'type', e.evidence_type,
        'excerpt', e.source_excerpt, 'claim', e.suggested_claim, 'page', e.page_number) into matching_citation
      from public.evidence e join public.source_files f on f.id = e.source_file_id
      where e.id = (citation->>'id')::uuid and e.review_status = 'approved'
        and f.project_id = product.project_id and (f.product_id is null or f.product_id = product.id);
      if matching_citation is null or matching_citation is distinct from citation then raise exception 'Invalid approved citation'; end if;
    end loop;
  elsif new.action = 'restore' then
    select * into restored from public.planning_versions where id = new.restored_from and product_id = product.id;
    if restored.id is null or restored.id = previous.id or new.snapshot is distinct from restored.snapshot or new.changed_section_id is not null then raise exception 'Invalid restoration'; end if;
  else
    if previous.id is null or new.restored_from is not null then raise exception 'Missing base version'; end if;
    if new.snapshot->'basis' is distinct from previous.snapshot->'basis' or new.snapshot->'sources' is distinct from previous.snapshot->'sources'
      or jsonb_array_length(new.snapshot->'sections') <> jsonb_array_length(previous.snapshot->'sections') then raise exception 'Immutable document basis'; end if;
    if new.action = 'edit' then
      if new.changed_section_id is not null then raise exception 'Invalid edit'; end if;
      for item, position in select value, ordinality::integer from jsonb_array_elements(new.snapshot->'sections') with ordinality loop
        prior_item := previous.snapshot->'sections'->(position - 1);
        if item->'id' is distinct from prior_item->'id' or item->'type' is distinct from prior_item->'type'
          or item->'status' is distinct from prior_item->'status' or item->'approvedBy' is distinct from prior_item->'approvedBy'
          or item->'approvedAt' is distinct from prior_item->'approvedAt'
          or (prior_item->>'status' = 'approved' and item is distinct from prior_item) then raise exception 'Approved sections are locked' using errcode = '42501'; end if;
      end loop;
    else
      select value, ordinality::integer into target, position from jsonb_array_elements(previous.snapshot->'sections') with ordinality
        where value->>'id' = new.changed_section_id::text;
      if target is null then raise exception 'Section unavailable'; end if;
      if new.action = 'regenerate_section' then
        item := new.snapshot->'sections'->(position-1);
        expected := jsonb_set(previous.snapshot, array['sections', (position-1)::text], item);
        if target->>'status' <> 'draft' or item->'id' is distinct from target->'id' or item->'type' is distinct from target->'type'
          or item->>'status' <> 'draft' or new.snapshot is distinct from expected then raise exception 'Regeneration can only change its draft section'; end if;
      elsif new.action = 'approve' then
        if target->>'status' <> 'draft' then raise exception 'Section already approved'; end if;
        copy_text := (target->>'headline') || ' ' || (target->>'body');
        if ((target->>'headline') || (target->>'body') || (target->>'visualGuide')) like '%[작성 필요]%'
          or (target->>'type' <> 'product_visual' and length(trim(target->>'body')) = 0)
          or copy_text ~ '치료|완치|부작용\s*없|100\s*%\s*안전'
          or (target->>'type' = 'clinical' and jsonb_array_length(target->'evidenceIds') = 0) then raise exception 'Section needs review'; end if;
        select coalesce(string_agg(s->>'excerpt', ' '), '') into source_text from jsonb_array_elements(new.snapshot->'sources') s
          where target->'evidenceIds' ? (s->>'id');
        select coalesce(array_agg(lower(regexp_replace(m[1], '[\s,]', '', 'g'))), '{}') into supported
          from regexp_matches(replace(source_text, ',', ''), '(' || quantity_pattern || ')', 'gi') m;
        for quantity in select regexp_matches(copy_text, '(' || quantity_pattern || ')', 'gi') loop
          if not (lower(regexp_replace(quantity[1], '[\s,]', '', 'g')) = any(supported)) then raise exception 'Unsupported numeric claim'; end if;
        end loop;
        -- 입력한 승인 시각을 제외하고 내용 전체가 기존 버전과 일치해야 합니다.
        item := target || jsonb_build_object('status', 'approved', 'approvedBy', auth.uid(), 'approvedAt', new.snapshot->'sections'->(position-1)->'approvedAt');
        expected := jsonb_set(previous.snapshot, array['sections', (position-1)::text], item);
        if new.snapshot is distinct from expected then raise exception 'Approval cannot edit content'; end if;
        new.snapshot := jsonb_set(expected, array['sections', (position-1)::text, 'approvedAt'], to_jsonb(new.created_at));
      elsif new.action = 'unapprove' then
        if target->>'status' <> 'approved' then raise exception 'Section is not approved'; end if;
        expected := jsonb_set(previous.snapshot, array['sections', (position-1)::text], target || '{"status":"draft","approvedBy":null,"approvedAt":null}'::jsonb);
        if new.snapshot is distinct from expected then raise exception 'Unapproval cannot edit content'; end if;
      else raise exception 'Invalid action'; end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.phase_c_guard_planning_version() from public, anon, authenticated;
create trigger phase_c_planning_version_guard before insert or update or delete on public.planning_versions
for each row execute function public.phase_c_guard_planning_version();
