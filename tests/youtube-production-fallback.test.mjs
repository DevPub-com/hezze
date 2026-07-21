import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("YouTube scraping rejects blocked player responses and retries the mobile endpoint", async () => {
  const source = await readFile("src/domains/archive/api/analyze.action.ts", "utf8");

  assert.match(source, /playabilityStatus\?:/);
  assert.match(source, /playerResponse\?\.playabilityStatus\?\.status === "OK"/);
  assert.match(source, /https:\/\/m\.youtube\.com\/watch/);
  assert.match(source, /cache: "no-store"/);
  assert.doesNotMatch(source, /if \(html\.includes\("ytInitialPlayerResponse"\)\) \{\s*return html;/);
});

test("YouTube analysis falls back to public oEmbed metadata when Vercel is blocked", async () => {
  const source = await readFile("src/domains/archive/api/analyze.action.ts", "utf8");

  assert.match(source, /async function fetchYoutubeOEmbed/);
  assert.match(source, /https:\/\/www\.youtube\.com\/oembed/);
  assert.match(source, /author_name/);
  assert.match(source, /자막을 불러오지 못해 제목과 채널 정보만 분석합니다/);
});
