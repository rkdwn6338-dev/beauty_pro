-- 승인한 Phase C 저장 권한을 실제 Supabase에서 검증합니다. 모든 임시 자료는 롤백합니다.
begin;
insert into auth.users(id,email) values
('95300000-0000-4000-8000-000000000001','phase-c-a@example.invalid'),
('95300000-0000-4000-8000-000000000002','phase-c-peer@example.invalid'),
('95300000-0000-4000-8000-000000000003','phase-c-b@example.invalid');
insert into public.agencies(id,name) values
('96300000-0000-4000-8000-000000000001','임시 기획 검사 회사 A'),
('96300000-0000-4000-8000-000000000002','임시 기획 검사 회사 B');
insert into public.agency_members(agency_id,user_id,role) values
('96300000-0000-4000-8000-000000000001','95300000-0000-4000-8000-000000000001','member'),
('96300000-0000-4000-8000-000000000001','95300000-0000-4000-8000-000000000002','member'),
('96300000-0000-4000-8000-000000000002','95300000-0000-4000-8000-000000000003','owner');
insert into public.projects(id,agency_id,brand,title,created_by) values
('97300000-0000-4000-8000-000000000001','96300000-0000-4000-8000-000000000001','검증','임시 기획 A','95300000-0000-4000-8000-000000000001'),
('97300000-0000-4000-8000-000000000002','96300000-0000-4000-8000-000000000002','타사','임시 기획 B','95300000-0000-4000-8000-000000000003');
insert into public.products(id,project_id,name,category,subtype,ingredients) values
('98300000-0000-4000-8000-000000000001','97300000-0000-4000-8000-000000000001','검증 제품','페이스 클렌징','폼','정제수, 글리세린');
insert into public.source_files(id,project_id,product_id,uploaded_by,filename,storage_path) values
('99300000-0000-4000-8000-000000000001','97300000-0000-4000-8000-000000000001','98300000-0000-4000-8000-000000000001','95300000-0000-4000-8000-000000000001','임시_가상근거.pdf','97300000-0000-4000-8000-000000000001/temporary.pdf');
select set_config('test.planning_doc',$snapshot${"coreUsp":"체험용 초안: 매일의 세정을 편안한 경험으로","strategy":"성분·거품·사용 경험을 연결하는 예시 전략입니다. 실제 제품 기획이 아닙니다.","ingredientInsights":[{"ingredient":"글리세린","role":"일반적인 보습제 역할을 검토합니다.","limitation":"원료적 역할이며 완제품 보습 효능을 입증하지 않습니다."}],"sections":[{"type":"hero","headline":"하루의 끝, 나를 위한 세정 시간","body":"체험용 카피 예시입니다.","visualGuide":"제품과 물의 절제된 연출","evidenceIds":[],"id":"962eaac2-de76-4da0-9b7d-39148620a9cb","status":"draft","approvedBy":null,"approvedAt":null},{"type":"foam","headline":"거품으로 전하는 사용 경험","body":"실제 제품의 거품 특성과 사용 사진을 확인한 뒤 카피를 정합니다.","visualGuide":"실제 거품 밀도와 세안 장면 촬영 필요","evidenceIds":[],"id":"5616ab7e-7302-4289-bc83-d7ee77be2e03","status":"draft","approvedBy":null,"approvedAt":null},{"type":"clinical","headline":"근거를 확인하는 시간","body":"가상 예시의 세정 지표 12.5% 변화. 실제 제품에 사용할 수 없습니다.","visualGuide":"체험용이라는 문구와 원본 페이지 연결","evidenceIds":["99300000-0000-4000-8000-000000000002"],"id":"b2d90dee-fe53-4508-8cff-4180eff8a3f0","status":"draft","approvedBy":null,"approvedAt":null},{"type":"recommendation","headline":"이런 분들께 제안합니다","body":"제품에 맞는 타깃을 확인한 뒤 작성합니다.","visualGuide":"타깃의 사용 장면","evidenceIds":[],"id":"a356dd5f-9e4a-4f6a-9907-7c22146f6dc6","status":"draft","approvedBy":null,"approvedAt":null},{"type":"closing","headline":"매일의 루틴을 위한 한 걸음","body":"체험용 마무리 카피입니다.","visualGuide":"한 가지 메시지로 정리","evidenceIds":[],"id":"d9d0c04f-822b-4517-929b-d2407e046ebe","status":"draft","approvedBy":null,"approvedAt":null},{"type":"how_to_use","headline":"사용방법","body":"실제 제품 라벨의 사용방법을 확인해 작성합니다.","visualGuide":"확인된 사용 순서 촬영","evidenceIds":[],"id":"f7430b08-2bdf-4344-adc1-dd9b1653cde7","status":"draft","approvedBy":null,"approvedAt":null},{"type":"product_visual","headline":"제품의 마지막 인상","body":"","visualGuide":"실제 제품 단독 연출","evidenceIds":[],"id":"b589e6cc-6f7f-4c86-ae20-81a17a115458","status":"draft","approvedBy":null,"approvedAt":null}],"cautions":["모든 내용은 화면 체험용 예시입니다. 실제 시험·AI 분석·완성된 기획 결과가 아닙니다."],"schemaVersion":1,"basis":{"productId":"98300000-0000-4000-8000-000000000001","brand":"검증","name":"검증 제품","category":"페이스 클렌징","subtype":"폼","ingredients":"정제수, 글리세린"},"sources":[{"id":"99300000-0000-4000-8000-000000000002","sourceFileId":"99300000-0000-4000-8000-000000000001","filename":"임시_가상근거.pdf","type":"clinical","excerpt":"[체험용 가상 문구] 대상자 20명, 2주 사용 후 세정 지표 12.5% 변화. 실제 제품의 시험 결과가 아닙니다.","claim":"체험용 예시: 세정 지표 12.5% 변화","page":3}]}$snapshot$,true);
insert into public.evidence(id,source_file_id,evidence_type,source_excerpt,suggested_claim,page_number) select
'99300000-0000-4000-8000-000000000002','99300000-0000-4000-8000-000000000001','clinical',
current_setting('test.planning_doc')::jsonb->'sources'->0->>'excerpt',current_setting('test.planning_doc')::jsonb->'sources'->0->>'claim',3;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"95300000-0000-4000-8000-000000000001","role":"authenticated"}',true);
update public.evidence set review_status='approved',reviewed_by='95300000-0000-4000-8000-000000000001' where id='99300000-0000-4000-8000-000000000002';
do $test$
declare
  doc jsonb := current_setting('test.planning_doc')::jsonb;
  changed jsonb;
  approved jsonb;
  v1 uuid; v2 uuid; v3 uuid; v4 uuid; v5 uuid; v6 uuid; v7 uuid;
  p constant uuid := '97300000-0000-4000-8000-000000000001';
  product constant uuid := '98300000-0000-4000-8000-000000000001';
  me constant uuid := '95300000-0000-4000-8000-000000000001';
  r jsonb := '{}';
