import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

async function loadAuthFlow() {
  let source;
  try {
    source = await readFile("src/lib/auth-flow.ts", "utf8");
  } catch {
    assert.fail("auth flow helper is not implemented");
  }

  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

test("email rate-limit errors are translated with the remaining wait time", async () => {
  const { getAuthErrorMessage } = await loadAuthFlow();

  assert.equal(
    getAuthErrorMessage({
      code: "over_email_send_rate_limit",
      message: "For security purposes, you can only request this after 38 seconds.",
    }),
    "보안을 위해 38초 후 다시 시도해 주세요."
  );
});

test("login errors explain invalid credentials and unconfirmed email", async () => {
  const { getAuthErrorMessage } = await loadAuthFlow();

  assert.equal(
    getAuthErrorMessage({ code: "invalid_credentials", message: "Invalid login credentials" }),
    "이메일 또는 비밀번호가 올바르지 않습니다."
  );
  assert.equal(
    getAuthErrorMessage({ code: "email_not_confirmed", message: "Email not confirmed" }),
    "이메일 인증을 완료한 뒤 로그인해 주세요."
  );
});

test("signup without a session requires email confirmation instead of claiming login", async () => {
  const { getSignUpOutcome } = await loadAuthFlow();

  assert.deepEqual(getSignUpOutcome({ user: { id: "user-1" }, session: null }), {
    authenticated: false,
    message: "가입 확인 메일을 보냈습니다. 이메일 인증을 완료한 뒤 로그인해 주세요.",
  });
  assert.deepEqual(getSignUpOutcome({ user: { id: "user-1" }, session: { access_token: "token" } }), {
    authenticated: true,
    message: "회원가입과 로그인이 완료되었습니다.",
  });
});

test("the text logo links home and the decorative H icon is removed", async () => {
  const topbar = await readFile("src/components/shell/Topbar.tsx", "utf8");

  assert.match(topbar, /import Link from "next\/link"/);
  assert.match(topbar, /<Link href="\/" aria-label="헷제 메인으로 이동"/);
  assert.doesNotMatch(topbar, />\s*H\s*<\/div>/);
});
