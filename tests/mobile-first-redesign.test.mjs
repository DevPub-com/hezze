import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(path, "utf8");
}

test("the shell uses a quiet editorial mobile canvas", async () => {
  const [shell, topbar, navigation, globals] = await Promise.all([
    source("src/components/shell/AppShell.tsx"),
    source("src/components/shell/Topbar.tsx"),
    source("src/components/shell/BottomNavigation.tsx"),
    source("src/app/globals.css"),
  ]);

  assert.match(shell, /bg-\[#eef1f5\]/);
  assert.doesNotMatch(shell, /radial-gradient/);
  assert.match(topbar, /<Search/);
  assert.match(navigation, /min-h-\[56px\]/);
  assert.doesNotMatch(navigation, /rounded-\[14px\]/);
  assert.match(globals, /--background: #f8f9fb/);
});

test("the board is a scan-first feed with a focused mobile detail", async () => {
  const [board, model] = await Promise.all([
    source("src/components/board/BoardView.tsx"),
    source("src/domains/archive/model/archive.model.ts"),
  ]);

  assert.match(board, /오늘 확인할 발언/);
  assert.match(board, /전체/);
  assert.match(board, /정치/);
  assert.match(board, /경제/);
  assert.match(board, /사회/);
  assert.match(board, /발언 상세/);
  assert.match(board, /공식 출처 확인/);
  assert.match(board, /한 줄 요약/);
  assert.match(board, /변화 타임라인/);
  assert.match(board, /sticky bottom-0/);
  assert.match(board, /어떻게 추적할까요\?/);
  assert.match(board, /새로운 변화가 있을 때/);
  assert.match(board, /중요 변화만 알림/);
  assert.doesNotMatch(board, /📊|🤖|👥|⚙️|⚡|📄|🔗/);
  assert.doesNotMatch(model, /🚀|🌫️|🔥|🪦|🎉|🎯|🔀|↩️/);
});

test("Tomorrow prioritizes updates instead of repeating archive cards", async () => {
  const tomorrow = await source("src/app/tomorrow/page.tsx");

  assert.match(tomorrow, /변화 있음/);
  assert.match(tomorrow, /관찰 중/);
  assert.match(tomorrow, /오늘 새 변화/);
  assert.match(tomorrow, /archive\.timeline/);
  assert.doesNotMatch(tomorrow, /<HetjeCard/);
});

test("saved archive cards use the compact editorial card system", async () => {
  const card = await source("src/components/hetje/HetjeCard.tsx");

  assert.match(card, /공식 출처 확인/);
  assert.match(card, /rounded-\[14px\]/);
  assert.match(card, /<Bookmark/);
  assert.doesNotMatch(card, /rounded-\[21px\]/);
});

test("secondary routes use the shared app bar instead of duplicate page headers", async () => {
  const [topbar, myPage, tomorrowPage, leaderboardPage] = await Promise.all([
    source("src/components/shell/Topbar.tsx"),
    source("src/app/my/page.tsx"),
    source("src/app/tomorrow/page.tsx"),
    source("src/app/leaderboard/page.tsx"),
  ]);

  assert.match(topbar, /\/my.*내 헷제/s);
  assert.match(topbar, /\/tomorrow.*투모로우/s);
  assert.match(topbar, /\/leaderboard.*랭킹/s);
  assert.match(topbar, /data-page-filter/);
  assert.doesNotMatch(myPage, /<header/);
  assert.doesNotMatch(tomorrowPage, /<header/);
  assert.doesNotMatch(leaderboardPage, /px-\[10px\] py-\[16px\]/);
});

test("the app bar stays fixed without covering secondary page content", async () => {
  const topbar = await source("src/components/shell/Topbar.tsx");

  assert.match(topbar, /pageTitle\s*\?\s*"fixed inset-x-0 top-0/);
  assert.match(topbar, /aria-hidden="true"/);
  assert.match(topbar, /h-\[calc\(60px\+env\(safe-area-inset-top\)\)\]/);
  assert.match(topbar, /h-\[calc\(111px\+env\(safe-area-inset-top\)\)\]/);
});

test("leaderboard follows the same compact editorial mobile language", async () => {
  const leaderboard = await source("src/components/archive/LeaderboardSection.tsx");

  assert.match(leaderboard, /이번 주 신뢰도 랭킹/);
  assert.match(leaderboard, /인물 랭킹/);
  assert.match(leaderboard, /예측 랭킹/);
  assert.match(leaderboard, /rounded-\[12px\]/);
  assert.match(leaderboard, /실시간 집계/);
  assert.doesNotMatch(leaderboard, /bg-gradient/);
  assert.doesNotMatch(leaderboard, /🥇|🥈|🥉|👑|🌟|✨|🎉|🚀|🔮/);
  assert.doesNotMatch(leaderboard, /<Card|<Badge/);
});
