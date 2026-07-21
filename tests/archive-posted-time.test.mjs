import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("archive cards and board details expose the Supabase creation time", async () => {
  const board = await readFile("src/components/board/BoardView.tsx", "utf8");
  const card = await readFile("src/components/hetje/HetjeCard.tsx", "utf8");

  assert.match(board, /formatArchivePostedAt\(archive\.evidence\.recordedAt\)/);
  assert.match(board, /formatArchivePostedAt\(selectedArchive\.evidence\.recordedAt\)/);
  assert.match(card, /formatArchivePostedAt\(archive\.evidence\.recordedAt\)/);
  assert.doesNotMatch(board, /등록 \{formatArchivePostedAt/);
  assert.doesNotMatch(card, /등록 \{formatArchivePostedAt/);
});

test("archive creation time is formatted consistently in Korea time", async () => {
  const dateFormatter = await readFile("src/lib/format-archive-posted-at.ts", "utf8");

  assert.match(dateFormatter, /timeZone: "Asia\/Seoul"/);
  assert.match(dateFormatter, /year: "numeric"/);
  assert.match(dateFormatter, /hour: "numeric"/);
  assert.match(dateFormatter, /minute: "2-digit"/);
});
