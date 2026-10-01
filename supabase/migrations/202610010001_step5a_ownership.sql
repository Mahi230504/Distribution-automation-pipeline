create table public.runs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  current_stage text not null,
  job_status text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint runs_snapshot_object check (jsonb_typeof(snapshot) = 'object'),
  constraint runs_snapshot_id check (snapshot->>'id' = id::text),
  constraint runs_snapshot_owner check (snapshot->>'userId' = user_id::text),
  constraint runs_snapshot_stage check (snapshot->>'currentStage' = current_stage),
  constraint runs_snapshot_job_status check (snapshot->>'jobStatus' = job_status)
);
create index runs_owner_updated_idx on public.runs (user_id, updated_at desc);
create index runs_owner_stage_idx on public.runs (user_id, current_stage, updated_at desc);
create index runs_recovery_idx on public.runs (job_status, updated_at) where job_status in ('queued', 'running');

create table public.brand_kits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  updated_at timestamptz not null default now()
);

create table public.assets (
  id uuid primary key,
  user_id uuid not null,
  run_id uuid not null,
  bucket_id text not null check (bucket_id = 'vpo-private'),
  object_path text not null unique,
  purpose text not null,
  media_type text not null,
  byte_size bigint not null check (byte_size > 0),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  foreign key (run_id, user_id) references public.runs(id, user_id) on delete cascade,
  constraint assets_server_path check (
    object_path ~ ('^' || user_id::text || '/' || run_id::text || '/' || id::text || '\.[a-z0-9]+$')
  )
);
create index assets_owner_idx on public.assets (user_id, created_at desc);
create index assets_run_idx on public.assets (user_id, run_id);

alter table public.runs enable row level security;
alter table public.brand_kits enable row level security;
alter table public.assets enable row level security;

revoke all on public.runs, public.brand_kits, public.assets from anon, authenticated;
grant select, insert, update, delete on public.runs, public.brand_kits, public.assets to service_role;

create policy runs_owner_select on public.runs for select to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy runs_owner_insert on public.runs for insert to authenticated with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy runs_owner_update on public.runs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy runs_owner_delete on public.runs for delete to authenticated using ((select auth.uid()) = user_id);

create policy brand_kits_owner_select on public.brand_kits for select to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy brand_kits_owner_insert on public.brand_kits for insert to authenticated with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy brand_kits_owner_update on public.brand_kits for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy brand_kits_owner_delete on public.brand_kits for delete to authenticated using ((select auth.uid()) = user_id);

create policy assets_owner_select on public.assets for select to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy assets_owner_insert on public.assets for insert to authenticated with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy assets_owner_update on public.assets for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy assets_owner_delete on public.assets for delete to authenticated using ((select auth.uid()) = user_id);

-- The product serves media through authenticated Express routes. Direct Storage reads
-- are allowed only for objects created with a user JWT and matching both owner metadata
-- and the server-generated first path segment. Server-created objects have no owner_id
-- and remain available only through the explicitly owner-scoped backend adapter.
create policy vpo_private_owner_select on storage.objects for select to authenticated
using (
  bucket_id = 'vpo-private'
  and owner_id = (select auth.uid()::text)
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
