begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

select has_table('public', 'runs', 'runs table exists');
select has_table('public', 'brand_kits', 'brand kits table exists');
select has_table('public', 'assets', 'assets table exists');
select policies_are('public', 'runs', array['runs_owner_delete','runs_owner_insert','runs_owner_select','runs_owner_update'], 'runs has per-operation policies');
select policies_are('public', 'brand_kits', array['brand_kits_owner_delete','brand_kits_owner_insert','brand_kits_owner_select','brand_kits_owner_update'], 'brand kits has per-operation policies');
select policies_are('public', 'assets', array['assets_owner_delete','assets_owner_insert','assets_owner_select','assets_owner_update'], 'assets has per-operation policies');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
('00000000-0000-0000-0000-000000000000','11111111-1111-4111-8111-111111111111','authenticated','authenticated','a@example.test','',now(),now(),now()),
('00000000-0000-0000-0000-000000000000','22222222-2222-4222-8222-222222222222','authenticated','authenticated','b@example.test','',now(),now(),now());

insert into public.runs (id,user_id,current_stage,job_status,snapshot) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','brief','idle','{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","userId":"11111111-1111-4111-8111-111111111111","currentStage":"brief","jobStatus":"idle"}'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','brief','idle','{"id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","userId":"22222222-2222-4222-8222-222222222222","currentStage":"brief","jobStatus":"idle"}');

-- Policy fixtures only: production object mutations use the Storage API. These
-- rows exist only inside this rolled-back local test transaction.
insert into storage.buckets (id, name, public) values ('vpo-private', 'vpo-private', false)
on conflict (id) do nothing;
insert into storage.objects (bucket_id, name, owner_id) values
('vpo-private','11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/11111111-aaaa-4aaa-8aaa-111111111111.png','11111111-1111-4111-8111-111111111111'),
('vpo-private','22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/22222222-bbbb-4bbb-8bbb-222222222222.png','22222222-2222-4222-8222-222222222222');

set local role anon;
select throws_ok('select * from public.runs', '42501', null, 'anonymous cannot read raw snapshots');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select throws_ok('select * from public.runs', '42501', null, 'production authenticated role has no direct raw snapshot grant');
select throws_ok('insert into public.brand_kits(user_id,snapshot) values (''11111111-1111-4111-8111-111111111111'',''{}'')', '42501', null, 'direct writes are denied');

reset role;
grant select, insert, update, delete on public.runs to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select results_eq('select count(*)::bigint from public.runs', array[1::bigint], 'temporary grant proves A sees only A');
select lives_ok($$insert into public.runs(id,user_id,current_stage,job_status,snapshot) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','brief','idle','{"id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","userId":"11111111-1111-4111-8111-111111111111","currentStage":"brief","jobStatus":"idle"}')$$, 'A can insert A only when explicitly granted');
select throws_ok($$insert into public.runs(id,user_id,current_stage,job_status,snapshot) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','22222222-2222-4222-8222-222222222222','brief','idle','{"id":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","userId":"22222222-2222-4222-8222-222222222222","currentStage":"brief","jobStatus":"idle"}')$$, '42501', null, 'A cannot insert for B');
select throws_ok($$update public.runs set user_id='22222222-2222-4222-8222-222222222222' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$, '42501', null, 'A cannot reassign ownership');
select results_eq($$select count(*)::bigint from public.runs where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'$$, array[0::bigint], 'A cannot select B exact ID');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select results_eq('select count(*)::bigint from public.runs', array[1::bigint], 'B sees only B');
reset role;

grant select on storage.objects to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select results_eq($$select count(*)::bigint from storage.objects where owner_id='11111111-1111-4111-8111-111111111111'$$, array[1::bigint], 'A can read A private object');
select results_eq($$select count(*)::bigint from storage.objects where owner_id='22222222-2222-4222-8222-222222222222'$$, array[0::bigint], 'A cannot read B private object by exact owner');
reset role;

select ok(exists(select 1 from pg_indexes where schemaname='public' and indexname='runs_owner_updated_idx'), 'run ownership index exists');

select * from finish();
rollback;
