import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("bookmark mutations use the signed-in browser session", async () => {
  const source = await readFile("src/domains/archive/api/bookmark.action.ts", "utf8");

  assert.doesNotMatch(source, /^"use server";/);
  assert.match(source, /auth\.getSession\(\)/);
  assert.match(source, /session\.user\.id/);
  assert.match(source, /export async function fetchUserBookmarks\(\)/);
  assert.match(source, /export async function setBookmark\(\s*archiveId: string/);
});

test("bookmark RLS only lets authenticated users mutate their own rows", async () => {
  const sql = await readFile("supabase/bookmarks.sql", "utf8");

  assert.match(sql, /user_id uuid not null references auth\.users \(id\)/);
  assert.match(sql, /for select\s+to authenticated\s+using \(auth\.uid\(\) = user_id\)/);
  assert.match(sql, /for insert\s+to authenticated\s+with check \(auth\.uid\(\) = user_id\)/);
  assert.match(sql, /for delete\s+to authenticated\s+using \(auth\.uid\(\) = user_id\)/);
  assert.doesNotMatch(sql, /create policy "bookmarks_all_access"/);
});

test("bookmark callers do not provide a forgeable user id", async () => {
  const context = await readFile("src/lib/app-context.tsx", "utf8");

  assert.match(context, /fetchUserBookmarks\(\)/);
  assert.doesNotMatch(context, /fetchUserBookmarks\(user\.id\)/);
  assert.doesNotMatch(context, /setBookmark\(user\.id,/);
});
