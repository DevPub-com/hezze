import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { extractYoutubeVideoId } from "../src/domains/archive/lib/youtube-url.mjs";

test("extracts a video id from every supported YouTube URL shape", () => {
  const id = "pX1XDCtKpag";
  assert.equal(extractYoutubeVideoId(`https://www.youtube.com/live/${id}?si=6G1ip`), id);
  assert.equal(extractYoutubeVideoId(`https://www.youtube.com/watch?v=${id}`), id);
  assert.equal(extractYoutubeVideoId(`https://youtu.be/${id}`), id);
  assert.equal(extractYoutubeVideoId(`https://www.youtube.com/shorts/${id}`), id);
  assert.equal(extractYoutubeVideoId(`https://www.youtube.com/embed/${id}`), id);
});

test("rejects non-YouTube and malformed URLs", () => {
  assert.equal(extractYoutubeVideoId("https://example.com/live/pX1XDCtKpag"), null);
  assert.equal(extractYoutubeVideoId("https://youtube.com/live/too-short"), null);
  assert.equal(extractYoutubeVideoId("not a url"), null);
});

test("analysis returns expected failures as data instead of throwing a hidden production error", async () => {
  const api = await readFile("src/domains/archive/api/analyze.action.ts", "utf8");
  const modal = await readFile("src/components/register/RegisterModal.tsx", "utf8");

  assert.match(api, /Promise<NewsAnalysisResult>/);
  assert.match(api, /return \{ preview: null, error:/);
  assert.match(modal, /if \(result\.error\)/);
  assert.match(modal, /setAnalysisPreview\(result\.preview\)/);
});
