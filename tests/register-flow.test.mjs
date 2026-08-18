import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("registration asks what the user wants to keep after source analysis", async () => {
  const modal = await readFile("src/components/register/RegisterModal.tsx", "utf8");

  assert.match(modal, /type Step = "source" \| "intent" \| "route" \| "write" \| "position" \| "done"/);
  assert.match(modal, /이 링크에서 무엇을 남기고 싶나요\?/);
  assert.match(modal, /기억하고 싶어요/);
  assert.match(modal, /내 의견을 남기고 싶어요/);
  assert.match(modal, /앞으로 확인하고 싶어요/);
  assert.match(modal, /남들과 공유하고 싶어요/);
  assert.doesNotMatch(modal, /분석한 기사/);
  assert.match(modal, /원본 콘텐츠/);
});

test("AI recommendation is editable while My HETJE remains the required base route", async () => {
  const modal = await readFile("src/components/register/RegisterModal.tsx", "utf8");

  assert.match(modal, /analysisPreview\.recommendedIntent/);
  assert.match(modal, /AI 추천/);
  assert.match(modal, /My HETJE/);
  assert.match(modal, /기본 저장소/);
  assert.match(modal, /setTrackEnabled/);
  assert.match(modal, /setBoardEnabled/);
  assert.match(modal, /사용자가 바꿀 수 있습니다/);
});

test("tracking settings render only when Tomorrow is selected", async () => {
  const modal = await readFile("src/components/register/RegisterModal.tsx", "utf8");

  assert.match(modal, /trackEnabled && \(/);
  assert.match(modal, /AI 체크 주기/);
  assert.match(modal, /추적 만료일/);
  assert.match(modal, /중간 점검일/);
  assert.match(modal, /await markTracked\(archive\.id\)/);
});

test("new HETJE persists its intent and public relationship", async () => {
  const api = await readFile("src/domains/archive/api/analyze.action.ts", "utf8");
  const model = await readFile("src/domains/archive/model/archive.model.ts", "utf8");

  assert.match(model, /export enum HetjeIntent/);
  assert.match(model, /intent: HetjeIntent/);
  assert.match(model, /isPublic: boolean/);
  assert.match(api, /recommendedIntent: HetjeIntent/);
  assert.match(api, /recommendationReason: string/);
  assert.match(api, /content_intent: options\.intent/);
  assert.match(api, /is_public: options\.isPublic/);
});

test("the Supabase migration installs HETJE intent columns and refreshes the schema cache", async () => {
  const migration = await readFile("supabase/hetje-intent-visibility.sql", "utf8");

  assert.match(migration, /add column if not exists content_intent text/);
  assert.match(migration, /add column if not exists is_public boolean/);
  assert.match(migration, /add column if not exists creator_stance text/);
  assert.match(migration, /notify pgrst, 'reload schema'/);
});

test("Board feed is public while saved deep links can still open their detail", async () => {
  const board = await readFile("src/components/board/BoardView.tsx", "utf8");

  assert.match(board, /archiveList\.filter\(\(archive\) => archive\.isPublic\)/);
  assert.match(board, /publicArchiveList\.filter/);
  assert.match(board, /archiveList\.find\(\(archive\) => archive\.id === activeArchiveId\)/);
  assert.match(board, /publicArchiveList\[0\]/);
});

test("periodic checks only run for HETJEs related to Tomorrow", async () => {
  const cron = await readFile("src/app/api/cron/route.ts", "utf8");

  assert.match(cron, /\.rpc\("list_tracked_archive_ids"\)/);
  assert.match(cron, /trackedArchiveIds/);
  assert.match(cron, /\.in\("id", trackedArchiveIds\)/);
});

test("preview analysis does not write to the database and final registration does", async () => {
  const api = await readFile("src/domains/archive/api/analyze.action.ts", "utf8");
  const previewStart = api.indexOf("export async function analyzeNewsUrlPreview");
  const saveStart = api.indexOf("export async function createArchiveFromNewsPreview");

  assert.notEqual(previewStart, -1);
  assert.notEqual(saveStart, -1);
  assert.ok(previewStart < saveStart);

  const previewFunction = api.slice(previewStart, saveStart);
  const saveFunction = api.slice(saveStart);

  assert.doesNotMatch(previewFunction, /\.from\("archives"\)/);
  assert.match(saveFunction, /\.from\("archives"\)/);
  assert.match(saveFunction, /core_claim_quote: trimmedAgenda/);
  assert.match(saveFunction, /core_claim_context: preview\.summary/);
});
