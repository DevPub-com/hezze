import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("new linked archives preserve the original speaker and publisher", async () => {
  const api = await readFile("src/domains/archive/api/analyze.action.ts", "utf8");

  assert.match(api, /speaker_name: preview\.speakerName\.trim\(\)/);
  assert.match(api, /speaker_organization: preview\.speakerOrganization\.trim\(\)/);
  assert.match(api, /sourceVenue = transcriptData\.author \|\| "YouTube"/);
  assert.match(api, /og:site_name/);
  assert.match(api, /localeCompare\(b\.recordedAt\)/);
  assert.match(api, /archive\.speaker_organization !== "My HETJE"/);
});

test("archive cards show the original source and omit the redundant My HETJE action", async () => {
  const board = await readFile("src/components/board/BoardView.tsx", "utf8");
  const card = await readFile("src/components/hetje/HetjeCard.tsx", "utf8");

  assert.match(board, /archive\.evidence\.sourceVenue/);
  assert.match(board, /원본 컨텐츠/);
  assert.doesNotMatch(board, /원본 기사 바로가기/);
  assert.match(board, /sticky bottom-0/);
  assert.match(card, /archive\.evidence\.sourceVenue/);
  assert.match(board, /toggleSaved/);
  assert.match(card, /toggleSaved/);
  assert.doesNotMatch(board, /＋ My HETJE/);
  assert.doesNotMatch(card, /＋ My/);
});
