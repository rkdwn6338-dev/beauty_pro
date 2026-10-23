-- 승인한 AI 요청 보호 권한을 실제 Supabase에서 검증합니다. 모든 임시 자료는 롤백합니다.
begin;
insert into auth.users(id,email) values
('95400000-0000-4000-8000-000000000001','phase-c-a@example.invalid'),
('95400000-0000-4000-8000-000000000002','phase-c-peer@example.invalid'),
('95400000-0000-4000-8000-000000000003','phase-c-b@example.invalid');
insert into public.agencies(id,name) values
('96400000-0000-4000-8000-000000000001','임시 기획 검사 회사 A'),
('96400000-0000-4000-8000-000000000002','임시 기획 검사 회사 B');
insert into public.agency_members(agency_id,user_id,role) values
('96400000-0000-4000-8000-000000000001','95400000-0000-4000-8000-000000000001','member'),
('96400000-0000-4000-8000-000000000001','95400000-0000-4000-8000-000000000002','member'),
('96400000-0000-4000-8000-000000000002','95400000-0000-4000-8000-000000000003','owner');
insert into public.projects(id,agency_id,brand,title,created_by) values
('97400000-0000-4000-8000-000000000001','96400000-0000-4000-8000-000000000001','검증','임시 기획 A','95400000-0000-4000-8000-000000000001'),
('97400000-0000-4000-8000-000000000002','96400000-0000-4000-8000-000000000002','타사','임시 기획 B','95400000-0000-4000-8000-000000000003');
insert into public.products(id,project_id,name,category,subtype,ingredients) values
('98400000-0000-4000-8000-000000000001','97400000-0000-4000-8000-000000000001','검증 제품','페이스 클렌징','폼','정제수, 글리세린');
insert into public.source_files(id,project_id,product_id,uploaded_by,filename,storage_path) values
('99400000-0000-4000-8000-000000000001','97400000-0000-4000-8000-000000000001','98400000-0000-4000-8000-000000000001','95400000-0000-4000-8000-000000000001','임시_가상근거.pdf','97400000-0000-4000-8000-000000000001/temporary.pdf');
select set_config('test.planning_doc',$snapshot${"coreUsp":"체험용 초안: 매일의 세정을 편안한 경험으로","strategy":"성분·거품·사용 경험을 연결하는 예시 전략입니다. 실제 제품 기획이 아닙니다.","ingredientInsights":[{"ingredient":"글리세린","role":"일반적인 보습제 역할을 검토합니다.","limitation":"원료적 역할이며 완제품 보습 효능을 입증하지 않습니다."}],"sections":[{"type":"hero","headline":"하루의 끝, 나를 위한 세정 시간","body":"체험용 카피 예시입니다.","visualGuide":"제품과 물의 절제된 연출","evidenceIds":[],"id":"962eaac2-de76-4da0-9b7d-39148620a9cb","status":"draft","approvedBy":null,"approvedAt":null},{"type":"foam","headline":"거품으로 전하는 사용 경험","body":"실제 제품의 거품 특성과 사용 사진을 확인한 뒤 카피를 정합니다.","visualGuide":"실제 거품 밀도와 세안 장면 촬영 필요","evidenceIds":[],"id":"5616ab7e-7302-4289-bc83-d7ee77be2e03","status":"draft","approvedBy":null,"approvedAt":null},{"type":"clinical","headline":"근거를 확인하는 시간","body":"가상 예시의 세정 지표 12.5% 변화. 실제 제품에 사용할 수 없습니다.","visualGuide":"체험용이라는 문구와 원본 페이지 연결","evidenceIds":["99400000-0000-4000-8000-000000000002"],"id":"b2d90dee-fe53-4508-8cff-4180eff8a3f0","status":"draft","approvedBy":null,"approvedAt":null},{"type":"recommendation","headline":"이런 분들께 제안합니다","body":"제품에 맞는 타깃을 확인한 뒤 작성합니다.","visualGuide":"타깃의 사용 장면","evidenceIds":[],"id":"a356dd5f-9e4a-4f6a-9907-7c22146f6dc6","status":"draft","approvedBy":null,"approvedAt":null},{"type":"closing","headline":"매일의 루틴을 위한 한 걸음","body":"체험용 마무리 카피입니다.","visualGuide":"한 가지 메시지로 정리","evidenceIds":[],"id":"d9d0c04f-822b-4517-929b-d2407e046ebe","status":"draft","approvedBy":null,"approvedAt":null},{"type":"how_to_use","headline":"사용방법","body":"실제 제품 라벨의 사용방법을 확인해 작성합니다.","visualGuide":"확인된 사용 순서 촬영","evidenceIds":[],"id":"f7430b08-2bdf-4344-adc1-dd9b1653cde7","status":"draft","approvedBy":null,"approvedAt":null},{"type":"product_visual","headline":"제품의 마지막 인상","body":"","visualGuide":"실제 제품 단독 연출","evidenceIds":[],"id":"b589e6cc-6f7f-4c86-ae20-81a17a115458","status":"draft","approvedBy":null,"approvedAt":null}],"cautions":["모든 내용은 화면 체험용 예시입니다. 실제 시험·AI 분석·완성된 기획 결과가 아닙니다."],"schemaVersion":1,"basis":{"productId":"98400000-0000-4000-8000-000000000001","brand":"검증","name":"검증 제품","category":"페이스 클렌징","subtype":"폼","ingredients":"정제수, 글리세린"},"sources":[{"id":"99400000-0000-4000-8000-000000000002","sourceFileId":"99400000-0000-4000-8000-000000000001","filename":"임시_가상근거.pdf","type":"clinical","excerpt":"[체험용 가상 문구] 대상자 20명, 2주 사용 후 세정 지표 12.5% 변화. 실제 제품의 시험 결과가 아닙니다.","claim":"체험용 예시: 세정 지표 12.5% 변화","page":3}]}$snapshot$,true);
insert into public.evidence(id,source_file_id,evidence_type,source_excerpt,suggested_claim,page_number) select
'99400000-0000-4000-8000-000000000002','99400000-0000-4000-8000-000000000001','clinical',
current_setting('test.planning_doc')::jsonb->'sources'->0->>'excerpt',current_setting('test.planning_doc')::jsonb->'sources'->0->>'claim',3;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"95400000-0000-4000-8000-000000000001","role":"authenticated"}',true);
update public.evidence set review_status='approved',reviewed_by='95400000-0000-4000-8000-000000000001' where id='99400000-0000-4000-8000-000000000002';
do $test$
declare
  doc jsonb := current_setting('test.planning_doc')::jsonb;
  changed jsonb;
  rid uuid; other_id uuid; v1 uuid; v2 uuid; again uuid;
  p constant uuid := '97400000-0000-4000-8000-000000000001';
  product constant uuid := '98400000-0000-4000-8000-000000000001';
  agency constant uuid := '96400000-0000-4000-8000-000000000001';
  me constant uuid := '95400000-0000-4000-8000-000000000001';
  r jsonb := '{}';
  n integer;
