-- HETJE: 기사별 사용자 투표와 집계 저장
-- Supabase SQL Editor에서 1회 실행하세요.

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  archive_id uuid not null references public.archives (id) on delete cascade,
  status text not null check (status in ('REALIZING', 'FADING', 'DEBATING', 'DEFUNCT', 'REALIZED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, archive_id)
);

create index if not exists votes_archive_id_idx on public.votes (archive_id);
create index if not exists votes_user_id_idx on public.votes (user_id);

alter table public.votes enable row level security;

drop policy if exists "votes_read_authenticated" on public.votes;
drop policy if exists "votes_insert_own" on public.votes;
drop policy if exists "votes_update_own" on public.votes;
drop policy if exists "votes_delete_own" on public.votes;

-- 랭킹 계산을 위해 로그인 사용자는 전체 투표를 읽을 수 있습니다.
create policy "votes_read_authenticated"
  on public.votes
  for select
  to authenticated
  using (true);

create policy "votes_insert_own"
  on public.votes
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "votes_update_own"
  on public.votes
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "votes_delete_own"
  on public.votes
  for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.votes to authenticated;

-- 투표 추가·변경·삭제 시 archives.user_votes를 DB에서 다시 계산합니다.
-- 여러 사용자가 동시에 투표해도 브라우저의 오래된 집계값이 덮어쓰지 않게 합니다.
create or replace function public.refresh_archive_user_votes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected_archive_id uuid := coalesce(new.archive_id, old.archive_id);
begin
  update public.archives
  set user_votes = (
    select jsonb_build_object(
      'REALIZING', count(*) filter (where status = 'REALIZING'),
      'FADING', count(*) filter (where status = 'FADING'),
      'DEBATING', count(*) filter (where status = 'DEBATING'),
      'DEFUNCT', count(*) filter (where status = 'DEFUNCT'),
      'REALIZED', count(*) filter (where status = 'REALIZED')
    )
    from public.votes
    where archive_id = affected_archive_id
  )
  where id = affected_archive_id;

  return coalesce(new, old);
end;
$$;

revoke all on function public.refresh_archive_user_votes() from public, anon, authenticated;

drop trigger if exists votes_refresh_archive_user_votes on public.votes;
create trigger votes_refresh_archive_user_votes
  after insert or update or delete on public.votes
  for each row execute function public.refresh_archive_user_votes();
