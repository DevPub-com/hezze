-- HETJE: My HETJE 저장 / Tomorrow 추적 관계
-- Supabase SQL Editor에서 1회 실행하세요.

create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  archive_id uuid not null references public.archives (id) on delete cascade,
  kind text not null check (kind in ('saved', 'tracked')),
  created_at timestamptz not null default now(),
  unique (user_id, archive_id, kind)
);

create index if not exists bookmarks_user_id_idx on public.bookmarks (user_id);
create index if not exists bookmarks_archive_id_idx on public.bookmarks (archive_id);

alter table public.bookmarks enable row level security;

drop policy if exists "bookmarks_all_access" on public.bookmarks;
drop policy if exists "bookmarks_select_own" on public.bookmarks;
drop policy if exists "bookmarks_insert_own" on public.bookmarks;
drop policy if exists "bookmarks_delete_own" on public.bookmarks;

create policy "bookmarks_select_own"
  on public.bookmarks
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "bookmarks_insert_own"
  on public.bookmarks
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "bookmarks_delete_own"
  on public.bookmarks
  for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, delete on public.bookmarks to authenticated;

-- cron은 사용자 정보를 읽지 않고 Tomorrow 대상 HETJE ID만 조회합니다.
create or replace function public.list_tracked_archive_ids()
returns table (archive_id uuid)
language sql
security definer
set search_path = public, pg_temp
as $$
  select distinct bookmarks.archive_id
  from public.bookmarks
  where bookmarks.kind = 'tracked';
$$;

revoke all on function public.list_tracked_archive_ids() from public;
grant execute on function public.list_tracked_archive_ids() to anon, authenticated, service_role;