begin
  insert into public.planning_versions(project_id,product_id,revision,parent_id,action,snapshot,created_by) values(p,product,1,null,'create',doc,me) returning id into v1;
  r := r || jsonb_build_object('own_create_read',exists(select 1 from public.planning_versions where id=v1));
  begin
    insert into public.planning_versions(project_id,product_id,revision,parent_id,action,snapshot,created_by) values(p,product,1,null,'create',doc,me);
    r := r || '{"stale_parent_blocked":false}';
  exception when serialization_failure or unique_violation then r := r || '{"stale_parent_blocked":true}'; end;
  perform set_config('request.jwt.claims','{"sub":"95300000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  r := r || jsonb_build_object('same_company_peer_can_read',exists(select 1 from public.planning_versions where id=v1));
  perform set_config('request.jwt.claims','{"sub":"95300000-0000-4000-8000-000000000003","role":"authenticated"}',true);
  r := r || jsonb_build_object('other_company_hidden',not exists(select 1 from public.planning_versions where id=v1));
  begin
    insert into public.planning_versions(project_id,product_id,revision,parent_id,action,snapshot,created_by) values(p,product,2,v1,'generate',doc,'95300000-0000-4000-8000-000000000003');
    r := r || '{"other_company_insert_blocked":false}';
  exception when insufficient_privilege then r := r || '{"other_company_insert_blocked":true}'; end;
  perform set_config('request.jwt.claims','{"sub":"95300000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  begin
    insert into public.planning_versions(project_id,product_id,revision,parent_id,action,snapshot,created_by) values(p,product,2,v1,'generate',doc,'95300000-0000-4000-8000-000000000002');
    r := r || '{"author_spoof_blocked":false}';
  exception when insufficient_privilege then r := r || '{"author_spoof_blocked":true}'; end;
  changed := jsonb_set(doc,'{sources,0,excerpt}','"위조 원문"');
  begin
    insert into public.planning_versions(project_id,product_id,revision,parent_id,action,snapshot,created_by) values(p,product,2,v1,'generate',changed,me);
    r := r || '{"forged_source_blocked":false}';
  exception when raise_exception then r := r || '{"forged_source_blocked":true}'; end;
  approved := jsonb_set(doc,'{sections,0}',doc->'sections'->0 || jsonb_build_object('status','approved','approvedBy',me,'approvedAt','2000-01-01T00:00:00Z'));
  begin
    insert into public.planning_versions(project_id,product_id,revision,parent_id,action,snapshot,created_by) values(p,product,2,v1,'generate',approved,me);
    r := r || '{"automatic_approval_blocked":false}';
  exception when raise_exception then r := r || '{"automatic_approval_blocked":true}'; end;
  insert into public.planning_versions(project_id,product_id,revision,parent_id,action,changed_section_id,snapshot,created_by)
    values(p,product,2,v1,'approve',(doc->'sections'->0->>'id')::uuid,approved,me) returning id,snapshot into v2,approved;
  r := r || jsonb_build_object('approval_records_user_and_server_time',approved->'sections'->0->>'approvedBy'=me::text and approved->'sections'->0->>'approvedAt'<>'2000-01-01T00:00:00Z');
  changed := jsonb_set(approved,'{sections,0,headline}','"승인 후 수정"');
  begin
    insert into public.planning_versions(project_id,product_id,revision,parent_id,action,snapshot,created_by) values(p,product,3,v2,'edit',changed,me);
    r := r || '{"approved_edit_blocked":false}';
  exception when insufficient_privilege then r := r || '{"approved_edit_blocked":true}'; end;
  begin
    insert into public.planning_versions(project_id,product_id,revision,parent_id,action,changed_section_id,snapshot,created_by)
      values(p,product,3,v2,'regenerate_section',(doc->'sections'->0->>'id')::uuid,changed,me);
    r := r || '{"approved_regeneration_blocked":false}';
  exception when raise_exception then r := r || '{"approved_regeneration_blocked":true}'; end;
  changed := jsonb_set(approved,'{sections,1,headline}','"선택 구좌 재생성"');
  insert into public.planning_versions(project_id,product_id,revision,parent_id,action,changed_section_id,snapshot,created_by)
    values(p,product,3,v2,'regenerate_section',(doc->'sections'->1->>'id')::uuid,changed,me) returning id into v3;
  r := r || jsonb_build_object('single_regeneration_preserves_approval',(select snapshot->'sections'->0 = approved->'sections'->0 from public.planning_versions where id=v3));
  begin update public.planning_versions set action='edit' where id=v1; r:=r||'{"direct_update_blocked":false}'; exception when insufficient_privilege then r:=r||'{"direct_update_blocked":true}'; end;
  begin delete from public.planning_versions where id=v1; r:=r||'{"direct_delete_blocked":false}'; exception when insufficient_privilege then r:=r||'{"direct_delete_blocked":true}'; end;
  changed := jsonb_set(changed,'{sections,0}',doc->'sections'->0);
  insert into public.planning_versions(project_id,product_id,revision,parent_id,action,changed_section_id,snapshot,created_by)
    values(p,product,4,v3,'unapprove',(doc->'sections'->0->>'id')::uuid,changed,me) returning id into v4;
  changed := jsonb_set(changed,'{sections,2,body}','"개선 99.9%"');
  insert into public.planning_versions(project_id,product_id,revision,parent_id,action,snapshot,created_by) values(p,product,5,v4,'edit',changed,me) returning id into v5;
  r:=r||'{"unapprove_then_edit_allowed":true}';
  changed := jsonb_set(changed,'{sections,2}',changed->'sections'->2 || jsonb_build_object('status','approved','approvedBy',me,'approvedAt',now()));
  begin
    insert into public.planning_versions(project_id,product_id,revision,parent_id,action,changed_section_id,snapshot,created_by)
      values(p,product,6,v5,'approve',(doc->'sections'->2->>'id')::uuid,changed,me);
    r:=r||'{"unsupported_number_approval_blocked":false}';
  exception when raise_exception then r:=r||'{"unsupported_number_approval_blocked":true}'; end;
  begin
    insert into public.planning_versions(project_id,product_id,revision,parent_id,action,restored_from,snapshot,created_by) values(p,product,6,v5,'restore',v1,changed,me);
    r:=r||'{"tampered_restore_blocked":false}';
  exception when raise_exception then r:=r||'{"tampered_restore_blocked":true}'; end;
  insert into public.planning_versions(project_id,product_id,revision,parent_id,action,restored_from,snapshot,created_by) values(p,product,6,v5,'restore',v1,doc,me) returning id into v6;
  r:=r||jsonb_build_object('restore_appends_and_preserves_history',(select count(*)=6 from public.planning_versions where product_id=product) and (select snapshot=doc from public.planning_versions where id=v1));
  changed:=jsonb_set(doc,'{sections,2}',doc->'sections'->2 || jsonb_build_object('status','approved','approvedBy',me,'approvedAt',now()));
  insert into public.planning_versions(project_id,product_id,revision,parent_id,action,changed_section_id,snapshot,created_by)
    values(p,product,7,v6,'approve',(doc->'sections'->2->>'id')::uuid,changed,me) returning id into v7;
  r:=r||jsonb_build_object('supported_number_approval_allowed',v7 is not null);
  perform set_config('test.planning_result',r::text,true);
end;
$test$;
reset role;
select current_setting('test.planning_result')::jsonb as planning_checks;
rollback;
