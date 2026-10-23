-- 승인된 Phase B 권한을 실제 DB에서 검사하고 임시 자료를 모두 롤백합니다.
begin;
insert into auth.users(id,email) values
('95200000-0000-4000-8000-000000000001','phase-b-a@example.invalid'),
('95200000-0000-4000-8000-000000000002','phase-b-peer@example.invalid'),
('95200000-0000-4000-8000-000000000003','phase-b-b@example.invalid');
insert into public.agencies(id,name) values
('96200000-0000-4000-8000-000000000001','임시 분석 검사 회사 A'),
('96200000-0000-4000-8000-000000000002','임시 분석 검사 회사 B');
insert into public.agency_members(agency_id,user_id,role) values
('96200000-0000-4000-8000-000000000001','95200000-0000-4000-8000-000000000001','member'),
('96200000-0000-4000-8000-000000000001','95200000-0000-4000-8000-000000000002','member'),
('96200000-0000-4000-8000-000000000002','95200000-0000-4000-8000-000000000003','owner');
insert into public.projects(id,agency_id,brand,title,created_by) values
('97200000-0000-4000-8000-000000000001','96200000-0000-4000-8000-000000000001','검사','임시 분석 A','95200000-0000-4000-8000-000000000001'),
('97200000-0000-4000-8000-000000000002','96200000-0000-4000-8000-000000000002','검사','임시 분석 B','95200000-0000-4000-8000-000000000003');
insert into public.source_files(id,project_id,uploaded_by,filename,storage_path) values
('99200000-0000-4000-8000-000000000001','97200000-0000-4000-8000-000000000001','95200000-0000-4000-8000-000000000001','검사.pdf','97200000-0000-4000-8000-000000000001/test.pdf'),
('99200000-0000-4000-8000-000000000002','97200000-0000-4000-8000-000000000002','95200000-0000-4000-8000-000000000003','검사.pdf','97200000-0000-4000-8000-000000000002/test.pdf');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"95200000-0000-4000-8000-000000000001","role":"authenticated"}',true);
with added as (insert into public.analysis_jobs(id,source_file_id,status) values ('98200000-0000-4000-8000-000000000001','99200000-0000-4000-8000-000000000001','running') returning id)
select set_config('test.analysis_result',jsonb_build_object('own_job_insert',(select count(*)=1 from added))::text,true);
do $$
begin
  begin
    insert into public.analysis_jobs(source_file_id,status) values ('99200000-0000-4000-8000-000000000001','running');
    perform set_config('test.duplicate_blocked','false',true);
  exception when unique_violation then perform set_config('test.duplicate_blocked','true',true);
  end;
  begin
    insert into public.analysis_jobs(source_file_id,status) values ('99200000-0000-4000-8000-000000000002','running');
    perform set_config('test.other_job_insert_blocked','false',true);
  exception when insufficient_privilege then perform set_config('test.other_job_insert_blocked','true',true);
  end;
  begin
    update public.analysis_jobs set source_file_id='99200000-0000-4000-8000-000000000002' where id='98200000-0000-4000-8000-000000000001';
    perform set_config('test.job_relink_blocked','false',true);
  exception when insufficient_privilege then perform set_config('test.job_relink_blocked','true',true);
  end;
end; $$;
with changed as (update public.analysis_jobs set status='completed',result='{}' where id='98200000-0000-4000-8000-000000000001' returning id)
select set_config('test.analysis_result',(current_setting('test.analysis_result')::jsonb||jsonb_build_object('own_job_complete',(select count(*)=1 from changed)))::text,true);
insert into public.evidence(id,source_file_id,evidence_type,source_excerpt,page_number) values
('98200000-0000-4000-8000-000000000002','99200000-0000-4000-8000-000000000001','clinical','임시 원문',1);
do $$
begin
  begin
    insert into public.evidence(source_file_id,evidence_type,source_excerpt,review_status,reviewed_by) values
    ('99200000-0000-4000-8000-000000000001','clinical','임시 원문','approved','95200000-0000-4000-8000-000000000001');
    perform set_config('test.auto_approval_blocked','false',true);
  exception when insufficient_privilege then perform set_config('test.auto_approval_blocked','true',true);
  end;
  begin
    update public.evidence set review_status='approved',reviewed_by='95200000-0000-4000-8000-000000000002' where id='98200000-0000-4000-8000-000000000002';
    perform set_config('test.reviewer_spoof_blocked','false',true);
  exception when insufficient_privilege then perform set_config('test.reviewer_spoof_blocked','true',true);
  end;
end; $$;
with changed as (update public.evidence set review_status='approved',reviewed_by='95200000-0000-4000-8000-000000000001' where id='98200000-0000-4000-8000-000000000002' returning id)
select set_config('test.analysis_result',(current_setting('test.analysis_result')::jsonb||jsonb_build_object('own_review_approval',(select count(*)=1 from changed)))::text,true);
do $$
begin
  begin
    update public.evidence set source_excerpt='덮어쓰기' where id='98200000-0000-4000-8000-000000000002';
    perform set_config('test.approved_overwrite_blocked','false',true);
  exception when insufficient_privilege then perform set_config('test.approved_overwrite_blocked','true',true);
  end;
  begin
    update public.evidence set source_file_id='99200000-0000-4000-8000-000000000002' where id='98200000-0000-4000-8000-000000000002';
    perform set_config('test.evidence_relink_blocked','false',true);
  exception when insufficient_privilege then perform set_config('test.evidence_relink_blocked','true',true);
  end;
end; $$;
select set_config('request.jwt.claims','{"sub":"95200000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select set_config('test.analysis_result',(current_setting('test.analysis_result')::jsonb||jsonb_build_object(
  'other_jobs_hidden',not exists(select 1 from public.analysis_jobs where id='98200000-0000-4000-8000-000000000001'),
  'other_evidence_hidden',not exists(select 1 from public.evidence where id='98200000-0000-4000-8000-000000000002')
))::text,true);
with changed as (update public.analysis_jobs set status='failed' where id='98200000-0000-4000-8000-000000000001' returning id)
select set_config('test.analysis_result',(current_setting('test.analysis_result')::jsonb||jsonb_build_object('other_job_update_blocked',(select count(*)=0 from changed)))::text,true);
reset role;
select current_setting('test.analysis_result')::jsonb||jsonb_build_object(
  'duplicate_active_job_blocked',current_setting('test.duplicate_blocked')::boolean,
  'other_job_insert_blocked',current_setting('test.other_job_insert_blocked')::boolean,
  'job_relink_blocked',current_setting('test.job_relink_blocked')::boolean,
  'auto_approval_blocked',current_setting('test.auto_approval_blocked')::boolean,
  'reviewer_spoof_blocked',current_setting('test.reviewer_spoof_blocked')::boolean,
  'approved_overwrite_blocked',current_setting('test.approved_overwrite_blocked')::boolean,
  'evidence_relink_blocked',current_setting('test.evidence_relink_blocked')::boolean
) as analysis_checks;
rollback;
