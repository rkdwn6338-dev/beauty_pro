-- 2026-10-23 사용자 승인 후 적용 완료. 자동 실행하거나 중복 적용하지 않습니다.
-- 기존 자료를 수정·삭제하지 않습니다.
-- 기존 정책은 유지하고 분석 작업·검토 대기 근거의 저장 권한을 추가합니다.
-- 실행 전 같은 원본에 queued/running 작업이 중복되지 않는지 확인해야 합니다.
begin;
create policy phase_b_jobs_insert on public.analysis_jobs for insert to authenticated
with check (status='running' and result is null and exists (
  select 1 from public.source_files f where f.id=analysis_jobs.source_file_id and public.can_access_project(f.project_id)
));
create policy phase_b_jobs_update on public.analysis_jobs for update to authenticated
using (exists(select 1 from public.source_files f where f.id=analysis_jobs.source_file_id and public.can_access_project(f.project_id)))
with check (exists(select 1 from public.source_files f where f.id=analysis_jobs.source_file_id and public.can_access_project(f.project_id)));
create policy phase_b_evidence_insert on public.evidence for insert to authenticated
with check (review_status='pending' and reviewed_by is null and exists (
  select 1 from public.source_files f where f.id=evidence.source_file_id and public.can_access_project(f.project_id)
));
create unique index phase_b_one_active_analysis_per_source on public.analysis_jobs(source_file_id)
where status in ('queued','running');

create function public.phase_b_guard_job_identity() returns trigger language plpgsql set search_path='' as $$
begin
  if new.id is distinct from old.id or new.source_file_id is distinct from old.source_file_id
     or new.created_at is distinct from old.created_at then
    raise exception '분석 작업의 식별 정보는 변경할 수 없습니다.' using errcode='42501';
  end if;
  return new;
end; $$;
create trigger phase_b_job_identity_immutable before update on public.analysis_jobs
for each row execute function public.phase_b_guard_job_identity();

create function public.phase_b_guard_evidence_review() returns trigger language plpgsql set search_path='' as $$
begin
  if new.id is distinct from old.id or new.source_file_id is distinct from old.source_file_id then
    raise exception '근거의 원본 연결은 변경할 수 없습니다.' using errcode='42501';
  end if;
  if old.review_status<>'pending' and new is distinct from old then
    raise exception '이미 검토한 근거는 덮어쓸 수 없습니다.' using errcode='42501';
  end if;
  if new.review_status<>'pending' and new.reviewed_by is distinct from (select auth.uid()) then
    raise exception '실제 검토자만 검토 결과를 기록할 수 있습니다.' using errcode='42501';
  end if;
  return new;
end; $$;
create trigger phase_b_evidence_review_guard before update on public.evidence
for each row execute function public.phase_b_guard_evidence_review();
commit;