begin
  rid:=gen_random_uuid();
  insert into public.planning_generation_requests(id,agency_id,project_id,product_id,requested_by,operation,input_hash,model,created_at,expires_at)
    values(rid,agency,p,product,me,'generate',repeat('a',64),'test/mock-model','2000-01-01','2100-01-01');
  r:=r||jsonb_build_object('own_reservation_visible',exists(select 1 from public.planning_generation_requests where id=rid),
    'server_sets_clock',(select created_at>'2026-01-01' and expires_at-created_at=interval '15 minutes' from public.planning_generation_requests where id=rid));
  begin
    insert into public.planning_generation_requests(id,agency_id,project_id,product_id,requested_by,operation,input_hash,model)
      values(gen_random_uuid(),agency,p,product,me,'generate',repeat('a',64),'test/mock-model');
    r:=r||'{"one_active_request":false}';
  exception when unique_violation then r:=r||'{"one_active_request":true}'; end;
  begin
    update public.planning_generation_requests set status='expired' where id=rid;
    r:=r||'{"early_expiry_blocked":false}';
  exception when insufficient_privilege then r:=r||'{"early_expiry_blocked":true}'; end;
  begin
    update public.planning_generation_requests set input_hash=repeat('b',64) where id=rid;
    r:=r||'{"identity_immutable":false}';
  exception when insufficient_privilege then r:=r||'{"identity_immutable":true}'; end;
  perform set_config('request.jwt.claims','{"sub":"95400000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  r:=r||jsonb_build_object('company_peer_can_read',exists(select 1 from public.planning_generation_requests where id=rid));
  begin
    update public.planning_generation_requests set status='failed' where id=rid;
    r:=r||'{"peer_cannot_finish":false}';
  exception when insufficient_privilege then r:=r||'{"peer_cannot_finish":true}'; end;
  begin
    perform public.complete_planning_generation(rid,doc);
    r:=r||'{"peer_cannot_complete":false}';
  exception when insufficient_privilege then r:=r||'{"peer_cannot_complete":true}'; end;
  perform set_config('request.jwt.claims','{"sub":"95400000-0000-4000-8000-000000000003","role":"authenticated"}',true);
  r:=r||jsonb_build_object('other_company_hidden',not exists(select 1 from public.planning_generation_requests where id=rid));
  begin
    insert into public.planning_generation_requests(id,agency_id,project_id,product_id,requested_by,operation,input_hash,model)
      values(gen_random_uuid(),agency,p,product,'95400000-0000-4000-8000-000000000003','generate',repeat('a',64),'test/mock-model');
    r:=r||'{"other_company_insert_blocked":false}';
  exception when insufficient_privilege then r:=r||'{"other_company_insert_blocked":true}'; end;
  perform set_config('request.jwt.claims','{"sub":"95400000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  update public.planning_generation_requests set status='failed' where id=rid;
  begin
    update public.planning_generation_requests set status='running' where id=rid;
    r:=r||'{"terminal_immutable":false}';
  exception when insufficient_privilege then r:=r||'{"terminal_immutable":true}'; end;
  begin
    delete from public.planning_generation_requests where id=rid;
    r:=r||'{"delete_blocked":false}';
  exception when insufficient_privilege then r:=r||'{"delete_blocked":true}'; end;
  begin
    insert into public.planning_generation_requests(id,agency_id,project_id,product_id,requested_by,operation,input_hash,model)
      values(gen_random_uuid(),agency,p,product,'95400000-0000-4000-8000-000000000002','generate',repeat('a',64),'test/mock-model');
    r:=r||'{"requester_spoof_blocked":false}';
  exception when insufficient_privilege then r:=r||'{"requester_spoof_blocked":true}'; end;
  rid:=gen_random_uuid();
  insert into public.planning_generation_requests(id,agency_id,project_id,product_id,requested_by,operation,input_hash,model)
    values(rid,agency,p,product,me,'generate',repeat('a',64),'test/mock-model');
  select id into v1 from public.complete_planning_generation(rid,doc);
  select id into again from public.complete_planning_generation(rid,doc);
  r:=r||jsonb_build_object('atomic_complete_and_replay',v1=again and (select count(*)=1 from public.planning_versions where product_id=product)
    and (select status='completed' and result_version_id=v1 and finished_at is not null from public.planning_generation_requests where id=rid));
  other_id:=gen_random_uuid();
  insert into public.planning_generation_requests(id,agency_id,project_id,product_id,requested_by,operation,base_version_id,input_hash,model)
    values(other_id,agency,p,product,me,'generate',v1,repeat('a',64),'test/mock-model');
  changed:=jsonb_set(doc,'{coreUsp}','"동시 수정"');
  insert into public.planning_versions(project_id,product_id,revision,parent_id,action,snapshot,created_by)
    values(p,product,2,v1,'edit',changed,me) returning id into v2;
  begin
    perform public.complete_planning_generation(other_id,doc);
    r:=r||'{"stale_completion_blocked":false}';
  exception when serialization_failure or unique_violation then r:=r||'{"stale_completion_blocked":true}'; end;
  r:=r||jsonb_build_object('failed_transaction_leaves_running',(select status='running' and result_version_id is null from public.planning_generation_requests where id=other_id)
    and (select count(*)=2 from public.planning_versions where product_id=product));
  update public.planning_generation_requests set status='failed' where id=other_id;
  begin
    insert into public.planning_generation_requests(id,agency_id,project_id,product_id,requested_by,operation,base_version_id,input_hash,model)
      values(gen_random_uuid(),agency,p,product,me,'generate',v1,repeat('a',64),'test/mock-model');
    r:=r||'{"stale_reservation_blocked":false}';
  exception when serialization_failure then r:=r||'{"stale_reservation_blocked":true}'; end;
  select count(*) into n from public.planning_generation_requests where agency_id=agency;
  for i in n+1..20 loop
    rid:=gen_random_uuid();
    insert into public.planning_generation_requests(id,agency_id,project_id,product_id,requested_by,operation,base_version_id,input_hash,model)
      values(rid,agency,p,product,me,'generate',v2,repeat('a',64),'test/mock-model');
    update public.planning_generation_requests set status='failed' where id=rid;
  end loop;
  begin
    insert into public.planning_generation_requests(id,agency_id,project_id,product_id,requested_by,operation,base_version_id,input_hash,model)
      values(gen_random_uuid(),agency,p,product,me,'generate',v2,repeat('a',64),'test/mock-model');
    r:=r||'{"daily_twenty_includes_failures":false}';
  exception when raise_exception then r:=r||jsonb_build_object('daily_twenty_includes_failures',SQLERRM='Daily generation request limit reached'); end;
  perform set_config('test.generation_result',r::text,true);
end;
$test$;
set local role anon;
do $test$
declare r jsonb := current_setting('test.generation_result')::jsonb;
begin
  begin perform count(*) from public.planning_generation_requests;
    r:=r||'{"anonymous_read_blocked":false}';
  exception when insufficient_privilege then r:=r||'{"anonymous_read_blocked":true}'; end;
  begin perform public.complete_planning_generation(gen_random_uuid(),'{}');
    r:=r||'{"anonymous_rpc_blocked":false}';
  exception when insufficient_privilege then r:=r||'{"anonymous_rpc_blocked":true}'; end;
  perform set_config('test.generation_result',r::text,true);
end;
$test$;
reset role;
select current_setting('test.generation_result')::jsonb as generation_checks;
rollback;
