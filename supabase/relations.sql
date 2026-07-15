-- HETJE: 클레임 간 관계(같은 방향/반대/파생) 저장 테이블
-- Supabase SQL Editor 에서 1회 실행하세요.

create table if not exists public.relations (
  id uuid primary key default gen_random_uuid(),
  source_archive_id uuid not null references public.archives (id) on delete cascade,
  target_archive_id uuid not null references public.archives (id) on delete cascade,
  relation_type text not null check (relation_type in ('SUPPORTS', 'CONTRADICTS', 'DERIVED')),
  created_at timestamptz not null default now(),
  unique (source_archive_id, target_archive_id, relation_type),
  check (source_archive_id <> target_archive_id)
);

create index if not exists relations_source_idx on public.relations (source_archive_id);
create index if not exists relations_target_idx on public.relations (target_archive_id);

-- 앱은 anon 키로 접속합니다(기존 votes/bookmarks 테이블과 동일 방식).
-- 더 엄격한 보안이 필요하면 auth.uid() 기반 정책으로 교체하세요.
alter table public.relations enable row level security;

drop policy if exists "relations_all_access" on public.relations;
create policy "relations_all_access"
  on public.relations
  for all
  using (true)
  with check (true);
