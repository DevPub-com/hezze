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

-- 관계 조회는 공개하고, 변경은 로그인한 사용자만 허용합니다.
alter table public.relations enable row level security;

drop policy if exists "relations_all_access" on public.relations;
drop policy if exists "relations_read_access" on public.relations;
drop policy if exists "relations_authenticated_insert" on public.relations;
drop policy if exists "relations_authenticated_update" on public.relations;
drop policy if exists "relations_authenticated_delete" on public.relations;

create policy "relations_read_access"
  on public.relations
  for select
  using (true);

create policy "relations_authenticated_insert"
  on public.relations
  for insert
  to authenticated
  with check (true);

create policy "relations_authenticated_update"
  on public.relations
  for update
  to authenticated
  using (true)
  with check (true);

create policy "relations_authenticated_delete"
  on public.relations
  for delete
  to authenticated
  using (true);

grant select on public.relations to anon, authenticated;
grant insert, update, delete on public.relations to authenticated;
