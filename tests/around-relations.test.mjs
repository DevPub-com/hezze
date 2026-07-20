import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("relation mutations run with the browser auth session", async () => {
  const relationApi = await readFile("src/domains/archive/api/relation.action.ts", "utf8");

  assert.doesNotMatch(relationApi, /^"use server";/);
  assert.match(relationApi, /getSupabaseClient\(\)/);
  assert.match(relationApi, /auth\.getSession\(\)/);
});

test("around requires login before creating or deleting a relation", async () => {
  const around = await readFile("src/app/around/page.tsx", "utf8");

  assert.match(around, /const \{ archiveList, user, openAuth \} = useAppData\(\)/);
  assert.match(around, /if \(!user\) \{\s*openAuth\(\);\s*return;/);
});

test("around uses compact mobile spacing", async () => {
  const around = await readFile("src/app/around/page.tsx", "utf8");

  assert.match(around, /px-\[16px\] py-\[16px\]/);
  assert.match(around, /rounded-\[16px\][^"\n]*p-\[14px\]/);
  assert.doesNotMatch(around, /rounded-\[21px\]/);
});

test("relations SQL grants reads publicly and mutations to authenticated users", async () => {
  const sql = await readFile("supabase/relations.sql", "utf8");

  assert.match(sql, /for select\s+using \(true\)/);
  assert.match(sql, /for insert\s+to authenticated\s+with check \(true\)/);
  assert.match(sql, /for update\s+to authenticated\s+using \(true\)\s+with check \(true\)/);
  assert.match(sql, /for delete\s+to authenticated\s+using \(true\)/);
  assert.doesNotMatch(sql, /relations_all_access"\s+on public\.relations\s+for all/);
});
