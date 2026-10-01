-- Additive Step 5B metadata. Existing image rows remain valid and untouched.
alter table public.assets add column if not exists asset_kind text not null default 'image';
alter table public.assets add column if not exists original_filename text;
alter table public.assets add column if not exists detected_metadata jsonb;
alter table public.assets add column if not exists validation jsonb;
alter table public.assets add column if not exists media_version integer;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'assets_kind_check') then
    alter table public.assets add constraint assets_kind_check check (asset_kind in ('image', 'final-video'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'assets_media_version_check') then
    alter table public.assets add constraint assets_media_version_check check (media_version is null or media_version > 0);
  end if;
end $$;

create index if not exists assets_release_media_idx on public.assets (user_id, run_id, media_version)
where asset_kind = 'final-video';
