import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const signOut = readFileSync(new URL("../src/components/auth/account-signout.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("the sign-out action remains visible and follows the active profile theme", () => {
  assert.match(signOut, /className="text-link account-signout"/);
  assert.match(css, /account-signout-row \.account-signout \{[\s\S]*?min-height:44px/);
  assert.match(css, /account-signout-row \.account-signout \{[\s\S]*?border:2px solid var\(--red\)/);
  assert.match(css, /border-radius:var\(--profile-input-radius,0\)/);
  assert.match(css, /background:color-mix\(in srgb,var\(--profile-surface,var\(--paper\)\) 92%,var\(--red\)\)/);
  assert.match(css, /box-shadow:4px 4px 0 var\(--profile-shadow,var\(--ink\)\)/);
  assert.match(css, /account-signout-row \.account-signout:focus-visible/);
});
