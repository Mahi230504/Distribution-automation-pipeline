begin;

create or replace function public.commit_platform_connection_authorization(
  p_user_id uuid,
  p_connection_id uuid,
  p_provider text,
  p_expected_revision bigint,
  p_revision bigint,
  p_metadata jsonb,
  p_envelope jsonb,
  p_updated_at timestamptz
) returns boolean language plpgsql security definer set search_path=public as $$
begin
  if p_provider is null or p_provider not in ('youtube','instagram','linkedin')
     or p_metadata->>'ownerId' is distinct from p_user_id::text
     or p_metadata->>'id' is distinct from p_connection_id::text
     or p_metadata->>'provider' is distinct from p_provider
     or (p_metadata->>'revision')::bigint is distinct from p_revision
     or p_revision is distinct from coalesce(p_expected_revision,0)+1 then
    raise exception 'connection authorization binding mismatch';
  end if;

  if p_expected_revision is null then
    insert into public.platform_connections(id,user_id,provider,revision,metadata,updated_at)
    values(p_connection_id,p_user_id,p_provider,p_revision,p_metadata,p_updated_at)
    on conflict do nothing;
    if not found then return false; end if;
  else
    update public.platform_connections
       set revision=p_revision,metadata=p_metadata,updated_at=p_updated_at
     where id=p_connection_id and user_id=p_user_id and provider=p_provider
       and revision=p_expected_revision;
    if not found then return false; end if;
  end if;

  insert into public.platform_connection_secrets(connection_id,user_id,envelope,updated_at)
  values(p_connection_id,p_user_id,p_envelope,p_updated_at)
  on conflict (connection_id,user_id) do update
    set envelope=excluded.envelope,updated_at=excluded.updated_at;
  return true;
end $$;
revoke all on function public.commit_platform_connection_authorization(uuid,uuid,text,bigint,bigint,jsonb,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.commit_platform_connection_authorization(uuid,uuid,text,bigint,bigint,jsonb,jsonb,timestamptz) to service_role;

create or replace function public.disconnect_platform_connection(
  p_user_id uuid,
  p_connection_id uuid,
  p_provider text,
  p_expected_revision bigint,
  p_revision bigint,
  p_metadata jsonb,
  p_updated_at timestamptz
) returns boolean language plpgsql security definer set search_path=public as $$
begin
  if p_provider is null or p_provider not in ('youtube','instagram','linkedin')
     or p_metadata->>'ownerId' is distinct from p_user_id::text
     or p_metadata->>'id' is distinct from p_connection_id::text
     or p_metadata->>'provider' is distinct from p_provider
     or p_metadata->>'status' is distinct from 'disconnected'
     or (p_metadata->>'revision')::bigint is distinct from p_revision
     or p_revision is distinct from p_expected_revision+1 then
    raise exception 'connection disconnect binding mismatch';
  end if;

  update public.platform_connections
     set revision=p_revision,metadata=p_metadata,updated_at=p_updated_at
   where id=p_connection_id and user_id=p_user_id and provider=p_provider
     and revision=p_expected_revision;
  if not found then return false; end if;
  delete from public.platform_connection_secrets
   where connection_id=p_connection_id and user_id=p_user_id;
  return true;
end $$;
revoke all on function public.disconnect_platform_connection(uuid,uuid,text,bigint,bigint,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.disconnect_platform_connection(uuid,uuid,text,bigint,bigint,jsonb,timestamptz) to service_role;

commit;
