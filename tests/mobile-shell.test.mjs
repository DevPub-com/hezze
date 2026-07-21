import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

test("app shell uses the mobile bottom navigation and a focused app canvas", async () => {
  const appShell = await source("src/components/shell/AppShell.tsx");
  const bottomNavigation = await source("src/components/shell/BottomNavigation.tsx");

  assert.match(appShell, /BottomNavigation/);
  assert.match(appShell, /max-w-\[560px\]/);
  assert.doesNotMatch(appShell, /<Sidebar/);
  assert.match(bottomNavigation, /aria-label="\uc8fc\uc694 \ub0b4\ube44\uac8c\uc774\uc158"/);
  assert.match(bottomNavigation, /env\(safe-area-inset-bottom\)/);
  assert.match(bottomNavigation, /grid-cols-4/);
  assert.doesNotMatch(bottomNavigation, /href: "\/around"/);
  assert.doesNotMatch(bottomNavigation, /label: "어라운드"/);
});

test("board is a single-pane mobile flow", async () => {
  const board = await source("src/components/board/BoardView.tsx");

  assert.match(board, /100dvh/);
  assert.doesNotMatch(board, /lg:flex-row/);
  assert.doesNotMatch(board, /lg:grid-cols-3/);
  assert.doesNotMatch(board, /hidden lg:flex/);
  assert.doesNotMatch(board, /hidden lg:block/);
});

test("top bar no longer duplicates route navigation", async () => {
  const topbar = await source("src/components/shell/Topbar.tsx");

  assert.doesNotMatch(topbar, /MOBILE_NAV/);
  assert.doesNotMatch(topbar, /<nav/);
  assert.doesNotMatch(topbar, /HETJE, \ubc1c\uc81c\uc790, \uc8fc\uc81c \uac80\uc0c9/);
  assert.doesNotMatch(topbar, /<Input/);
  assert.match(topbar, /aria-label="\uc0c8 HETJE \ub9cc\ub4e4\uae30"/);
});

test("the HETJE brand alone always returns the board to its list", async () => {
  const topbar = await source("src/components/shell/Topbar.tsx");
  const board = await source("src/components/board/BoardView.tsx");

  assert.doesNotMatch(topbar, /HUMAN THOUGHT ARCHIVE/);
  assert.match(topbar, />\ud5f7\uc81c<\/b>/);
  assert.match(topbar, /new Event\("hezze:show-board-list"\)/);
  assert.match(board, /addEventListener\("hezze:show-board-list"/);
  assert.match(board, /setSelectedArchiveId\(null\)/);
  assert.match(board, /setMobileView\("list"\)/);
});

test("secondary mobile pages do not repeat oversized promotional headings", async () => {
  const myPage = await source("src/app/my/page.tsx");
  const tomorrowPage = await source("src/app/tomorrow/page.tsx");
  const aroundPage = await source("src/app/around/page.tsx");

  for (const page of [myPage, tomorrowPage, aroundPage]) {
    assert.doesNotMatch(page, /<h1/);
  }
});

test("board detail offers a persistent Tomorrow action", async () => {
  const board = await readFile("src/components/board/BoardView.tsx", "utf8");

  assert.match(board, /tracked\.has\(selectedArchive\.id\)/);
  assert.match(board, /toggleTracked\(selectedArchive\.id\)/);
  assert.match(board, /Tomorrow에 추가/);
  assert.match(board, /Tomorrow 추가됨/);
  assert.match(board, /aria-pressed=\{tracked\.has\(selectedArchive\.id\)\}/);
});

test("board detail does not duplicate icons with text emoji", async () => {
  const board = await readFile("src/components/board/BoardView.tsx", "utf8");

  assert.match(board, /<FileText/);
  assert.match(board, /<Sparkles/);
  assert.match(board, /<AlertCircle/);
  assert.match(board, /<Users/);
  assert.match(board, /<Clock/);
  assert.doesNotMatch(board, /📌 누가 무슨 말을 했냐면요/);
  assert.doesNotMatch(board, /✨ 자랑용 성지순례 카드/);
  assert.doesNotMatch(board, /💡 한 줄로 딱 정리해 드릴게요/);
  assert.doesNotMatch(board, /👥 사람들의 생각은 어떤가요/);
  assert.doesNotMatch(board, /⏱️ 말한 뒤로 어떻게 변했을까요/);
});

test("leaderboard tabs do not duplicate lucide icons with emoji", async () => {
  const leaderboard = await readFile("src/components/archive/LeaderboardSection.tsx", "utf8");

  assert.match(leaderboard, /<Trophy/);
  assert.match(leaderboard, /<Target/);
  assert.doesNotMatch(leaderboard, /<Trophy[^>]*\/>\s*<span>🏆/);
  assert.doesNotMatch(leaderboard, /<Target[^>]*\/>\s*<span>🔮/);
});

test("Tomorrow card actions do not duplicate the pin icon with an emoji", async () => {
  const board = await readFile("src/components/board/BoardView.tsx", "utf8");
  const hetjeCard = await readFile("src/components/hetje/HetjeCard.tsx", "utf8");

  for (const component of [board, hetjeCard]) {
    assert.match(component, /<Pin/);
    assert.doesNotMatch(component, /📎 Tomorrow/);
  }
});
