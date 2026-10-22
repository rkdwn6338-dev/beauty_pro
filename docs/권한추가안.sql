-- 검토용이며 아직 실행하지 않았습니다.
-- 기존 정책을 삭제하거나 교체하지 않습니다.
-- 업로더 또는 해당 회사 관리자만 자료를 삭제하도록 범위를 제한합니다.
-- 별도 승인 후 적용하고 실계정 테스트를 통과한 뒤 ENABLE_SOURCE_DELETE를 활성화합니다.
begin;
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
      and public.can_access_project(f.project_id)
      and (
        f.uploaded_by=(select auth.uid())
        or exists (
          select 1 from public.agency_members m
          where m.agency_id=p.agency_id
            and m.user_id=(select auth.uid()) and m.role in ('owner','admin')
        )
      )
  )
);
commit;
