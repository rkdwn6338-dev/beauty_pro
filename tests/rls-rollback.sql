-- 이 테스트는 임시 자료를 만든 뒤 전부 롤백합니다. 기존 자료는 수정하지 않습니다.
begin;
insert into auth.users(id,email) values
('95000000-0000-4000-8000-000000000001','phase-a-rls-a@example.invalid'),
('95000000-0000-4000-8000-000000000002','phase-a-rls-b@example.invalid');
insert into public.agencies(id,name) values
('96000000-0000-4000-8000-000000000001','임시 격리 검사 회사 A'),
('96000000-0000-4000-8000-000000000002','임시 격리 검사 회사 B');
insert into public.agency_members(agency_id,user_id,role) values
('96000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','owner'),
('96000000-0000-4000-8000-000000000002','95000000-0000-4000-8000-000000000002','owner');
insert into public.projects(id,agency_id,brand,title,created_by) values
('97000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001','검사 A','임시 프로젝트 A','95000000-0000-4000-8000-000000000001'),
('97000000-0000-4000-8000-000000000002','96000000-0000-4000-8000-000000000002','검사 B','임시 프로젝트 B','95000000-0000-4000-8000-000000000002');
insert into public.products(id,project_id,name,ingredients) values
('98000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000001','임시 제품 A','정제수'),
('98000000-0000-4000-8000-000000000002','97000000-0000-4000-8000-000000000002','임시 제품 B','정제수');
insert into public.source_files(id,project_id,uploaded_by,filename,storage_path,mime_type,bytes) values
('99000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','검사 A.pdf','97000000-0000-4000-8000-000000000001/test.pdf','application/pdf',8),
('99000000-0000-4000-8000-000000000002','97000000-0000-4000-8000-000000000002','95000000-0000-4000-8000-000000000002','검사 B.pdf','97000000-0000-4000-8000-000000000002/test.pdf','application/pdf',8);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"95000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('test.phase_a_result',jsonb_build_object(
  'a_own_project',exists(select 1 from public.projects where id='97000000-0000-4000-8000-000000000001'),
  'a_other_project_blocked',not exists(select 1 from public.projects where id='97000000-0000-4000-8000-000000000002'),
  'a_other_product_blocked',not exists(select 1 from public.products where id='98000000-0000-4000-8000-000000000002'),
  'a_other_file_blocked',not exists(select 1 from public.source_files where id='99000000-0000-4000-8000-000000000002')
)::text,true);
select set_config('request.jwt.claims','{"sub":"95000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select set_config('test.phase_a_result',(current_setting('test.phase_a_result')::jsonb||jsonb_build_object(
  'b_own_project',exists(select 1 from public.projects where id='97000000-0000-4000-8000-000000000002'),
  'b_other_project_blocked',not exists(select 1 from public.projects where id='97000000-0000-4000-8000-000000000001'),
  'b_other_product_blocked',not exists(select 1 from public.products where id='98000000-0000-4000-8000-000000000001'),
  'b_other_file_blocked',not exists(select 1 from public.source_files where id='99000000-0000-4000-8000-000000000001')
))::text,true);
reset role;
select current_setting('test.phase_a_result')::jsonb as isolation_checks;
rollback;
