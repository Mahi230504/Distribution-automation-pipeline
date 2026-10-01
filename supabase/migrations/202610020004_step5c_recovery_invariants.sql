begin;

create table if not exists public.publication_job_registry (
  job_id uuid not null,
  user_id uuid not null,
  run_id uuid not null,
  intent_id uuid not null,
  primary key (job_id,user_id),
  unique (job_id,user_id,run_id),
  foreign key (run_id,user_id) references public.runs(id,user_id) on delete cascade
);
alter table public.publication_job_registry enable row level security;
revoke all on public.publication_job_registry from anon, authenticated;

alter table public.publication_job_secrets add column if not exists run_id uuid;
alter table public.publication_job_secrets add column if not exists claim_id uuid;
alter table public.publication_job_secrets add column if not exists fence bigint;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='publication_job_secret_registry_fk') then
    alter table public.publication_job_secrets add constraint publication_job_secret_registry_fk
      foreign key (job_id,user_id,run_id) references public.publication_job_registry(job_id,user_id,run_id) on delete cascade;
  end if;
end $$;

create or replace function public.put_publication_run(p_user_id uuid,p_run_id uuid,p_expected_revision bigint,p_snapshot jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare item jsonb; existing public.publication_idempotency%rowtype;
begin
  if p_snapshot->>'ownerId'<>p_user_id::text or p_snapshot->>'runId'<>p_run_id::text then raise exception 'publication ownership mismatch'; end if;
  for item in select * from jsonb_array_elements(coalesce(p_snapshot->'intents','[]'::jsonb)) loop
    select * into existing from public.publication_idempotency where fingerprint=item->>'idempotencyFingerprint';
    if found and (existing.user_id<>p_user_id or existing.run_id<>p_run_id or existing.intent_id<>(item->>'id')::uuid or existing.batch_id<>(item->>'batchId')::uuid) then raise exception 'publication idempotency conflict'; end if;
  end loop;
  if p_expected_revision=0 then
    insert into public.publication_runs(run_id,user_id,revision,snapshot,updated_at) values(p_run_id,p_user_id,1,p_snapshot,now()) on conflict do nothing;
    if not found then return false; end if;
  else
    update public.publication_runs set revision=p_expected_revision+1,snapshot=p_snapshot,updated_at=now() where run_id=p_run_id and user_id=p_user_id and revision=p_expected_revision;
    if not found then return false; end if;
  end if;
  for item in select * from jsonb_array_elements(coalesce(p_snapshot->'intents','[]'::jsonb)) loop
    insert into public.publication_idempotency(fingerprint,user_id,run_id,intent_id,batch_id) values(item->>'idempotencyFingerprint',p_user_id,p_run_id,(item->>'id')::uuid,(item->>'batchId')::uuid) on conflict (fingerprint) do nothing;
  end loop;
  for item in select * from jsonb_array_elements(coalesce(p_snapshot->'jobs','[]'::jsonb)) loop
    if item->>'ownerId'<>p_user_id::text or item->>'runId'<>p_run_id::text or not exists(select 1 from jsonb_array_elements(coalesce(p_snapshot->'intents','[]'::jsonb)) i where i->>'id'=item->>'intentId') then raise exception 'publication job reference mismatch'; end if;
    insert into public.publication_job_registry(job_id,user_id,run_id,intent_id) values((item->>'id')::uuid,p_user_id,p_run_id,(item->>'intentId')::uuid) on conflict (job_id,user_id) do update set run_id=excluded.run_id,intent_id=excluded.intent_id where publication_job_registry.run_id=excluded.run_id and publication_job_registry.intent_id=excluded.intent_id;
    if not found then raise exception 'publication job registry conflict'; end if;
  end loop;
  return true;
end $$;
revoke all on function public.put_publication_run(uuid,uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.put_publication_run(uuid,uuid,bigint,jsonb) to service_role;

create or replace function public.commit_publication_checkpoint(p_user_id uuid,p_run_id uuid,p_job_id uuid,p_claim_id uuid,p_expected_revision bigint,p_snapshot jsonb,p_secret jsonb,p_secret_fence bigint,p_secret_updated_at timestamptz)
returns boolean language plpgsql security definer set search_path=public as $$
declare current_snapshot jsonb; active_claim text;
begin
  select snapshot into current_snapshot from public.publication_runs where run_id=p_run_id and user_id=p_user_id and revision=p_expected_revision for update;
  if not found then return false; end if;
  select job->'activeClaim'->>'id' into active_claim from jsonb_array_elements(coalesce(current_snapshot->'jobs','[]'::jsonb)) job where job->>'id'=p_job_id::text;
  if active_claim is distinct from p_claim_id::text then return false; end if;
  if not exists(select 1 from public.publication_job_registry where job_id=p_job_id and user_id=p_user_id and run_id=p_run_id) then raise exception 'publication job registry mismatch'; end if;
  if p_secret is not null then
    insert into public.publication_job_secrets(job_id,user_id,run_id,claim_id,fence,envelope,updated_at) values(p_job_id,p_user_id,p_run_id,p_claim_id,p_secret_fence,p_secret,p_secret_updated_at)
    on conflict (job_id,user_id) do update set run_id=excluded.run_id,claim_id=excluded.claim_id,fence=excluded.fence,envelope=excluded.envelope,updated_at=excluded.updated_at where publication_job_secrets.fence is null or publication_job_secrets.fence<=excluded.fence;
    if not found then return false; end if;
  end if;
  update public.publication_runs set revision=p_expected_revision+1,snapshot=p_snapshot,updated_at=now() where run_id=p_run_id and user_id=p_user_id and revision=p_expected_revision;
  return found;
end $$;
revoke all on function public.commit_publication_checkpoint(uuid,uuid,uuid,uuid,bigint,jsonb,jsonb,bigint,timestamptz) from public,anon,authenticated;
grant execute on function public.commit_publication_checkpoint(uuid,uuid,uuid,uuid,bigint,jsonb,jsonb,bigint,timestamptz) to service_role;

commit;
