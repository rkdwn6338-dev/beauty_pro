-- 2026-10-23 사용자 승인 후 적용 완료. 자동 실행하거나 중복 적용하지 않습니다.
-- 기존 UPDATE 정책은 유지하되, 파일의 권한 판단에 쓰는 식별 정보는 변경하지 못하게 합니다.
-- 기존 자료를 수정·삭제하지 않습니다. 업로드 상태 변경은 계속 허용합니다.
begin;
create function public.phase_a_guard_source_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.project_id is distinct from old.project_id
     or new.storage_path is distinct from old.storage_path
     or new.uploaded_by is distinct from old.uploaded_by then
    raise exception '파일의 프로젝트·업로더·저장 경로는 변경할 수 없습니다.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger phase_a_source_identity_immutable
before update on public.source_files
for each row execute function public.phase_a_guard_source_identity();

create policy phase_a_source_files_delete on public.source_files
for delete to authenticated
using (
  public.can_access_project(project_id)
  and (
    uploaded_by=(select auth.uid())
    or exists (
      select 1 from public.projects p
      join public.agency_members m on m.agency_id=p.agency_id
      where p.id=source_files.project_id
        and m.user_id=(select auth.uid()) and m.role in ('owner','admin')
    )
  )
);
create policy phase_a_storage_source_delete on storage.objects
for delete to authenticated
using (
  bucket_id='source-documents'
  and exists (
    select 1 from public.source_files f
    join public.projects p on p.id=f.project_id
    where f.storage_path=storage.objects.name
      and split_part(storage.objects.name,'/',1)=f.project_id::text
      and public.can_access_project(f.project_id)
      and (
        storage.objects.owner_id=(select auth.uid())::text
        or exists (
          select 1 from public.agency_members m
          where m.agency_id=p.agency_id
            and m.user_id=(select auth.uid()) and m.role in ('owner','admin')
        )
      )
  )
);
commit;
