import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("votes schema stores one authenticated vote per user and archive", async () => {
  const sql = await readFile("supabase/votes.sql", "utf8").catch(() => "");

  assert.match(sql, /create table if not exists public\.votes/);
  assert.match(sql, /unique \(user_id, archive_id\)/);
  assert.match(sql, /status text not null check \(status in \('REALIZING', 'FADING', 'DEBATING', 'DEFUNCT', 'REALIZED'\)\)/);
  assert.match(sql, /for insert\s+to authenticated\s+with check \(auth\.uid\(\) = user_id\)/);
  assert.match(sql, /for update\s+to authenticated\s+using \(auth\.uid\(\) = user_id\)\s+with check \(auth\.uid\(\) = user_id\)/);
});

test("vote aggregation is maintained by the database", async () => {
  const sql = await readFile("supabase/votes.sql", "utf8").catch(() => "");

  assert.match(sql, /create or replace function public\.refresh_archive_user_votes/);
  assert.match(sql, /after insert or update or delete on public\.votes/);
  assert.match(sql, /update public\.archives/);
});

test("the browser does not overwrite the database-maintained vote aggregate", async () => {
  const source = await readFile("src/domains/archive/api/vote.action.ts", "utf8").catch(() => "");

  assert.doesNotMatch(source, /\.from\("archives"\)/);
});

test("vote summaries are loaded from the authenticated votes table", async () => {
  const voteApi = await readFile("src/domains/archive/api/vote.action.ts", "utf8").catch(() => "");
  const board = await readFile("src/components/board/BoardView.tsx", "utf8");

  assert.match(voteApi, /export async function fetchVoteSummary\(archiveId: string\)/);
  assert.match(voteApi, /\.from\("votes"\)\s*\.select\("status"\)\s*\.eq\("archive_id", archiveId\)/);
  assert.match(voteApi, /return fetchVoteSummaryWithClient\(client, archiveId\)/);
  assert.match(board, /Promise\.all\(\[\s*fetchUserVote\(activeArchiveId\),\s*fetchVoteSummary\(activeArchiveId\)/);
  assert.match(board, /userVotes: voteSummary/);
});

test("vote summary values update without reordering the status rows", async () => {
  const board = await readFile("src/components/board/BoardView.tsx", "utf8");

  assert.doesNotMatch(board, /\.sort\(\(a, b\) => b\[1\] - a\[1\]\)/);
  assert.match(
    board,
    /\(Object\.keys\(REALITY_STATUS_LABEL\) as RealityStatus\[\]\)[\s\S]*?\.map\(\(status\) => \{[\s\S]*?const count = selectedArchive\.userVotes\?\.\[status\] \|\| 0;/
  );
});

test("vote mutations use the signed-in browser session instead of a server action", async () => {
  const voteApi = await readFile("src/domains/archive/api/vote.action.ts", "utf8").catch(() => "");
  const analyzeApi = await readFile("src/domains/archive/api/analyze.action.ts", "utf8");
  const board = await readFile("src/components/board/BoardView.tsx", "utf8");
  const register = await readFile("src/components/register/RegisterModal.tsx", "utf8");

  assert.doesNotMatch(voteApi, /^"use server";/);
  assert.match(voteApi, /auth\.getSession\(\)/);
  assert.match(voteApi, /session\.user\.id/);
  assert.match(voteApi, /export async function updateVote\(\s*archiveId: string,\s*status: RealityStatus\s*\)/);
  assert.match(voteApi, /export async function fetchUserVote\(archiveId: string\)/);
  assert.doesNotMatch(analyzeApi, /export async function updateVote/);
  assert.match(board, /from "@\/domains\/archive\/api\/vote\.action"/);
  assert.match(register, /from "@\/domains\/archive\/api\/vote\.action"/);
  assert.doesNotMatch(board, /updateVote\(activeArchiveId, status, currentArchive\.userVotes, user\.id\)/);
  assert.doesNotMatch(register, /updateVote\(createdArchive\.id, status, createdArchive\.userVotes, user\.id\)/);
  assert.match(board, /updateVote\(activeArchiveId, status\)/);
  assert.match(register, /updateVote\(createdArchive\.id, status\)/);
});
