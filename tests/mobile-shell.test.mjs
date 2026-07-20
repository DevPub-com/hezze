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
