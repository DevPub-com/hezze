-- HETJE: My HETJE 저장 / Tomorrow 추적 영속화용 북마크 테이블
-- Supabase SQL Editor 에서 1회 실행하세요.

create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  archive_id uuid not null references public.archives (id) on delete cascade,
  kind text not null check (kind in ('saved', 'tracked')),
  created_at timestamptz not null default now(),
  unique (user_id, archive_id, kind)
);

create index if not exists bookmarks_user_id_idx on public.bookmarks (user_id);
create index if not exists bookmarks_archive_id_idx on public.bookmarks (archive_id);

-- 앱은 anon 키로 접속하며 user_id 를 명시적으로 전달합니다(기존 votes 테이블과 동일 방식).
-- 아래는 anon 키에서 동작하도록 하는 허용 정책입니다.
-- 더 엄격한 보안이 필요하면 auth.uid() 기반 정책으로 교체하세요.
alter table public.bookmarks enable row level security;

drop policy if exists "bookmarks_all_access" on public.bookmarks;
create policy "bookmarks_all_access"
  on public.bookmarks
  for all
  using (true)
  with check (true);
