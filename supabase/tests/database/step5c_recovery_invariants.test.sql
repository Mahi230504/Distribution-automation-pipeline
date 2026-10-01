begin;
create extension if not exists pgtap with schema extensions;
select plan(28);
select has_table('public','publication_job_registry','job registry exists');
select ok((select relrowsecurity from pg_class where oid='public.publication_job_registry'::regclass),'job registry uses RLS');
select isnt(has_table_privilege('authenticated','public.platform_connections','select'),true,'User A cannot bypass API for connection metadata');
select isnt(has_table_privilege('authenticated','public.publication_runs','select'),true,'User B cannot bypass API for publication records');
select isnt(has_table_privilege('authenticated','public.platform_connection_secrets','select'),true,'connection secrets are service-only');
select isnt(has_table_privilege('authenticated','public.oauth_states','select'),true,'OAuth states are service-only');
select isnt(has_table_privilege('authenticated','public.publication_job_secrets','select'),true,'job secrets are service-only');
select isnt(has_table_privilege('authenticated','public.publication_job_registry','select'),true,'job registry is service-only');
select isnt(has_function_privilege('authenticated','public.consume_oauth_state(text,text,text,timestamp with time zone)','execute'),true,'browser cannot consume OAuth state');
select isnt(has_function_privilege('authenticated','public.put_publication_run(uuid,uuid,bigint,jsonb)','execute'),true,'browser cannot save publication aggregates');
select isnt(has_function_privilege('authenticated','public.commit_publication_checkpoint(uuid,uuid,uuid,uuid,bigint,jsonb,jsonb,bigint,timestamp with time zone)','execute'),true,'browser cannot commit job secrets');
select has_function('public','consume_oauth_state',array['text','text','text','timestamp with time zone'],'atomic OAuth consume exists');
select has_function('public','put_publication_run',array['uuid','uuid','bigint','jsonb'],'conflict-checking aggregate RPC exists');
select has_function('public','commit_publication_checkpoint',array['uuid','uuid','uuid','uuid','bigint','jsonb','jsonb','bigint','timestamp with time zone'],'atomic checkpoint RPC exists');
select col_is_fk('public','publication_job_secrets','run_id','job secret is tied to registered aggregate');
select throws_ok($$insert into public.publication_job_secrets(job_id,user_id,run_id,claim_id,fence,envelope) values('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004',1,'{}')$$,'23503',null,'cross-owner/unregistered job secret is rejected');

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','33333333-3333-4333-8333-333333333333','authenticated','authenticated','step5c-a@example.test','',now(),now(),now()),
('00000000-0000-0000-0000-000000000000','44444444-4444-4444-8444-444444444444','authenticated','authenticated','step5c-b@example.test','',now(),now(),now());
insert into public.runs(id,user_id,current_stage,job_status,snapshot) values
('aaaaaaaa-3333-4333-8333-333333333333','33333333-3333-4333-8333-333333333333','done','idle','{"id":"aaaaaaaa-3333-4333-8333-333333333333","userId":"33333333-3333-4333-8333-333333333333"}'),
('bbbbbbbb-4444-4444-8444-444444444444','44444444-4444-4444-8444-444444444444','done','idle','{"id":"bbbbbbbb-4444-4444-8444-444444444444","userId":"44444444-4444-4444-8444-444444444444"}'),
('eeeeeeee-3333-4333-8333-333333333333','33333333-3333-4333-8333-333333333333','done','idle','{"id":"eeeeeeee-3333-4333-8333-333333333333","userId":"33333333-3333-4333-8333-333333333333"}'),
('ffffffff-4444-4444-8444-444444444444','44444444-4444-4444-8444-444444444444','done','idle','{"id":"ffffffff-4444-4444-8444-444444444444","userId":"44444444-4444-4444-8444-444444444444"}');
insert into public.platform_connections(id,user_id,provider,metadata) values
('cccccccc-3333-4333-8333-333333333333','33333333-3333-4333-8333-333333333333','youtube','{"ownerId":"33333333-3333-4333-8333-333333333333"}'),
('dddddddd-4444-4444-8444-444444444444','44444444-4444-4444-8444-444444444444','linkedin','{"ownerId":"44444444-4444-4444-8444-444444444444"}');
insert into public.publication_runs(run_id,user_id,revision,snapshot) values
('aaaaaaaa-3333-4333-8333-333333333333','33333333-3333-4333-8333-333333333333',1,'{"ownerId":"33333333-3333-4333-8333-333333333333","runId":"aaaaaaaa-3333-4333-8333-333333333333"}'),
('bbbbbbbb-4444-4444-8444-444444444444','44444444-4444-4444-8444-444444444444',1,'{"ownerId":"44444444-4444-4444-8444-444444444444","runId":"bbbbbbbb-4444-4444-8444-444444444444"}');
insert into public.platform_connection_secrets(connection_id,user_id,envelope) values('cccccccc-3333-4333-8333-333333333333','33333333-3333-4333-8333-333333333333','{}');
insert into public.oauth_states(id,state_hash,user_id,provider,record,expires_at) values('99999999-3333-4333-8333-333333333333',repeat('a',64),'33333333-3333-4333-8333-333333333333','youtube','{"cookieHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}',now()+interval '10 minutes');

