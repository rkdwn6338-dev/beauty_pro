-- 2026-10-23 사용자 승인 후 실제 Supabase에 적용했습니다.
-- 기존 자료·테이블·정책은 변경하지 않습니다. AI 호출도 활성화하지 않습니다.
-- 기획 전체/구좌 재생성의 중복 요청을 기록하는 테이블과 원자적 완료 함수입니다.
-- 같은 제품은 동시에 1건만 실행, 같은 회사는 한국시간 하루 최대 20건 예약.
-- 실패·만료도 20건에 포함합니다. 이는 요청 횟수 제한이며 금액 한도는 아닙니다.
create table public.planning_generation_requests (
  id uuid primary key,
  agency_id uuid not null references public.agencies(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  operation text not null check (operation in ('generate','regenerate_section')),
  base_version_id uuid references public.planning_versions(id) on delete restrict,
  section_id uuid,
  input_hash text not null check (input_hash ~ '^[a-f0-9]{64}$'),
  model text not null check (length(model) between 1 and 200),
  status text not null default 'running' check (status in ('running','completed','failed','expired')),
  result_version_id uuid references public.planning_versions(id) on delete restrict,
  error_message text check (length(error_message) <= 500),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  finished_at timestamptz
);
create unique index planning_generation_one_active_product on public.planning_generation_requests(product_id) where status='running';
create index planning_generation_agency_day_idx on public.planning_generation_requests(agency_id,created_at);
create index planning_generation_project_idx on public.planning_generation_requests(project_id);
create index planning_generation_user_idx on public.planning_generation_requests(requested_by);
create index planning_generation_base_idx on public.planning_generation_requests(base_version_id);
create index planning_generation_result_idx on public.planning_generation_requests(result_version_id);
alter table public.planning_generation_requests enable row level security;
revoke all on public.planning_generation_requests from anon, authenticated;
grant select,insert,update on public.planning_generation_requests to authenticated;
create policy planning_generation_read on public.planning_generation_requests for select to authenticated
using (public.is_agency_member(agency_id));
create policy planning_generation_insert on public.planning_generation_requests for insert to authenticated
with check (requested_by=(select auth.uid()) and public.is_agency_member(agency_id) and public.can_access_project(project_id));
create policy planning_generation_update on public.planning_generation_requests for update to authenticated
using (public.is_agency_member(agency_id) and public.can_access_project(project_id))
with check (public.is_agency_member(agency_id) and public.can_access_project(project_id));

create function public.guard_planning_generation_request() returns trigger
language plpgsql security invoker set search_path='' as $$
declare
  p public.projects%rowtype;
  product public.products%rowtype;
  base public.planning_versions%rowtype;
  latest_id uuid;
  section jsonb;
  result public.planning_versions%rowtype;
  day_start timestamptz := date_trunc('day', statement_timestamp() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
begin
  if TG_OP='DELETE' then raise exception 'Request receipts cannot be deleted' using errcode='42501'; end if;
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if TG_OP='INSERT' then
    if new.requested_by is distinct from auth.uid() or new.status<>'running' or new.result_version_id is not null
      or new.finished_at is not null or new.error_message is not null then raise exception 'Invalid reservation' using errcode='42501'; end if;
    select * into p from public.projects where id=new.project_id;
    select * into product from public.products where id=new.product_id;
    if p.id is null or product.id is null or product.project_id<>p.id or p.agency_id<>new.agency_id
      or not public.is_agency_member(new.agency_id) then raise exception 'Project unavailable' using errcode='42501'; end if;
    select id into latest_id from public.planning_versions where product_id=product.id and project_id=p.id order by revision desc limit 1;
    if new.base_version_id is distinct from latest_id then raise exception 'Stale base version' using errcode='40001'; end if;
    if new.operation='regenerate_section' then
      select * into base from public.planning_versions where id=new.base_version_id and product_id=product.id;
      select value into section from jsonb_array_elements(base.snapshot->'sections') where value->>'id'=new.section_id::text;
      if section is null or section->>'status'<>'draft' then raise exception 'Only draft sections may regenerate' using errcode='42501'; end if;
    elsif new.section_id is not null then raise exception 'Unexpected section'; end if;
    -- 같은 회사의 동시 예약을 직렬화하여 일일 상한을 우회하지 못하게 합니다.
    perform pg_advisory_xact_lock(hashtextextended('planning-generation:'||new.agency_id::text,0));
    if (select count(*) from public.planning_generation_requests where agency_id=new.agency_id and created_at>=day_start) >= 20 then
      raise exception 'Daily generation request limit reached' using errcode='P0001';
    end if;
    new.created_at:=statement_timestamp(); new.expires_at:=new.created_at+interval '15 minutes';
  else
    if (to_jsonb(new)-array['status','result_version_id','error_message','finished_at']) is distinct from
       (to_jsonb(old)-array['status','result_version_id','error_message','finished_at']) or old.status<>'running' then
      raise exception 'Immutable request receipt' using errcode='42501';
    end if;
    if new.status='expired' then
      if old.expires_at>statement_timestamp() or new.result_version_id is not null then raise exception 'Active request cannot expire' using errcode='42501'; end if;
    else
      if old.requested_by is distinct from auth.uid() then raise exception 'Only request owner may finish' using errcode='42501'; end if;
      if new.status='completed' then
        select * into result from public.planning_versions where id=new.result_version_id and product_id=old.product_id and project_id=old.project_id;
        if result.id is null or result.parent_id is distinct from old.base_version_id or result.created_by is distinct from old.requested_by
          or (old.operation='regenerate_section' and (result.action<>'regenerate_section' or result.changed_section_id is distinct from old.section_id))
          or (old.operation='generate' and result.action not in ('create','generate')) or new.error_message is not null then
          raise exception 'Invalid generation result' using errcode='42501';
        end if;
      elsif new.status='failed' then
        if new.result_version_id is not null then raise exception 'Failed request cannot have result'; end if;
      else raise exception 'Invalid status transition' using errcode='42501'; end if;
    end if;
    new.finished_at:=statement_timestamp();
  end if;
  return new;
end;
$$;
revoke all on function public.guard_planning_generation_request() from public,anon,authenticated;
create trigger planning_generation_guard before insert or update or delete on public.planning_generation_requests
for each row execute function public.guard_planning_generation_request();

-- 기획 버전 저장과 요청 완료를 한 트랜잭션에 묶습니다.
create function public.complete_planning_generation(p_request_id uuid,p_snapshot jsonb)
returns setof public.planning_versions
language plpgsql security invoker set search_path='' as $$
declare
  job public.planning_generation_requests%rowtype;
  v public.planning_versions%rowtype;
  last_revision integer;
begin
  select * into job from public.planning_generation_requests where id=p_request_id for update;
  if job.id is null or job.requested_by is distinct from auth.uid() then raise exception 'Request unavailable' using errcode='42501'; end if;
  if job.status='completed' then
    return query select * from public.planning_versions where id=job.result_version_id; return;
  end if;
  if job.status<>'running' or job.expires_at<=statement_timestamp() then raise exception 'Request no longer active' using errcode='40001'; end if;
  select revision into last_revision from public.planning_versions where product_id=job.product_id order by revision desc limit 1;
  insert into public.planning_versions(project_id,product_id,revision,parent_id,action,changed_section_id,snapshot,created_by)
    values(job.project_id,job.product_id,coalesce(last_revision,0)+1,job.base_version_id,
      case when job.operation='regenerate_section' then 'regenerate_section' when job.base_version_id is null then 'create' else 'generate' end,
      job.section_id,p_snapshot,job.requested_by) returning * into v;
  update public.planning_generation_requests set status='completed',result_version_id=v.id,error_message=null where id=job.id;
  return next v;
end;
$$;
revoke all on function public.complete_planning_generation(uuid,jsonb) from public,anon;
grant execute on function public.complete_planning_generation(uuid,jsonb) to authenticated;
