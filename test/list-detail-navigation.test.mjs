import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("saved and tracked cards link to the selected Board detail", async () => {
  const [boardPage, boardView, card] = await Promise.all([
    read("src/app/page.tsx"),
    read("src/components/board/BoardView.tsx"),
    read("src/components/hetje/HetjeCard.tsx"),
  ]);

  assert.ok(boardPage.includes("searchParams"), "Board page must read the archive query parameter");
  assert.ok(boardPage.includes("initialArchiveId"), "Board page must pass the selected archive ID");
  assert.ok(boardView.includes("initialArchiveId"), "Board view must initialize the selected detail from the URL");
  assert.ok(card.includes('import Link from "next/link"'), "HETJE cards must use a Next.js link");
  assert.ok(card.includes("/?archive="), "HETJE cards must link to the Board archive query");
});

test("My HETJE and Tomorrow explain their purpose above the lists", async () => {
  const [myPage, tomorrowPage] = await Promise.all([
    read("src/app/my/page.tsx"),
    read("src/app/tomorrow/page.tsx"),
  ]);

  assert.ok(myPage.includes("개인 보관함"), "My HETJE must explain that it is a personal archive");
  assert.ok(tomorrowPage.includes("변화와 결과"), "Tomorrow must explain that it tracks changes and outcomes");
});