grant select on public.platform_connections,public.publication_runs,public.platform_connection_secrets,public.oauth_states to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
select results_eq($$select count(*)::bigint from public.platform_connections where user_id='33333333-3333-4333-8333-333333333333'$$,array[1::bigint],'User A can read A safe connection metadata when the API grants it');
select results_eq($$select count(*)::bigint from public.platform_connections where user_id='44444444-4444-4444-8444-444444444444'$$,array[0::bigint],'User A cannot read User B connection metadata');
select results_eq($$select count(*)::bigint from public.publication_runs where user_id='33333333-3333-4333-8333-333333333333'$$,array[1::bigint],'User A can read A publication record when the API grants it');
select results_eq($$select count(*)::bigint from public.publication_runs where user_id='44444444-4444-4444-8444-444444444444'$$,array[0::bigint],'User A cannot read User B publication record');
select results_eq('select count(*)::bigint from public.platform_connection_secrets',array[0::bigint],'User A cannot read even A connection secrets');
select results_eq('select count(*)::bigint from public.oauth_states',array[0::bigint],'User A cannot read even A OAuth state');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}',true);
select results_eq($$select count(*)::bigint from public.platform_connections where user_id='44444444-4444-4444-8444-444444444444'$$,array[1::bigint],'User B can read B safe connection metadata when the API grants it');
select results_eq($$select count(*)::bigint from public.publication_runs where user_id='44444444-4444-4444-8444-444444444444'$$,array[1::bigint],'User B can read B publication record when the API grants it');
reset role;

select isnt(public.consume_oauth_state(repeat('a',64),'youtube',repeat('b',64),now()),null,'OAuth state is consumed once');
select is(public.consume_oauth_state(repeat('a',64),'youtube',repeat('b',64),now()),null,'OAuth state replay is rejected atomically');
select ok(public.put_publication_run('33333333-3333-4333-8333-333333333333','eeeeeeee-3333-4333-8333-333333333333',0,'{"ownerId":"33333333-3333-4333-8333-333333333333","runId":"eeeeeeee-3333-4333-8333-333333333333","intents":[{"id":"12121212-3333-4333-8333-333333333333","batchId":"13131313-3333-4333-8333-333333333333","idempotencyFingerprint":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"}],"jobs":[]}'),'first idempotency binding is accepted');
select throws_ok($$select public.put_publication_run('44444444-4444-4444-8444-444444444444','ffffffff-4444-4444-8444-444444444444',0,'{"ownerId":"44444444-4444-4444-8444-444444444444","runId":"ffffffff-4444-4444-8444-444444444444","intents":[{"id":"14141414-4444-4444-8444-444444444444","batchId":"15151515-4444-4444-8444-444444444444","idempotencyFingerprint":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"}],"jobs":[]}')$$,'P0001','publication idempotency conflict','same fingerprint cannot bind another owner/run/intent/batch');
select * from finish();
rollback;
