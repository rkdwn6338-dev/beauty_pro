-- 임시 자료와 삭제·수정 결과를 모두 롤백합니다. 기존 자료는 수정하지 않습니다.
begin;
insert into auth.users(id,email) values
('95100000-0000-4000-8000-000000000001','delete-owner@example.invalid'),
('95100000-0000-4000-8000-000000000002','delete-uploader@example.invalid'),
('95100000-0000-4000-8000-000000000003','delete-peer@example.invalid'),
('95100000-0000-4000-8000-000000000004','delete-outsider@example.invalid');
insert into public.agencies(id,name) values
('96100000-0000-4000-8000-000000000001','임시 삭제 검사 회사 A'),
('96100000-0000-4000-8000-000000000002','임시 삭제 검사 회사 B');
insert into public.agency_members(agency_id,user_id,role) values
('96100000-0000-4000-8000-000000000001','95100000-0000-4000-8000-000000000001','owner'),
('96100000-0000-4000-8000-000000000001','95100000-0000-4000-8000-000000000002','member'),
('96100000-0000-4000-8000-000000000001','95100000-0000-4000-8000-000000000003','member'),
('96100000-0000-4000-8000-000000000002','95100000-0000-4000-8000-000000000004','owner');
insert into public.projects(id,agency_id,brand,title,created_by) values
('97100000-0000-4000-8000-000000000001','96100000-0000-4000-8000-000000000001','검사','임시 삭제 검사','95100000-0000-4000-8000-000000000001');
insert into public.source_files(id,project_id,uploaded_by,filename,storage_path,mime_type,bytes)
select ('99100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
'97100000-0000-4000-8000-000000000001'::uuid,
'95100000-0000-4000-8000-000000000002'::uuid,
'검사.pdf','97100000-0000-4000-8000-000000000001/'||n||'.pdf','application/pdf',8
from generate_series(1,4) n;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"95100000-0000-4000-8000-000000000002","role":"authenticated"}',true);
with removed as (delete from public.source_files where id='99100000-0000-4000-8000-000000000001' returning id)
select set_config('test.delete_result',jsonb_build_object('uploader_allowed',(select count(*)=1 from removed))::text,true);
select set_config('request.jwt.claims','{"sub":"95100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
with removed as (delete from public.source_files where id='99100000-0000-4000-8000-000000000002' returning id)
select set_config('test.delete_result',(current_setting('test.delete_result')::jsonb||jsonb_build_object('owner_allowed',(select count(*)=1 from removed)))::text,true);
select set_config('request.jwt.claims','{"sub":"95100000-0000-4000-8000-000000000003","role":"authenticated"}',true);
with removed as (delete from public.source_files where id='99100000-0000-4000-8000-000000000003' returning id)
select set_config('test.delete_result',(current_setting('test.delete_result')::jsonb||jsonb_build_object('peer_direct_delete_blocked',(select count(*)=0 from removed)))::text,true);
select set_config('request.jwt.claims','{"sub":"95100000-0000-4000-8000-000000000004","role":"authenticated"}',true);
with removed as (delete from public.source_files where id='99100000-0000-4000-8000-000000000004' returning id)
select set_config('test.delete_result',(current_setting('test.delete_result')::jsonb||jsonb_build_object('other_company_blocked',(select count(*)=0 from removed)))::text,true);
-- 기존 UPDATE 정책이 업로더 변경을 허용하는지 확인합니다. 변경은 롤백됩니다.
select set_config('request.jwt.claims','{"sub":"95100000-0000-4000-8000-000000000003","role":"authenticated"}',true);
with changed as (update public.source_files set uploaded_by='95100000-0000-4000-8000-000000000003' where id='99100000-0000-4000-8000-000000000003' returning id)
select set_config('test.delete_result',(current_setting('test.delete_result')::jsonb||jsonb_build_object('existing_policy_allows_uploader_reassignment',(select count(*)=1 from changed)))::text,true);
reset role;
select current_setting('test.delete_result')::jsonb as deletion_checks;
rollback;
