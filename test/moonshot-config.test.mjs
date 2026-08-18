import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const analyzeActionUrl = new URL(
  "../src/domains/archive/api/analyze.action.ts",
  import.meta.url,
);

test("OpenAI-compatible analysis calls use the Moonshot API configuration", async () => {
  const source = await readFile(analyzeActionUrl, "utf8");

  assert.match(source, /process\.env\.MOONSHOT_API_KEY/);
  assert.match(source, /https:\/\/api\.moonshot\.ai\/v1/);
  assert.match(source, /process\.env\.MOONSHOT_MODEL\s*\|\|\s*"moonshot-v1-8k"/);
  assert.doesNotMatch(source, /process\.env\.OPENAI_API_KEY/);
  assert.doesNotMatch(source, /model:\s*"gpt-4o-mini"/);
});
