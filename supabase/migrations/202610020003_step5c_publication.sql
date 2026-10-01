begin;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='runs_id_user_unique') then
    alter table public.runs add constraint runs_id_user_unique unique (id, user_id);
  end if;
end $$;

create table if not exists public.platform_connections (
  id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('youtube','instagram','linkedin')),
  revision bigint not null default 1 check (revision > 0),
  metadata jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (id, user_id)
);
create index if not exists platform_connections_owner_provider_idx on public.platform_connections(user_id,provider);

create table if not exists public.platform_connection_secrets (
  connection_id uuid not null,
  user_id uuid not null,
  envelope jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (connection_id,user_id),
  foreign key (connection_id,user_id) references public.platform_connections(id,user_id) on delete cascade
);

create table if not exists public.oauth_states (
  id uuid primary key,
  state_hash text not null unique check (length(state_hash)=64),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('youtube','instagram','linkedin')),
  record jsonb not null,
  expires_at timestamptz not null,
  consumed_at timestamptz
);
create index if not exists oauth_states_expiry_idx on public.oauth_states(expires_at);

create table if not exists public.publication_runs (
  run_id uuid not null,
  user_id uuid not null,
  revision bigint not null default 0 check (revision >= 0),
  snapshot jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (run_id,user_id),
  foreign key (run_id,user_id) references public.runs(id,user_id) on delete cascade,
  check (snapshot->>'ownerId'=user_id::text),
  check (snapshot->>'runId'=run_id::text)
);
create index if not exists publication_runs_owner_idx on public.publication_runs(user_id,updated_at desc);

create table if not exists public.publication_idempotency (
  fingerprint text primary key check (length(fingerprint)=64),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null,
  intent_id uuid not null,
  batch_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (run_id,user_id) references public.runs(id,user_id) on delete cascade,
  unique (user_id,run_id,intent_id)
);
create index if not exists publication_idempotency_owner_run_idx on public.publication_idempotency(user_id,run_id);

create table if not exists public.publication_job_secrets (
  job_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  envelope jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (job_id,user_id)
);

alter table public.platform_connections enable row level security;
alter table public.platform_connection_secrets enable row level security;
alter table public.oauth_states enable row level security;
alter table public.publication_runs enable row level security;
alter table public.publication_idempotency enable row level security;
alter table public.publication_job_secrets enable row level security;

revoke all on public.platform_connections, public.platform_connection_secrets, public.oauth_states, public.publication_runs, public.publication_idempotency, public.publication_job_secrets from anon, authenticated;

drop policy if exists platform_connections_owner_select on public.platform_connections;
create policy platform_connections_owner_select on public.platform_connections for select to authenticated using (auth.uid()=user_id);
drop policy if exists publication_runs_owner_select on public.publication_runs;
create policy publication_runs_owner_select on public.publication_runs for select to authenticated using (auth.uid()=user_id);
-- Browser grants stay revoked: these ownership policies are defense in depth.
-- Secret, OAuth-state and job-secret tables intentionally have no browser policy.

create or replace function public.consume_oauth_state(p_state_hash text,p_provider text,p_cookie_hash text,p_consumed_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public as $$
declare item public.oauth_states%rowtype; updated_record jsonb;
begin
  update public.oauth_states
     set consumed_at=p_consumed_at,
         record=jsonb_set(record,'{consumedAt}',to_jsonb(p_consumed_at::text),true)
   where state_hash=p_state_hash and provider=p_provider and consumed_at is null
     and expires_at>p_consumed_at and record->>'cookieHash'=p_cookie_hash
   returning * into item;
  if not found then return null; end if;
  return item.record;
end $$;
revoke all on function public.consume_oauth_state(text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.consume_oauth_state(text,text,text,timestamptz) to service_role;

create or replace function public.put_publication_run(p_user_id uuid,p_run_id uuid,p_expected_revision bigint,p_snapshot jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare intent jsonb;
begin
  if p_expected_revision=0 then
    insert into public.publication_runs(run_id,user_id,revision,snapshot,updated_at)
    values(p_run_id,p_user_id,1,p_snapshot,now()) on conflict do nothing;
    if found then
      for intent in select * from jsonb_array_elements(coalesce(p_snapshot->'intents','[]'::jsonb)) loop
        insert into public.publication_idempotency(fingerprint,user_id,run_id,intent_id,batch_id)
        values(intent->>'idempotencyFingerprint',p_user_id,p_run_id,(intent->>'id')::uuid,(intent->>'batchId')::uuid)
        on conflict (fingerprint) do nothing;
      end loop;
      return true;
    end if;
  end if;
  update public.publication_runs set revision=p_expected_revision+1,snapshot=p_snapshot,updated_at=now()
   where run_id=p_run_id and user_id=p_user_id and revision=p_expected_revision;
  if not found then return false; end if;
  for intent in select * from jsonb_array_elements(coalesce(p_snapshot->'intents','[]'::jsonb)) loop
    insert into public.publication_idempotency(fingerprint,user_id,run_id,intent_id,batch_id)
    values(intent->>'idempotencyFingerprint',p_user_id,p_run_id,(intent->>'id')::uuid,(intent->>'batchId')::uuid)
    on conflict (fingerprint) do nothing;
  end loop;
  return true;
end $$;
revoke all on function public.put_publication_run(uuid,uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.put_publication_run(uuid,uuid,bigint,jsonb) to service_role;

commit;
