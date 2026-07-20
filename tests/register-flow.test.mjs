import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("new HETJE analyzes the link before asking for an agenda", async () => {
  const modal = await readFile("src/components/register/RegisterModal.tsx", "utf8");

  assert.match(modal, /type Step = "source" \| "agenda" \| "route" \| "position" \| "done"/);
  assert.match(modal, /useState<Step>\("source"\)/);
  assert.match(modal, /analysisPreview/);
  assert.match(modal, /analyzeNewsUrlPreview/);
  assert.match(modal, /createArchiveFromNewsPreview/);
  assert.match(modal, /링크 분석하기/);
  assert.match(modal, /분석한 기사/);
  assert.match(modal, /내 의견 \/ 아젠다/);
  assert.doesNotMatch(modal, /무엇을 남길까요\?/);
  assert.doesNotMatch(modal, /내가 직접 쓰기/);
  assert.doesNotMatch(modal, /createDirectArchive/);
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
  assert.match(saveFunction, /title: preview\.title/);
  assert.match(saveFunction, /summary: preview\.summary/);
});
