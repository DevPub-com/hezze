-- HETJE 등록 의도와 공개 관계값
-- 기존 HETJE는 현재 Board 노출을 유지하기 위해 공개 상태를 기본값으로 둡니다.

alter table public.archives
  add column if not exists content_intent text not null default 'SHARE',
  add column if not exists is_public boolean not null default true,
  add column if not exists creator_stance text;

alter table public.archives
  drop constraint if exists archives_content_intent_check,
  add constraint archives_content_intent_check
    check (content_intent in ('REMEMBER', 'OPINION', 'TRACK', 'SHARE'));

alter table public.archives
  drop constraint if exists archives_creator_stance_check,
  add constraint archives_creator_stance_check
    check (creator_stance is null or creator_stance in ('AGREE', 'HOLD', 'DISAGREE'));

create index if not exists archives_is_public_idx
  on public.archives (is_public)
  where is_public = true;

-- 새 컬럼을 PostgREST가 즉시 인식하도록 스키마 캐시를 갱신합니다.
notify pgrst, 'reload schema';
